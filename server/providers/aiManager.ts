import { GoogleGenAI, Type } from '@google/genai';
import {
  AI_PROVIDERS,
  createAIClient,
  createMongoAIConfigStore,
  openSecret,
  providerDisplayName,
  providerInfo,
  sealSecret,
  type AIConfigStore,
  type MongoDatabaseLike,
  type StoredAIConnection,
  type StoredAIModel,
} from '@tuanmjnh/tm-ai-client';
import { z } from 'zod';
import type {
  AIProviderConnectionView,
  AIProviderModelView,
  CmsLearningPackage,
  SafetyReviewResult,
  StoryBook,
} from '../../packages/contracts/types';
import { env, getMasterEncryptionKey } from '../config/env';
import {
  DEFAULT_AGE_GROUPS,
  getAgeGroupById,
} from '../data/ageGroupRepository';
import { getMongoDb } from '../db/mongo';

const OWNER_ID = 'tm-lingo-system';

const memoryStoreMap: Map<string, StoredAIConnection> = new Map();

function createMemoryAIConfigStore(): AIConfigStore {
  return {
    async listConnections() {
      return Array.from(memoryStoreMap.values());
    },
    async upsertConnection(input) {
      const now = new Date().toISOString();
      const existing = memoryStoreMap.get(input.connectionId);
      const record: StoredAIConnection = {
        ownerId: OWNER_ID,
        connectionId: input.connectionId,
        providerKey: input.providerKey,
        baseUrl: input.baseUrl,
        apiKeyCipher: input.apiKeyCipher,
        apiKeyEnv: input.apiKeyEnv,
        enabled: input.enabled,
        models: (input.models ?? existing?.models ?? []).map((m) => ({
          modelId: m.modelId,
          displayName: m.displayName ?? m.modelId,
          enabled: m.enabled ?? true,
          isPrimary: m.isPrimary ?? false,
          discoveredAt: m.discoveredAt,
        })),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      memoryStoreMap.set(record.connectionId, record);
      return record;
    },
    async removeConnection(connectionId) {
      memoryStoreMap.delete(connectionId);
    },
    async replaceModels(connectionId, models) {
      const existing = memoryStoreMap.get(connectionId);
      if (existing) {
        existing.models = models;
        existing.updatedAt = new Date().toISOString();
      }
    },
  };
}

async function getStore(): Promise<AIConfigStore> {
  const db = await getMongoDb();
  if (!db) {
    return createMemoryAIConfigStore();
  }
  const store = createMongoAIConfigStore(
    db as unknown as MongoDatabaseLike,
    OWNER_ID,
    { collectionName: 'ai_connections' }
  );
  if (store.ensureSchema) {
    await store.ensureSchema().catch(() => undefined);
  }
  return store;
}

const memoryArchivedAiMap: Map<string, string | null> = new Map();

async function getAiArchiveMap(): Promise<Map<string, string | null>> {
  const db = await getMongoDb();
  if (!db) return memoryArchivedAiMap;
  const docs = await db
    .collection<{ connectionId: string; archivedAt?: string | null }>('ai_connections')
    .find({ ownerId: OWNER_ID }, { projection: { connectionId: 1, archivedAt: 1, _id: 0 } })
    .toArray();
  const map = new Map<string, string | null>();
  for (const doc of docs) {
    map.set(doc.connectionId, doc.archivedAt ?? null);
  }
  return map;
}

function toPublicView(
  record: StoredAIConnection,
  archivedAt?: string | null
): AIProviderConnectionView {
  const models: AIProviderModelView[] = (record.models ?? []).map((m) => ({
    modelId: m.modelId,
    displayName: m.displayName || m.modelId,
    enabled: m.enabled !== false,
    isPrimary: Boolean(m.isPrimary),
    discoveredAt: m.discoveredAt,
  }));

  return {
    connectionId: record.connectionId,
    providerKey: record.providerKey,
    providerName: providerDisplayName(record.providerKey),
    baseUrl: record.baseUrl,
    hasKey: Boolean(record.apiKeyCipher && record.apiKeyCipher.length > 0),
    enabled: record.enabled !== false && !archivedAt,
    models,
    source: 'mongodb',
    archivedAt: archivedAt ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function getSupportedAIProviders() {
  return AI_PROVIDERS.map((p) => ({
    key: p.key,
    name: p.name,
    family: p.family,
    defaultBaseUrl: p.defaultBaseUrl ?? '',
    keyless: p.keyless,
    docsUrl: p.docsUrl,
  }));
}

export async function listAIConnections(options?: {
  includeArchived?: boolean;
}): Promise<{
  connections: AIProviderConnectionView[];
  envFallbackAvailable: boolean;
  envFallbackModel: string;
}> {
  const includeArchived = Boolean(options?.includeArchived);
  const store = await getStore();
  const stored = await store.listConnections();
  const archiveMap = await getAiArchiveMap();
  const connections = stored
    .map((rec) => toPublicView(rec, archiveMap.get(rec.connectionId) ?? null))
    .filter((conn) => includeArchived || !conn.archivedAt);
  const envFallbackAvailable = Boolean(env.GEMINI_API_KEY.trim());

  return {
    connections,
    envFallbackAvailable,
    envFallbackModel: env.GEMINI_TEXT_MODEL || 'gemini-4-hydrogen',
  };
}

export async function upsertAIConnection(input: {
  connectionId?: string;
  providerKey: string;
  baseUrl?: string;
  apiKey?: string;
  enabled?: boolean;
  models?: Array<{
    modelId: string;
    displayName?: string;
    enabled?: boolean;
    isPrimary?: boolean;
  }>;
}): Promise<AIProviderConnectionView> {
  const store = await getStore();
  const existingList = await store.listConnections();
  const info = providerInfo(input.providerKey);
  const connectionId =
    input.connectionId?.trim() ||
    `${input.providerKey}-${Date.now().toString(36)}`;
  const existing = existingList.find((c) => c.connectionId === connectionId);

  let apiKeyCipher = existing?.apiKeyCipher ?? '';
  if (input.apiKey && input.apiKey.trim()) {
    apiKeyCipher = await sealSecret(
      getMasterEncryptionKey(),
      input.apiKey.trim()
    );
  }

  const resolvedBaseUrl =
    input.baseUrl?.trim() ||
    existing?.baseUrl ||
    info?.defaultBaseUrl ||
    '';

  const defaultModels: StoredAIModel[] =
    input.models && input.models.length > 0
      ? input.models.map((m, idx) => ({
          modelId: m.modelId.trim(),
          displayName: m.displayName?.trim() || m.modelId.trim(),
          enabled: m.enabled ?? true,
          isPrimary: m.isPrimary ?? idx === 0,
        }))
      : existing?.models ??
        (input.providerKey === 'google_ai' || input.providerKey === 'gemini'
          ? [
              {
                modelId: env.GEMINI_TEXT_MODEL || 'gemini-4-hydrogen',
                displayName: 'Gemini 4 Hydrogen (Text & Structured)',
                enabled: true,
                isPrimary: true,
              },
            ]
          : []);

  const saved = await store.upsertConnection({
    connectionId,
    providerKey: input.providerKey.trim(),
    baseUrl: resolvedBaseUrl,
    apiKeyCipher,
    enabled: input.enabled ?? true,
    models: defaultModels,
  });

  return toPublicView(saved);
}

export async function deleteAIConnection(
  connectionId: string,
  mode: 'soft' | 'hard' = 'soft'
): Promise<{ ok: boolean; mode: 'soft' | 'hard' }> {
  const store = await getStore();
  const all = await store.listConnections();
  const target = all.find((c) => c.connectionId === connectionId);
  if (!target) return { ok: false, mode };

  if (mode === 'hard') {
    await store.removeConnection(connectionId);
    memoryArchivedAiMap.delete(connectionId);
    return { ok: true, mode: 'hard' };
  }

  const now = new Date().toISOString();
  await store.upsertConnection({
    connectionId: target.connectionId,
    providerKey: target.providerKey,
    baseUrl: target.baseUrl,
    apiKeyCipher: target.apiKeyCipher,
    apiKeyEnv: target.apiKeyEnv,
    enabled: false,
    models: target.models,
  });
  memoryArchivedAiMap.set(connectionId, now);
  const db = await getMongoDb();
  if (db) {
    await db
      .collection('ai_connections')
      .updateOne(
        { ownerId: OWNER_ID, connectionId },
        { $set: { archivedAt: now, enabled: false, updatedAt: now } }
      );
  }
  return { ok: true, mode: 'soft' };
}

export async function restoreAIConnection(
  connectionId: string
): Promise<AIProviderConnectionView | null> {
  const store = await getStore();
  const all = await store.listConnections();
  const target = all.find((c) => c.connectionId === connectionId);
  if (!target) return null;

  const now = new Date().toISOString();
  const restored = await store.upsertConnection({
    connectionId: target.connectionId,
    providerKey: target.providerKey,
    baseUrl: target.baseUrl,
    apiKeyCipher: target.apiKeyCipher,
    apiKeyEnv: target.apiKeyEnv,
    enabled: true,
    models: target.models,
  });
  memoryArchivedAiMap.set(connectionId, null);
  const db = await getMongoDb();
  if (db) {
    await db
      .collection('ai_connections')
      .updateOne(
        { ownerId: OWNER_ID, connectionId },
        { $set: { archivedAt: null, enabled: true, updatedAt: now } }
      );
  }
  return toPublicView(restored, null);
}

export async function updateAIConnectionModels(
  connectionId: string,
  models: StoredAIModel[]
): Promise<AIProviderConnectionView | null> {
  const store = await getStore();
  const all = await store.listConnections();
  const found = all.find((c) => c.connectionId === connectionId);
  if (!found) return null;

  await store.replaceModels(connectionId, models);
  const refreshed = (await store.listConnections()).find(
    (c) => c.connectionId === connectionId
  );
  return refreshed ? toPublicView(refreshed) : null;
}

async function openConnectionKey(record: StoredAIConnection): Promise<string> {
  if (!record.apiKeyCipher) return '';
  return openSecret(getMasterEncryptionKey(), record.apiKeyCipher);
}

function isGoogleProvider(providerKey: string): boolean {
  const normalized = providerKey.toLowerCase();
  return (
    normalized === 'google_ai' ||
    normalized === 'google' ||
    normalized === 'gemini'
  );
}

export async function testAIConnection(connectionId: string): Promise<{
  ok: boolean;
  message: string;
  discoveredModels: AIProviderModelView[];
}> {
  const store = await getStore();
  const all = await store.listConnections();
  const record = all.find((c) => c.connectionId === connectionId);
  if (!record) {
    return {
      ok: false,
      message: `Connection "${connectionId}" not found.`,
      discoveredModels: [],
    };
  }

  let apiKey = '';
  try {
    apiKey = await openConnectionKey(record);
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? `Cannot decrypt stored key (check AI_CONFIG_SECRET): ${err.message}`
          : 'Cannot decrypt stored key.',
      discoveredModels: [],
    };
  }

  // Google AI / Gemini native check using @google/genai
  if (isGoogleProvider(record.providerKey)) {
    if (!apiKey) {
      return {
        ok: false,
        message: 'No API key configured for this Google AI connection.',
        discoveredModels: [],
      };
    }
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const testModel =
        record.models.find((m) => m.isPrimary && m.enabled)?.modelId ||
        env.GEMINI_TEXT_MODEL ||
        'gemini-4-hydrogen';
      const resp = await ai.models.generateContent({
        model: testModel,
        contents: 'Reply with OK.',
      });
      const discovered: StoredAIModel[] =
        record.models.length > 0
          ? record.models
          : [
              {
                modelId: env.GEMINI_TEXT_MODEL || 'gemini-4-hydrogen',
                displayName: 'Gemini 4 Hydrogen',
                enabled: true,
                isPrimary: true,
                discoveredAt: new Date().toISOString(),
              },
            ];
      await store.replaceModels(record.connectionId, discovered);
      return {
        ok: Boolean(resp.text !== undefined),
        message: `Connected to Google AI (${testModel}).`,
        discoveredModels: discovered.map((m) => ({
          modelId: m.modelId,
          displayName: m.displayName || m.modelId,
          enabled: m.enabled,
          isPrimary: m.isPrimary,
          discoveredAt: m.discoveredAt,
        })),
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Google AI connection failed',
        discoveredModels: [],
      };
    }
  }

  // Standard OpenAI-compatible or Anthropic provider check via @tuanmjnh/tm-ai-client
  try {
    const client = createAIClient({
      endpoint: {
        provider: record.providerKey,
        baseUrl: record.baseUrl,
        apiKey: apiKey || undefined,
        mode: 'app',
      },
      timeoutMs: 12000,
      allowKeyless: Boolean(providerInfo(record.providerKey)?.keyless),
    });

    const listRes = await client.listModels();
    const now = new Date().toISOString();
    const existingById = new Map(record.models.map((m) => [m.modelId, m]));
    const merged: StoredAIModel[] = listRes.models.slice(0, 30).map((m, idx) => {
      const prev = existingById.get(m.id);
      return {
        modelId: m.id,
        displayName: m.label || m.id,
        enabled: prev ? prev.enabled : idx < 5,
        isPrimary: prev ? prev.isPrimary : idx === 0,
        discoveredAt: now,
      };
    });

    if (merged.length > 0) {
      await store.replaceModels(record.connectionId, merged);
    }

    return {
      ok: true,
      message: `Connected successfully (${listRes.count} model(s) discovered).`,
      discoveredModels: merged.map((m) => ({
        modelId: m.modelId,
        displayName: m.displayName || m.modelId,
        enabled: m.enabled,
        isPrimary: m.isPrimary,
        discoveredAt: m.discoveredAt,
      })),
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Provider connection test failed',
      discoveredModels: [],
    };
  }
}

// ---------- AI Content Studio Structured Generators ----------

const generatedPackageDraftSchema = z.object({
  topicSlug: z.string().min(2).max(40),
  titleLearning: z.string().min(2).max(80),
  titleExplanation: z.string().min(2).max(80),
  summaryLearning: z.string().min(5).max(240),
  summaryExplanation: z.string().min(5).max(240),
  concepts: z
    .array(
      z.object({
        slug: z.string().min(2).max(32),
        termLearning: z.string().min(1).max(60),
        exampleLearning: z.string().min(3).max(160),
        explanationLearning: z.string().min(3).max(160),
        pronunciationGuide: z.string().max(60).optional(),
        termExplanation: z.string().min(1).max(60),
        exampleExplanation: z.string().min(3).max(160),
        explanationNative: z.string().min(3).max(160),
      })
    )
    .min(3)
    .max(5),
});

const generatedStoryDraftSchema = z.object({
  titleLearning: z.string().min(2).max(90),
  titleExplanation: z.string().min(2).max(90),
  summaryLearning: z.string().min(5).max(240),
  summaryExplanation: z.string().min(5).max(240),
  segments: z
    .array(
      z.object({
        textLearning: z.string().min(5).max(220),
        textExplanation: z.string().min(5).max(220),
        explanationNote: z.string().min(5).max(220),
        explanationNoteLearning: z.string().min(5).max(220),
      })
    )
    .min(3)
    .max(6),
});

function sanitizeSlug(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'topic'
  );
}

async function runTextJsonCompletion(input: {
  systemPrompt: string;
  userPrompt: string;
  connectionId?: string;
  modelOverride?: string;
  geminiSchema?: Record<string, unknown>;
}): Promise<{ jsonText: string; providerUsed: string; modelUsed: string }> {
  const store = await getStore();
  const archiveMap = await getAiArchiveMap();
  const connections = (await store.listConnections()).filter(
    (c) => c.enabled && !archiveMap.get(c.connectionId)
  );

  const chosen = input.connectionId
    ? connections.find((c) => c.connectionId === input.connectionId)
    : connections.find((c) => c.apiKeyCipher) ?? connections[0];

  if (chosen) {
    const apiKey = await openConnectionKey(chosen);
    const chosenModel =
      input.modelOverride ||
      chosen.models.find((m) => m.isPrimary && m.enabled)?.modelId ||
      chosen.models.find((m) => m.enabled)?.modelId ||
      env.GEMINI_TEXT_MODEL ||
      'gemini-4-hydrogen';

    if (isGoogleProvider(chosen.providerKey) && apiKey) {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const resp = await ai.models.generateContent({
        model: chosenModel,
        contents: input.userPrompt,
        config: {
          systemInstruction: input.systemPrompt,
          responseMimeType: 'application/json',
          ...(input.geminiSchema ? { responseSchema: input.geminiSchema } : {}),
        },
      });
      return {
        jsonText: (resp.text ?? '').trim(),
        providerUsed: chosen.providerKey,
        modelUsed: chosenModel,
      };
    }

    const client = createAIClient({
      endpoint: {
        provider: chosen.providerKey,
        baseUrl: chosen.baseUrl,
        apiKey: apiKey || undefined,
        mode: 'app',
        model: chosenModel,
      },
      timeoutMs: 30000,
      allowKeyless: Boolean(providerInfo(chosen.providerKey)?.keyless),
    });

    const result = await client.chat({
      model: chosenModel,
      jsonMode: true,
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt },
      ],
    });
    return {
      jsonText: result.content.trim(),
      providerUsed: chosen.providerKey,
      modelUsed: result.model || chosenModel,
    };
  }

  // Server-side env fallback using GEMINI_API_KEY
  const fallbackKey = env.GEMINI_API_KEY.trim();
  if (!fallbackKey) {
    throw new Error(
      'No AI Provider configured yet. Add a provider in AI Providers or set GEMINI_API_KEY on the server.'
    );
  }

  const fallbackModel =
    input.modelOverride || env.GEMINI_TEXT_MODEL || 'gemini-4-hydrogen';
  const ai = new GoogleGenAI({
    apiKey: fallbackKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
  const resp = await ai.models.generateContent({
    model: fallbackModel,
    contents: input.userPrompt,
    config: {
      systemInstruction: input.systemPrompt,
      responseMimeType: 'application/json',
      ...(input.geminiSchema ? { responseSchema: input.geminiSchema } : {}),
    },
  });

  return {
    jsonText: (resp.text ?? '').trim(),
    providerUsed: 'google_ai (env)',
    modelUsed: fallbackModel,
  };
}

function extractJsonObject(raw: string): unknown {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

export async function generateLearningPackageDraft(input: {
  topic: string;
  learningLocale: string;
  explanationLocale: string;
  ageBand?: string;
  connectionId?: string;
  modelOverride?: string;
}): Promise<{
  draft: CmsLearningPackage;
  providerUsed: string;
  modelUsed: string;
}> {
  const targetAgeGroup =
    (input.ageBand ? await getAgeGroupById(input.ageBand) : null) ??
    DEFAULT_AGE_GROUPS[0];
  const audienceDesc = `${targetAgeGroup.displayNames.en} (${targetAgeGroup.gradeRange.en}, CEFR ${targetAgeGroup.cefrRange})`;

  const systemPrompt = `You are a multilingual curriculum designer for TM-Lingo designing for ${audienceDesc}. Output ONLY valid JSON matching the requested schema. Adapt vocabulary complexity, tone, and sentence length to fit ${audienceDesc}.`;

  const userPrompt = `Create a vocabulary learning package for ${audienceDesc} on the topic "${input.topic}".
Target learning language locale: "${input.learningLocale}".
Explanation language locale: "${input.explanationLocale}".
Generate 3 vocabulary concepts. Return JSON with fields:
{
  "topicSlug": "short-english-slug",
  "titleLearning": "short title in ${input.learningLocale}",
  "titleExplanation": "short title in ${input.explanationLocale}",
  "summaryLearning": "1 gentle sentence in ${input.learningLocale}",
  "summaryExplanation": "1 gentle sentence in ${input.explanationLocale}",
  "concepts": [
    {
      "slug": "word-slug",
      "termLearning": "word in ${input.learningLocale}",
      "exampleLearning": "short child-friendly sentence in ${input.learningLocale}",
      "explanationLearning": "simple description in ${input.learningLocale}",
      "pronunciationGuide": "simple syllable hint",
      "termExplanation": "word in ${input.explanationLocale}",
      "exampleExplanation": "matching sentence in ${input.explanationLocale}",
      "explanationNative": "simple child-friendly explanation in ${input.explanationLocale}"
    }
  ]
}`;

  const geminiSchema = {
    type: Type.OBJECT,
    properties: {
      topicSlug: { type: Type.STRING },
      titleLearning: { type: Type.STRING },
      titleExplanation: { type: Type.STRING },
      summaryLearning: { type: Type.STRING },
      summaryExplanation: { type: Type.STRING },
      concepts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            slug: { type: Type.STRING },
            termLearning: { type: Type.STRING },
            exampleLearning: { type: Type.STRING },
            explanationLearning: { type: Type.STRING },
            pronunciationGuide: { type: Type.STRING },
            termExplanation: { type: Type.STRING },
            exampleExplanation: { type: Type.STRING },
            explanationNative: { type: Type.STRING },
          },
        },
      },
    },
  };

  const { jsonText, providerUsed, modelUsed } = await runTextJsonCompletion({
    systemPrompt,
    userPrompt,
    connectionId: input.connectionId,
    modelOverride: input.modelOverride,
    geminiSchema,
  });

  const parsed = generatedPackageDraftSchema.parse(extractJsonObject(jsonText));
  const now = new Date().toISOString();
  const topicSlug = sanitizeSlug(parsed.topicSlug || input.topic);
  const pkgId = `lp-${topicSlug}-${Date.now().toString(36).slice(-4)}`;
  const fallbackAssets = ['img-apple', 'img-banana', 'img-orange', 'img-story-fruit-market'];

  const concepts = parsed.concepts.map((c, idx) => ({
    conceptId: `${topicSlug}.${sanitizeSlug(c.slug)}`,
    schemaVersion: 1,
    assetRef: fallbackAssets[idx % fallbackAssets.length],
    localizations: {
      [input.learningLocale]: {
        term: c.termLearning,
        example: c.exampleLearning,
        explanation: c.explanationLearning,
        pronunciationGuide: c.pronunciationGuide || undefined,
      },
      [input.explanationLocale]: {
        term: c.termExplanation,
        example: c.exampleExplanation,
        explanation: c.explanationNative,
      },
    },
  }));

  const draft: CmsLearningPackage = {
    id: pkgId,
    schemaVersion: 1,
    topicId: `topic.${topicSlug}`,
    ageBand: [targetAgeGroup.id],
    learningLevel: targetAgeGroup.defaultLearningLevel,
    learningLocales: [input.learningLocale],
    explanationLocales: Array.from(
      new Set([input.explanationLocale, input.learningLocale])
    ),
    availableExperienceModes: targetAgeGroup.uiProfile.recommendedModes,
    titles: {
      [input.learningLocale]: parsed.titleLearning,
      [input.explanationLocale]: parsed.titleExplanation,
    },
    summaries: {
      [input.learningLocale]: parsed.summaryLearning,
      [input.explanationLocale]: parsed.summaryExplanation,
    },
    conceptCount: concepts.length,
    concepts,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    publishedSnapshotId: null,
  };

  return { draft, providerUsed, modelUsed };
}

export async function generateStoryDraft(input: {
  topic: string;
  learningLocale: string;
  explanationLocale: string;
  ageBand?: string;
  learningPackageId?: string;
  connectionId?: string;
  modelOverride?: string;
}): Promise<{
  draft: StoryBook;
  providerUsed: string;
  modelUsed: string;
}> {
  const targetAgeGroup =
    (input.ageBand ? await getAgeGroupById(input.ageBand) : null) ??
    DEFAULT_AGE_GROUPS[0];
  const audienceDesc = `${targetAgeGroup.displayNames.en} (${targetAgeGroup.gradeRange.en}, CEFR ${targetAgeGroup.cefrRange})`;

  const systemPrompt = `You are a multilingual educational storyteller for TM-Lingo writing for ${audienceDesc}. Output ONLY valid JSON. Match vocabulary depth, narrative style, and sentence structure to ${audienceDesc}.`;

  const userPrompt = `Write a 4-page illustrated reading story for ${audienceDesc} about "${input.topic}".
Primary narration language: "${input.learningLocale}".
Secondary/explanation language: "${input.explanationLocale}".
Return JSON with:
{
  "titleLearning": "title in ${input.learningLocale}",
  "titleExplanation": "title in ${input.explanationLocale}",
  "summaryLearning": "1 sentence summary in ${input.learningLocale}",
  "summaryExplanation": "1 sentence summary in ${input.explanationLocale}",
  "segments": [
    {
      "textLearning": "1-2 short sentences in ${input.learningLocale}",
      "textExplanation": "1-2 short sentences in ${input.explanationLocale}",
      "explanationNote": "parent tip in ${input.explanationLocale}",
      "explanationNoteLearning": "parent tip in ${input.learningLocale}"
    }
  ]
}`;

  const geminiSchema = {
    type: Type.OBJECT,
    properties: {
      titleLearning: { type: Type.STRING },
      titleExplanation: { type: Type.STRING },
      summaryLearning: { type: Type.STRING },
      summaryExplanation: { type: Type.STRING },
      segments: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            textLearning: { type: Type.STRING },
            textExplanation: { type: Type.STRING },
            explanationNote: { type: Type.STRING },
            explanationNoteLearning: { type: Type.STRING },
          },
        },
      },
    },
  };

  const { jsonText, providerUsed, modelUsed } = await runTextJsonCompletion({
    systemPrompt,
    userPrompt,
    connectionId: input.connectionId,
    modelOverride: input.modelOverride,
    geminiSchema,
  });

  const parsed = generatedStoryDraftSchema.parse(extractJsonObject(jsonText));
  const now = new Date().toISOString();
  const slug = sanitizeSlug(input.topic);
  const assets = ['img-story-fruit-market', 'img-apple', 'img-banana', 'img-orange'];

  const draft: StoryBook = {
    id: `story-${slug}-${Date.now().toString(36).slice(-4)}`,
    schemaVersion: 1,
    learningPackageId: input.learningPackageId || 'lp-fruits-a1',
    ageBands: [targetAgeGroup.id],
    coverAssetRef: 'img-story-fruit-market',
    availableLocales: Array.from(
      new Set([input.learningLocale, input.explanationLocale])
    ),
    availableExplanationLocales: Array.from(
      new Set([input.explanationLocale, input.learningLocale])
    ),
    titles: {
      [input.learningLocale]: parsed.titleLearning,
      [input.explanationLocale]: parsed.titleExplanation,
    },
    summaries: {
      [input.learningLocale]: parsed.summaryLearning,
      [input.explanationLocale]: parsed.summaryExplanation,
    },
    segments: parsed.segments.map((seg, idx) => ({
      id: `seg-${String(idx + 1).padStart(2, '0')}`,
      order: idx + 1,
      assetRef: assets[idx % assets.length],
      textByLocale: {
        [input.learningLocale]: seg.textLearning,
        [input.explanationLocale]: seg.textExplanation,
      },
      explanationByLocale: {
        [input.explanationLocale]: seg.explanationNote,
        [input.learningLocale]: seg.explanationNoteLearning,
      },
    })),
    status: 'draft',
    updatedAt: now,
  };

  return { draft, providerUsed, modelUsed };
}

// ---------- Gemini TTS Voice Synthesis (gemini-3.8-flash-lite-tts) ----------

export async function generateSpeechAudio(input: {
  text: string;
  locale: string;
  voiceName?: 'Kore' | 'Puck' | 'Zephyr' | 'Charon' | 'Fenrir';
  style?: string;
}): Promise<{
  wavBuffer: Buffer;
  mimeType: 'audio/wav';
  providerUsed: string;
  modelUsed: string;
}> {
  const store = await getStore();
  const archiveMap = await getAiArchiveMap();
  const activeGoogle = (await store.listConnections()).find(
    (c) =>
      c.enabled &&
      !archiveMap.get(c.connectionId) &&
      isGoogleProvider(c.providerKey) &&
      Boolean(c.apiKeyCipher)
  );

  let apiKey = '';
  let providerUsed = 'google_ai (env)';
  if (activeGoogle) {
    apiKey = await openConnectionKey(activeGoogle);
    providerUsed = activeGoogle.providerKey;
  } else {
    apiKey = env.GEMINI_API_KEY.trim();
  }

  if (!apiKey) {
    throw new Error(
      'No Google AI key configured for TTS. Add a Google AI provider or set GEMINI_API_KEY.'
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const modelUsed = 'gemini-3.8-flash-lite-tts';
  const voiceName = input.voiceName || 'Kore';
  const stylePrompt =
    input.style ||
    (input.locale.startsWith('vi')
      ? 'Warm, gentle, clear early-childhood Vietnamese storyteller for ages 3 to 5'
      : 'Warm, gentle, clear early-childhood storyteller for ages 3 to 5, slow and friendly');

  const response = await ai.models.generateContent({
    model: modelUsed,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: input.text.trim(),
            speechMetadata: {
              style: stylePrompt,
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const base64Audio =
    response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('Gemini TTS did not return audio data.');
  }

  return {
    wavBuffer: Buffer.from(base64Audio, 'base64'),
    mimeType: 'audio/wav',
    providerUsed,
    modelUsed,
  };
}

// ---------- Cross-Locale AI Adaptation (Locale Independence) ----------

const adaptedPackageSchema = z.object({
  titleTarget: z.string().min(1).max(90),
  summaryTarget: z.string().min(3).max(260),
  concepts: z
    .array(
      z.object({
        conceptId: z.string().min(1),
        term: z.string().min(1).max(60),
        example: z.string().min(2).max(180),
        explanation: z.string().min(2).max(180),
        pronunciationGuide: z.string().max(60).optional(),
      })
    )
    .min(1),
});

export async function adaptPackageToLocale(input: {
  pkg: CmsLearningPackage;
  sourceLocale: string;
  targetLocale: string;
  connectionId?: string;
  modelOverride?: string;
}): Promise<{
  updated: CmsLearningPackage;
  providerUsed: string;
  modelUsed: string;
}> {
  const srcTitle =
    input.pkg.titles[input.sourceLocale] ||
    input.pkg.titles.en ||
    Object.values(input.pkg.titles)[0] ||
    input.pkg.id;
  const srcSummary =
    input.pkg.summaries[input.sourceLocale] ||
    input.pkg.summaries.en ||
    Object.values(input.pkg.summaries)[0] ||
    '';

  const sourceConcepts = input.pkg.concepts.map((c) => {
    const loc =
      c.localizations[input.sourceLocale] ||
      c.localizations.en ||
      Object.values(c.localizations)[0];
    return {
      conceptId: c.conceptId,
      term: loc?.term ?? c.conceptId,
      example: loc?.example ?? '',
      explanation: loc?.explanation ?? '',
    };
  });

  const systemPrompt =
    'You are an early-childhood (ages 3-5) multilingual localization specialist for TM-Lingo. Culturally adapt vocabulary and short sentences naturally into the target locale without changing conceptIds. Output ONLY valid JSON.';

  const userPrompt = `Adapt this early-childhood vocabulary package from "${input.sourceLocale}" into target locale "${input.targetLocale}".
Source Title: ${JSON.stringify(srcTitle)}
Source Summary: ${JSON.stringify(srcSummary)}
Source Concepts: ${JSON.stringify(sourceConcepts)}

Return JSON:
{
  "titleTarget": "short natural title in ${input.targetLocale}",
  "summaryTarget": "1 gentle sentence summary in ${input.targetLocale}",
  "concepts": [
    {
      "conceptId": "exact conceptId from source",
      "term": "natural word in ${input.targetLocale}",
      "example": "short child-friendly sentence in ${input.targetLocale}",
      "explanation": "simple warm description in ${input.targetLocale}",
      "pronunciationGuide": "optional easy phonetic guide"
    }
  ]
}`;

  const geminiSchema = {
    type: Type.OBJECT,
    properties: {
      titleTarget: { type: Type.STRING },
      summaryTarget: { type: Type.STRING },
      concepts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            conceptId: { type: Type.STRING },
            term: { type: Type.STRING },
            example: { type: Type.STRING },
            explanation: { type: Type.STRING },
            pronunciationGuide: { type: Type.STRING },
          },
        },
      },
    },
  };

  const { jsonText, providerUsed, modelUsed } = await runTextJsonCompletion({
    systemPrompt,
    userPrompt,
    connectionId: input.connectionId,
    modelOverride: input.modelOverride,
    geminiSchema,
  });

  const parsed = adaptedPackageSchema.parse(extractJsonObject(jsonText));
  const adaptedById = new Map(parsed.concepts.map((c) => [c.conceptId, c]));

  const updated: CmsLearningPackage = {
    ...input.pkg,
    learningLocales: Array.from(
      new Set([...input.pkg.learningLocales, input.targetLocale])
    ),
    explanationLocales: Array.from(
      new Set([...input.pkg.explanationLocales, input.targetLocale])
    ),
    titles: {
      ...input.pkg.titles,
      [input.targetLocale]: parsed.titleTarget,
    },
    summaries: {
      ...input.pkg.summaries,
      [input.targetLocale]: parsed.summaryTarget,
    },
    concepts: input.pkg.concepts.map((concept, idx) => {
      const match =
        adaptedById.get(concept.conceptId) ?? parsed.concepts[idx];
      if (!match) return concept;
      return {
        ...concept,
        localizations: {
          ...concept.localizations,
          [input.targetLocale]: {
            term: match.term,
            example: match.example,
            explanation: match.explanation,
            pronunciationGuide: match.pronunciationGuide || undefined,
          },
        },
      };
    }),
    updatedAt: new Date().toISOString(),
  };

  return { updated, providerUsed, modelUsed };
}

const adaptedStorySchema = z.object({
  titleTarget: z.string().min(1).max(100),
  summaryTarget: z.string().min(3).max(260),
  segments: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string().min(3).max(260),
        explanation: z.string().min(3).max(260),
      })
    )
    .min(1),
});

export async function adaptStoryToLocale(input: {
  story: StoryBook;
  sourceLocale: string;
  targetLocale: string;
  connectionId?: string;
  modelOverride?: string;
}): Promise<{
  updated: StoryBook;
  providerUsed: string;
  modelUsed: string;
}> {
  const srcTitle =
    input.story.titles[input.sourceLocale] ||
    input.story.titles.en ||
    Object.values(input.story.titles)[0] ||
    input.story.id;
  const srcSummary =
    input.story.summaries[input.sourceLocale] ||
    input.story.summaries.en ||
    Object.values(input.story.summaries)[0] ||
    '';

  const sourceSegments = input.story.segments.map((seg) => ({
    id: seg.id,
    text:
      seg.textByLocale[input.sourceLocale] ||
      seg.textByLocale.en ||
      Object.values(seg.textByLocale)[0] ||
      '',
    explanation:
      seg.explanationByLocale[input.sourceLocale] ||
      seg.explanationByLocale.en ||
      Object.values(seg.explanationByLocale)[0] ||
      '',
  }));

  const systemPrompt =
    'You are an early-childhood (ages 3-5) picture-book translator and adapter for TM-Lingo. Keep narration warm, gentle, natural, and concise in the target locale. Preserve exact segment IDs. Output ONLY valid JSON.';

  const userPrompt = `Adapt this picture-book story from "${input.sourceLocale}" into target locale "${input.targetLocale}".
Source Title: ${JSON.stringify(srcTitle)}
Source Summary: ${JSON.stringify(srcSummary)}
Source Segments: ${JSON.stringify(sourceSegments)}

Return JSON:
{
  "titleTarget": "natural title in ${input.targetLocale}",
  "summaryTarget": "1 gentle sentence summary in ${input.targetLocale}",
  "segments": [
    {
      "id": "exact segment id from source",
      "text": "natural 1-2 sentence narration in ${input.targetLocale}",
      "explanation": "gentle parent note in ${input.targetLocale}"
    }
  ]
}`;

  const geminiSchema = {
    type: Type.OBJECT,
    properties: {
      titleTarget: { type: Type.STRING },
      summaryTarget: { type: Type.STRING },
      segments: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING },
            explanation: { type: Type.STRING },
          },
        },
      },
    },
  };

  const { jsonText, providerUsed, modelUsed } = await runTextJsonCompletion({
    systemPrompt,
    userPrompt,
    connectionId: input.connectionId,
    modelOverride: input.modelOverride,
    geminiSchema,
  });

  const parsed = adaptedStorySchema.parse(extractJsonObject(jsonText));
  const segById = new Map(parsed.segments.map((s) => [s.id, s]));

  const updated: StoryBook = {
    ...input.story,
    availableLocales: Array.from(
      new Set([...input.story.availableLocales, input.targetLocale])
    ),
    availableExplanationLocales: Array.from(
      new Set([...input.story.availableExplanationLocales, input.targetLocale])
    ),
    titles: {
      ...input.story.titles,
      [input.targetLocale]: parsed.titleTarget,
    },
    summaries: {
      ...input.story.summaries,
      [input.targetLocale]: parsed.summaryTarget,
    },
    segments: input.story.segments.map((seg, idx) => {
      const match = segById.get(seg.id) ?? parsed.segments[idx];
      if (!match) return seg;
      return {
        ...seg,
        textByLocale: {
          ...seg.textByLocale,
          [input.targetLocale]: match.text,
        },
        explanationByLocale: {
          ...seg.explanationByLocale,
          [input.targetLocale]: match.explanation,
        },
      };
    }),
    updatedAt: new Date().toISOString(),
  };

  return { updated, providerUsed, modelUsed };
}

// ---------- Child Safety & Age-Readiness Review Provider ----------

const safetyReviewSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  ageReadiness: z.enum(['excellent', 'good', 'needs_revision']),
  summary: z.string().min(5).max(320),
  checks: z
    .array(
      z.object({
        criterion: z.string().min(2).max(80),
        passed: z.boolean(),
        note: z.string().min(2).max(200),
      })
    )
    .min(3)
    .max(6),
  suggestions: z.array(z.string().min(2).max(200)).max(5),
});

export async function runChildSafetyReview(input: {
  entityType: 'package' | 'story';
  item: CmsLearningPackage | StoryBook;
  responseLocale?: string;
  connectionId?: string;
  modelOverride?: string;
}): Promise<SafetyReviewResult> {
  const reportLang = input.responseLocale === 'vi' ? 'Vietnamese' : 'English';

  const systemPrompt = `You are a strict early-childhood (ages 3-5) child-safety and pedagogical reviewer for TM-Lingo.
Evaluate content on 4 criteria:
1. Child Safety & Gentle Tone (no fear, violence, shaming, or unsafe themes)
2. Age 3-5 Vocabulary Simplicity (concrete, everyday words)
3. Sentence Length & Calm Pacing (short, easy to speak aloud)
4. Multilingual Clarity & Alignment (translations match meaning naturally)
Write summary, check notes, and suggestions in ${reportLang}. Output ONLY valid JSON.`;

  const contentPayload =
    input.entityType === 'package'
      ? {
          kind: 'learning_package',
          titles: input.item.titles,
          summaries: input.item.summaries,
          concepts: (input.item as CmsLearningPackage).concepts.map((c) => ({
            conceptId: c.conceptId,
            localizations: c.localizations,
          })),
        }
      : {
          kind: 'picture_story',
          titles: input.item.titles,
          summaries: input.item.summaries,
          segments: (input.item as StoryBook).segments.map((s) => ({
            order: s.order,
            textByLocale: s.textByLocale,
            explanationByLocale: s.explanationByLocale,
          })),
        };

  const userPrompt = `Review this TM-Lingo ${input.entityType} for ages 3-5:\n${JSON.stringify(
    contentPayload
  )}`;

  const geminiSchema = {
    type: Type.OBJECT,
    properties: {
      passed: { type: Type.BOOLEAN },
      score: { type: Type.NUMBER },
      ageReadiness: { type: Type.STRING },
      summary: { type: Type.STRING },
      checks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            criterion: { type: Type.STRING },
            passed: { type: Type.BOOLEAN },
            note: { type: Type.STRING },
          },
        },
      },
      suggestions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
  };

  const { jsonText, providerUsed, modelUsed } = await runTextJsonCompletion({
    systemPrompt,
    userPrompt,
    connectionId: input.connectionId,
    modelOverride: input.modelOverride,
    geminiSchema,
  });

  const parsed = safetyReviewSchema.parse(extractJsonObject(jsonText));
  return {
    ...parsed,
    score: Math.round(parsed.score),
    providerUsed,
    modelUsed,
    reviewedAt: new Date().toISOString(),
  };
}

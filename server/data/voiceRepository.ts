import type { DeleteMode, VoiceProfile } from '../../packages/contracts/types';
import { getMongoCollection } from '../db/mongo';
import { VOICE_REGISTRY } from './seedStore';

const PROTECTED_CORE_VOICES = new Set([
  'voice-en-warm',
  'voice-vi-calm',
]);

const DEFAULT_VOICE_SEEDS: VoiceProfile[] = [
  ...VOICE_REGISTRY.map((v) => ({ ...v, archivedAt: null })),
  {
    voiceId: 'voice-gemini-kore',
    providerId: 'gemini-3.8-flash-lite-tts',
    supportedLocales: ['en', 'vi'],
    displayName: 'Kore (Gemini AI Warm Storyteller)',
    voiceStyleTags: ['warm', 'calm'],
    ageAppropriate: true,
    pitch: 1.0,
    defaultRate: 0.92,
    archivedAt: null,
  },
  {
    voiceId: 'voice-gemini-zephyr',
    providerId: 'gemini-3.8-flash-lite-tts',
    supportedLocales: ['en', 'vi'],
    displayName: 'Zephyr (Gemini AI Gentle Narrator)',
    voiceStyleTags: ['calm', 'teacher-like'],
    ageAppropriate: true,
    pitch: 1.0,
    defaultRate: 0.9,
    archivedAt: null,
  },
];

const memoryVoices = new Map<string, VoiceProfile>();
let mongoSeeded = false;

function initMemory(): void {
  if (memoryVoices.size === 0) {
    for (const voice of DEFAULT_VOICE_SEEDS) {
      memoryVoices.set(voice.voiceId, { ...voice, archivedAt: null });
    }
  }
}

async function ensureVoicesSeeded(): Promise<void> {
  initMemory();
  if (mongoSeeded) return;
  mongoSeeded = true;

  const col = await getMongoCollection<VoiceProfile>('voice_profiles');
  if (!col) return;
  const count = await col.estimatedDocumentCount();
  if (count === 0) {
    await col.insertMany(DEFAULT_VOICE_SEEDS.map((v) => ({ ...v })));
  }
}

export async function listVoices(options?: {
  locale?: string;
  includeArchived?: boolean;
}): Promise<VoiceProfile[]> {
  await ensureVoicesSeeded();
  const includeArchived = Boolean(options?.includeArchived);
  const locale = options?.locale?.trim().toLowerCase();
  const col = await getMongoCollection<VoiceProfile>('voice_profiles');

  let items: VoiceProfile[];
  if (col) {
    const filter = includeArchived
      ? {}
      : { $or: [{ archivedAt: null }, { archivedAt: { $exists: false } }] };
    items = await col
      .find(filter, { projection: { _id: 0 } })
      .sort({ voiceId: 1 })
      .toArray();
  } else {
    const all = Array.from(memoryVoices.values());
    items = includeArchived ? all : all.filter((v) => !v.archivedAt);
  }

  if (!locale) return items;
  return items.filter((voice) =>
    voice.supportedLocales.some((loc) =>
      loc.toLowerCase().startsWith(locale)
    )
  );
}

export async function getVoiceById(voiceId: string): Promise<VoiceProfile | null> {
  await ensureVoicesSeeded();
  const col = await getMongoCollection<VoiceProfile>('voice_profiles');
  if (col) {
    return col.findOne({ voiceId }, { projection: { _id: 0 } });
  }
  return memoryVoices.get(voiceId) ?? null;
}

export async function upsertVoiceProfile(
  input: VoiceProfile
): Promise<VoiceProfile> {
  await ensureVoicesSeeded();
  const normalized: VoiceProfile = {
    ...input,
    voiceId: input.voiceId.trim(),
    providerId: input.providerId.trim() || 'web-speech-adapter',
    displayName: input.displayName.trim(),
    supportedLocales: Array.from(
      new Set(
        input.supportedLocales
          .map((l) => l.trim())
          .filter(Boolean)
      )
    ),
    voiceStyleTags:
      input.voiceStyleTags.length > 0 ? input.voiceStyleTags : ['warm'],
    pitch: Math.max(0.5, Math.min(1.6, Number(input.pitch) || 1.0)),
    defaultRate: Math.max(0.5, Math.min(1.4, Number(input.defaultRate) || 0.9)),
    archivedAt: input.archivedAt ?? null,
  };

  memoryVoices.set(normalized.voiceId, normalized);
  const col = await getMongoCollection<VoiceProfile>('voice_profiles');
  if (col) {
    await col.updateOne(
      { voiceId: normalized.voiceId },
      { $set: normalized },
      { upsert: true }
    );
  }
  return normalized;
}

export async function deleteVoiceProfile(
  voiceId: string,
  mode: DeleteMode = 'soft'
): Promise<{ ok: boolean; mode: DeleteMode; voice?: VoiceProfile }> {
  await ensureVoicesSeeded();
  if (mode === 'hard' && PROTECTED_CORE_VOICES.has(voiceId)) {
    throw new Error(
      `Core starter voice "${voiceId}" cannot be permanently deleted. You may archive it instead.`
    );
  }

  const existing = await getVoiceById(voiceId);
  if (!existing) {
    return { ok: false, mode };
  }

  const col = await getMongoCollection<VoiceProfile>('voice_profiles');
  if (mode === 'hard') {
    memoryVoices.delete(voiceId);
    if (col) {
      await col.deleteOne({ voiceId });
    }
    return { ok: true, mode: 'hard' };
  }

  const archived: VoiceProfile = {
    ...existing,
    archivedAt: new Date().toISOString(),
  };
  memoryVoices.set(voiceId, archived);
  if (col) {
    await col.updateOne({ voiceId }, { $set: archived });
  }
  return { ok: true, mode: 'soft', voice: archived };
}

export async function restoreVoiceProfile(
  voiceId: string
): Promise<VoiceProfile | null> {
  await ensureVoicesSeeded();
  const existing = await getVoiceById(voiceId);
  if (!existing) return null;

  const restored: VoiceProfile = {
    ...existing,
    archivedAt: null,
  };
  memoryVoices.set(voiceId, restored);
  const col = await getMongoCollection<VoiceProfile>('voice_profiles');
  if (col) {
    await col.updateOne({ voiceId }, { $set: restored });
  }
  return restored;
}

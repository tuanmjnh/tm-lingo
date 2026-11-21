import type { DeleteMode, LocaleConfig } from '../../packages/contracts/types';
import { getMongoCollection } from '../db/mongo';
import { LANGUAGE_REGISTRY } from './seedStore';

const PROTECTED_LOCALES = new Set(['en', 'vi']);
const memoryLanguages = new Map<string, LocaleConfig>();
let mongoSeeded = false;

function initMemory(): void {
  if (memoryLanguages.size === 0) {
    for (const lang of LANGUAGE_REGISTRY) {
      memoryLanguages.set(lang.locale, { ...lang, archivedAt: null });
    }
  }
}

async function ensureLanguageSeeded(): Promise<void> {
  initMemory();
  if (mongoSeeded) return;
  mongoSeeded = true;

  const col = await getMongoCollection<LocaleConfig>('language_configs');
  if (!col) return;
  const count = await col.estimatedDocumentCount();
  if (count === 0) {
    await col.insertMany(
      LANGUAGE_REGISTRY.map((lang) => ({ ...lang, archivedAt: null }))
    );
  }
}

export async function listLanguages(options?: {
  includeArchived?: boolean;
}): Promise<LocaleConfig[]> {
  await ensureLanguageSeeded();
  const includeArchived = Boolean(options?.includeArchived);
  const col = await getMongoCollection<LocaleConfig>('language_configs');

  if (col) {
    const filter = includeArchived
      ? {}
      : { $or: [{ archivedAt: null }, { archivedAt: { $exists: false } }] };
    return col
      .find(filter, { projection: { _id: 0 } })
      .sort({ locale: 1 })
      .toArray();
  }

  const all = Array.from(memoryLanguages.values());
  return includeArchived ? all : all.filter((l) => !l.archivedAt);
}

export async function getLanguageByCode(
  locale: string
): Promise<LocaleConfig | null> {
  await ensureLanguageSeeded();
  const col = await getMongoCollection<LocaleConfig>('language_configs');
  if (col) {
    return col.findOne({ locale }, { projection: { _id: 0 } });
  }
  return memoryLanguages.get(locale) ?? null;
}

export async function upsertLanguageConfig(
  input: LocaleConfig
): Promise<LocaleConfig> {
  await ensureLanguageSeeded();
  const normalized: LocaleConfig = {
    ...input,
    locale: input.locale.trim(),
    languageCode: input.languageCode.trim() || input.locale.split('-')[0],
    displayName: input.displayName.trim(),
    nativeName: input.nativeName.trim(),
    archivedAt: input.archivedAt ?? null,
  };

  memoryLanguages.set(normalized.locale, normalized);
  const col = await getMongoCollection<LocaleConfig>('language_configs');
  if (col) {
    await col.updateOne(
      { locale: normalized.locale },
      { $set: normalized },
      { upsert: true }
    );
  }
  return normalized;
}

export async function deleteLanguageConfig(
  locale: string,
  mode: DeleteMode = 'soft'
): Promise<{ ok: boolean; mode: DeleteMode; language?: LocaleConfig }> {
  await ensureLanguageSeeded();
  if (mode === 'hard' && PROTECTED_LOCALES.has(locale)) {
    throw new Error(
      `Core locale "${locale}" cannot be permanently deleted. You may archive or disable it instead.`
    );
  }

  const existing = await getLanguageByCode(locale);
  if (!existing) {
    return { ok: false, mode };
  }

  const col = await getMongoCollection<LocaleConfig>('language_configs');

  if (mode === 'hard') {
    memoryLanguages.delete(locale);
    if (col) {
      await col.deleteOne({ locale });
    }
    return { ok: true, mode: 'hard' };
  }

  const archived: LocaleConfig = {
    ...existing,
    enabled: false,
    archivedAt: new Date().toISOString(),
  };
  memoryLanguages.set(locale, archived);
  if (col) {
    await col.updateOne({ locale }, { $set: archived });
  }
  return { ok: true, mode: 'soft', language: archived };
}

export async function restoreLanguageConfig(
  locale: string
): Promise<LocaleConfig | null> {
  await ensureLanguageSeeded();
  const existing = await getLanguageByCode(locale);
  if (!existing) return null;

  const restored: LocaleConfig = {
    ...existing,
    enabled: true,
    archivedAt: null,
  };
  memoryLanguages.set(locale, restored);
  const col = await getMongoCollection<LocaleConfig>('language_configs');
  if (col) {
    await col.updateOne({ locale }, { $set: restored });
  }
  return restored;
}

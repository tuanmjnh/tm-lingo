import path from 'node:path';
import type { MediaAssetRecord } from '../../packages/contracts/types';
import { getMongoCollection } from '../db/mongo';
import {
  deleteObjectFromStorage,
  getActiveStorageSummary,
  uploadObjectToActiveStorage,
} from '../providers/storageManager';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
]);

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const memoryAssets: Map<string, MediaAssetRecord> = new Map();

function sanitizeFilename(originalName: string): string {
  const ext = path
    .extname(originalName)
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '');
  const base = path
    .basename(originalName, path.extname(originalName))
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${base || 'media'}-${Date.now().toString(36)}${ext || ''}`;
}

export function resolveMediaKind(mimeType: string): 'image' | 'audio' | null {
  if (ALLOWED_IMAGE_TYPES.has(mimeType)) return 'image';
  if (ALLOWED_AUDIO_TYPES.has(mimeType)) return 'audio';
  return null;
}

export async function uploadLearningMedia(input: {
  parentAccountId: string;
  title: string;
  locale: string;
  fileBuffer: Buffer;
  originalName: string;
  mimeType: string;
}): Promise<MediaAssetRecord> {
  const kind = resolveMediaKind(input.mimeType);
  if (!kind) {
    throw new Error(
      'Unsupported file format. Please upload PNG/JPEG/WEBP images or MP3/WAV/OGG/M4A audio.'
    );
  }

  if (input.fileBuffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('File exceeds the 10MB maximum upload limit.');
  }

  const safeFile = sanitizeFilename(input.originalName);
  const relativeKey = `${kind}/${input.locale || 'en'}/${safeFile}`;

  const uploaded = await uploadObjectToActiveStorage({
    relativeKey,
    buffer: input.fileBuffer,
    contentType: input.mimeType,
  });

  const record: MediaAssetRecord = {
    id: `media-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    parentAccountId: input.parentAccountId,
    title: input.title.trim() || input.originalName,
    kind,
    locale: input.locale || 'en',
    mimeType: input.mimeType,
    sizeBytes: input.fileBuffer.byteLength,
    storageBucket: uploaded.bucket,
    storagePath: uploaded.objectKey,
    publicUrl: uploaded.publicUrl,
    storageProvider: uploaded.provider,
    storageConnectionId: uploaded.connectionId,
    createdAt: new Date().toISOString(),
  };

  memoryAssets.set(record.id, record);
  const col = await getMongoCollection<MediaAssetRecord>('media_assets');
  if (col) {
    await col.insertOne({ ...record });
  }

  return record;
}

export async function listLearningMedia(options?: {
  includeArchived?: boolean;
}): Promise<{
  assets: MediaAssetRecord[];
  bucket: string;
  provider: string;
}> {
  const includeArchived = Boolean(options?.includeArchived);
  const summary = await getActiveStorageSummary();
  const col = await getMongoCollection<MediaAssetRecord>('media_assets');
  if (col) {
    const filter = includeArchived
      ? {}
      : { $or: [{ archivedAt: null }, { archivedAt: { $exists: false } }] };
    const docs = await col
      .find(filter, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .limit(120)
      .toArray();
    return { assets: docs, bucket: summary.bucket, provider: summary.provider };
  }

  const assets = Array.from(memoryAssets.values())
    .filter((a) => includeArchived || !a.archivedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { assets, bucket: summary.bucket, provider: summary.provider };
}

export async function deleteLearningMedia(
  assetId: string,
  mode: 'soft' | 'hard' = 'soft'
): Promise<{ ok: boolean; mode: 'soft' | 'hard'; asset?: MediaAssetRecord }> {
  const col = await getMongoCollection<MediaAssetRecord>('media_assets');
  let target: MediaAssetRecord | null = null;

  if (col) {
    target = await col.findOne({ id: assetId }, { projection: { _id: 0 } });
  } else {
    target = memoryAssets.get(assetId) ?? null;
  }

  if (!target) return { ok: false, mode };

  if (mode === 'hard') {
    await deleteObjectFromStorage({
      storageConnectionId: target.storageConnectionId,
      storageBucket: target.storageBucket,
      storagePath: target.storagePath,
      storageProvider: target.storageProvider,
    });

    memoryAssets.delete(assetId);
    if (col) {
      await col.deleteOne({ id: assetId });
    }
    return { ok: true, mode: 'hard' };
  }

  // Soft delete / Archive: keep underlying object intact in R2/S3/local for instant restore
  const archived: MediaAssetRecord = {
    ...target,
    archivedAt: new Date().toISOString(),
  };
  memoryAssets.set(assetId, archived);
  if (col) {
    await col.updateOne(
      { id: assetId },
      { $set: { archivedAt: archived.archivedAt } }
    );
  }
  return { ok: true, mode: 'soft', asset: archived };
}

export async function restoreLearningMedia(
  assetId: string
): Promise<MediaAssetRecord | null> {
  const col = await getMongoCollection<MediaAssetRecord>('media_assets');
  const existing = col
    ? await col.findOne({ id: assetId }, { projection: { _id: 0 } })
    : memoryAssets.get(assetId) ?? null;

  if (!existing) return null;
  const restored: MediaAssetRecord = { ...existing, archivedAt: null };
  memoryAssets.set(assetId, restored);
  if (col) {
    await col.updateOne({ id: assetId }, { $set: { archivedAt: null } });
  }
  return restored;
}

export async function getStorageBucketName(): Promise<string> {
  const summary = await getActiveStorageSummary();
  return summary.bucket;
}

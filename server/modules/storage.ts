import path from 'node:path';
import type { MediaAssetRecord } from '../../packages/contracts/types';
import { getSupabaseAdmin } from '../auth/supabaseAuth';
import { getMongoCollection } from '../db/mongo';

const MEDIA_BUCKET = 'tm-lingo-media';
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

let bucketReady = false;
const memoryAssets: Map<string, MediaAssetRecord> = new Map();

function sanitizeFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '');
  const base = path
    .basename(originalName, path.extname(originalName))
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${base || 'media'}-${Date.now().toString(36)}${ext || ''}`;
}

async function ensureMediaBucket(): Promise<void> {
  if (bucketReady) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error('Supabase Storage is not configured on the server.');
  }

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`Unable to inspect Supabase Storage buckets: ${listError.message}`);
  }

  const exists = buckets?.some((b) => b.name === MEDIA_BUCKET);
  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(
      MEDIA_BUCKET,
      {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024,
      }
    );
    if (createError && !createError.message.toLowerCase().includes('already exists')) {
      throw new Error(`Unable to create storage bucket: ${createError.message}`);
    }
  }

  bucketReady = true;
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

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error('Supabase Storage is not configured.');
  }

  await ensureMediaBucket();

  const safeFile = sanitizeFilename(input.originalName);
  const storagePath = `${input.parentAccountId}/${kind}/${safeFile}`;

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, input.fileBuffer, {
      contentType: input.mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Supabase Storage upload failed: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(storagePath);

  const record: MediaAssetRecord = {
    id: `media-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    parentAccountId: input.parentAccountId,
    title: input.title.trim() || input.originalName,
    kind,
    locale: input.locale || 'en',
    mimeType: input.mimeType,
    sizeBytes: input.fileBuffer.byteLength,
    storageBucket: MEDIA_BUCKET,
    storagePath,
    publicUrl: publicUrlData.publicUrl,
    createdAt: new Date().toISOString(),
  };

  memoryAssets.set(record.id, record);
  const col = await getMongoCollection<MediaAssetRecord>('media_assets');
  if (col) {
    await col.insertOne({ ...record });
  }

  return record;
}

export async function listLearningMedia(): Promise<MediaAssetRecord[]> {
  const col = await getMongoCollection<MediaAssetRecord>('media_assets');
  if (col) {
    const docs = await col
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .limit(80)
      .toArray();
    return docs;
  }

  return Array.from(memoryAssets.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export async function deleteLearningMedia(assetId: string): Promise<boolean> {
  const col = await getMongoCollection<MediaAssetRecord>('media_assets');
  let target: MediaAssetRecord | null = null;

  if (col) {
    target = await col.findOne({ id: assetId }, { projection: { _id: 0 } });
  } else {
    target = memoryAssets.get(assetId) ?? null;
  }

  if (!target) return false;

  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase.storage
      .from(target.storageBucket || MEDIA_BUCKET)
      .remove([target.storagePath])
      .catch(() => undefined);
  }

  memoryAssets.delete(assetId);
  if (col) {
    await col.deleteOne({ id: assetId });
  }

  return true;
}

export function getStorageBucketName(): string {
  return MEDIA_BUCKET;
}

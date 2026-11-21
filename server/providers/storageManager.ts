import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { openSecret, sealSecret } from '@tuanmjnh/tm-ai-client';
import type {
  StorageConnectionView,
  StorageProviderKind,
} from '../../packages/contracts/types';
import { env, getMasterEncryptionKey } from '../config/env';
import { getMongoCollection } from '../db/mongo';

interface StoredStorageConnectionDoc {
  connectionId: string;
  name: string;
  provider: StorageProviderKind;
  endpoint: string;
  region: string;
  bucket: string;
  publicBaseUrl: string;
  pathPrefix: string;
  credentialsCipher: string;
  isDefault: boolean;
  enabled: boolean;
  lastTestOk: boolean | null;
  lastTestAt: string | null;
  lastTestMessage?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StorageCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

const memoryConnections: Map<string, StoredStorageConnectionDoc> = new Map();

function toPublicStorageView(
  doc: StoredStorageConnectionDoc
): StorageConnectionView {
  return {
    connectionId: doc.connectionId,
    name: doc.name,
    provider: doc.provider,
    endpoint: doc.endpoint,
    region: doc.region,
    bucket: doc.bucket,
    publicBaseUrl: doc.publicBaseUrl,
    pathPrefix: doc.pathPrefix,
    hasCredentials: Boolean(doc.credentialsCipher),
    isDefault: doc.isDefault,
    enabled: doc.enabled && !doc.archivedAt,
    lastTestOk: doc.lastTestOk,
    lastTestAt: doc.lastTestAt,
    lastTestMessage: doc.lastTestMessage ?? null,
    source: 'mongodb',
    archivedAt: doc.archivedAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function getEnvFallbackConfig(): {
  endpoint: string;
  region: string;
  bucket: string;
  publicBaseUrl: string;
  credentials: StorageCredentials;
} | null {
  const endpoint = env.OBJECT_STORAGE_ENDPOINT.trim();
  const bucket = env.OBJECT_STORAGE_BUCKET.trim();
  const accessKeyId = env.OBJECT_STORAGE_ACCESS_KEY.trim();
  const secretAccessKey = env.OBJECT_STORAGE_SECRET_KEY.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;

  return {
    endpoint,
    region: env.OBJECT_STORAGE_REGION.trim() || 'auto',
    bucket,
    publicBaseUrl:
      env.OBJECT_STORAGE_PUBLIC_BASE_URL.trim() ||
      `${endpoint.replace(/\/+$/, '')}/${bucket}`,
    credentials: { accessKeyId, secretAccessKey },
  };
}

async function listStoredDocs(): Promise<StoredStorageConnectionDoc[]> {
  const col = await getMongoCollection<StoredStorageConnectionDoc>(
    'storage_connections'
  );
  if (col) {
    return col
      .find({}, { projection: { _id: 0 } })
      .sort({ isDefault: -1, createdAt: 1 })
      .toArray();
  }
  return Array.from(memoryConnections.values()).sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export async function listStorageConnections(options?: {
  includeArchived?: boolean;
}): Promise<{
  connections: StorageConnectionView[];
  envFallbackAvailable: boolean;
  envFallbackBucket: string | null;
}> {
  const includeArchived = Boolean(options?.includeArchived);
  const docs = (await listStoredDocs()).filter(
    (d) => includeArchived || !d.archivedAt
  );
  const envFallback = getEnvFallbackConfig();
  return {
    connections: docs.map(toPublicStorageView),
    envFallbackAvailable: Boolean(envFallback),
    envFallbackBucket: envFallback?.bucket ?? null,
  };
}

export async function upsertStorageConnection(input: {
  connectionId?: string;
  name: string;
  provider: StorageProviderKind;
  endpoint: string;
  region?: string;
  bucket: string;
  publicBaseUrl?: string;
  pathPrefix?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  isDefault?: boolean;
  enabled?: boolean;
}): Promise<StorageConnectionView> {
  const col = await getMongoCollection<StoredStorageConnectionDoc>(
    'storage_connections'
  );
  const existingDocs = await listStoredDocs();
  const connectionId =
    input.connectionId?.trim() ||
    `storage-${input.provider.replace(/_/g, '-')}-${Date.now().toString(36)}`;
  const existing = existingDocs.find((d) => d.connectionId === connectionId);

  let credentialsCipher = existing?.credentialsCipher ?? '';
  if (input.accessKeyId?.trim() && input.secretAccessKey?.trim()) {
    const payload: StorageCredentials = {
      accessKeyId: input.accessKeyId.trim(),
      secretAccessKey: input.secretAccessKey.trim(),
    };
    credentialsCipher = await sealSecret(
      getMasterEncryptionKey(),
      JSON.stringify(payload)
    );
  }

  const shouldBeDefault =
    input.isDefault ??
    (existing ? existing.isDefault : existingDocs.length === 0);

  const now = new Date().toISOString();
  const cleanEndpoint = input.endpoint.trim().replace(/\/+$/, '');
  const cleanBucket = input.bucket.trim();
  const cleanPublicBase =
    input.publicBaseUrl?.trim().replace(/\/+$/, '') ||
    `${cleanEndpoint}/${cleanBucket}`;

  const doc: StoredStorageConnectionDoc = {
    connectionId,
    name: input.name.trim() || `${input.provider} (${cleanBucket})`,
    provider: input.provider,
    endpoint: cleanEndpoint,
    region: input.region?.trim() || (input.provider === 'cloudflare_r2' ? 'auto' : 'us-east-1'),
    bucket: cleanBucket,
    publicBaseUrl: cleanPublicBase,
    pathPrefix: (input.pathPrefix ?? existing?.pathPrefix ?? 'media')
      .trim()
      .replace(/^\/+|\/+$/g, ''),
    credentialsCipher,
    isDefault: shouldBeDefault,
    enabled: input.enabled ?? true,
    lastTestOk: existing?.lastTestOk ?? null,
    lastTestAt: existing?.lastTestAt ?? null,
    lastTestMessage: existing?.lastTestMessage ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (shouldBeDefault) {
    for (const item of memoryConnections.values()) {
      item.isDefault = false;
    }
    if (col) {
      await col.updateMany(
        { connectionId: { $ne: connectionId } },
        { $set: { isDefault: false } }
      );
    }
  }

  memoryConnections.set(connectionId, doc);
  if (col) {
    await col.updateOne(
      { connectionId },
      { $set: doc },
      { upsert: true }
    );
  }

  return toPublicStorageView(doc);
}

export async function deleteStorageConnection(
  connectionId: string,
  mode: 'soft' | 'hard' = 'soft'
): Promise<{ ok: boolean; mode: 'soft' | 'hard'; connection?: StorageConnectionView }> {
  const col = await getMongoCollection<StoredStorageConnectionDoc>(
    'storage_connections'
  );

  if (mode === 'hard') {
    const localDeleted = memoryConnections.delete(connectionId);
    if (col) {
      const res = await col.deleteOne({ connectionId });
      return { ok: res.deletedCount > 0 || localDeleted, mode: 'hard' };
    }
    return { ok: localDeleted, mode: 'hard' };
  }

  const docs = await listStoredDocs();
  const existing = docs.find((d) => d.connectionId === connectionId);
  if (!existing) return { ok: false, mode: 'soft' };

  const now = new Date().toISOString();
  const archived: StoredStorageConnectionDoc = {
    ...existing,
    isDefault: false,
    enabled: false,
    archivedAt: now,
    updatedAt: now,
  };
  memoryConnections.set(connectionId, archived);
  if (col) {
    await col.updateOne(
      { connectionId },
      { $set: { isDefault: false, enabled: false, archivedAt: now, updatedAt: now } }
    );
  }
  return { ok: true, mode: 'soft', connection: toPublicStorageView(archived) };
}

export async function restoreStorageConnection(
  connectionId: string
): Promise<StorageConnectionView | null> {
  const docs = await listStoredDocs();
  const existing = docs.find((d) => d.connectionId === connectionId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const restored: StoredStorageConnectionDoc = {
    ...existing,
    enabled: true,
    archivedAt: null,
    updatedAt: now,
  };
  memoryConnections.set(connectionId, restored);
  const col = await getMongoCollection<StoredStorageConnectionDoc>(
    'storage_connections'
  );
  if (col) {
    await col.updateOne(
      { connectionId },
      { $set: { enabled: true, archivedAt: null, updatedAt: now } }
    );
  }
  return toPublicStorageView(restored);
}

export async function setDefaultStorageConnection(
  connectionId: string
): Promise<StorageConnectionView | null> {
  const docs = await listStoredDocs();
  const target = docs.find((d) => d.connectionId === connectionId);
  if (!target) return null;

  const now = new Date().toISOString();
  for (const item of memoryConnections.values()) {
    item.isDefault = item.connectionId === connectionId;
    if (item.isDefault) item.updatedAt = now;
  }

  const col = await getMongoCollection<StoredStorageConnectionDoc>(
    'storage_connections'
  );
  if (col) {
    await col.updateMany({}, { $set: { isDefault: false } });
    await col.updateOne(
      { connectionId },
      { $set: { isDefault: true, updatedAt: now } }
    );
  }

  return toPublicStorageView({ ...target, isDefault: true, updatedAt: now });
}

function buildS3Client(cfg: {
  endpoint: string;
  region: string;
  credentials: StorageCredentials;
}): S3Client {
  return new S3Client({
    region: cfg.region || 'auto',
    endpoint: cfg.endpoint,
    forcePathStyle: true,
    credentials: cfg.credentials,
  });
}

async function openStorageCredentials(
  doc: StoredStorageConnectionDoc
): Promise<StorageCredentials> {
  if (!doc.credentialsCipher) {
    throw new Error('Storage connection has no saved access keys.');
  }
  const plain = await openSecret(getMasterEncryptionKey(), doc.credentialsCipher);
  const parsed = JSON.parse(plain) as Partial<StorageCredentials>;
  if (!parsed.accessKeyId || !parsed.secretAccessKey) {
    throw new Error('Stored storage credentials are incomplete.');
  }
  return {
    accessKeyId: parsed.accessKeyId,
    secretAccessKey: parsed.secretAccessKey,
  };
}

export async function testStorageConnection(connectionId: string): Promise<{
  ok: boolean;
  message: string;
  testedAt: string;
}> {
  const docs = await listStoredDocs();
  const doc = docs.find((d) => d.connectionId === connectionId);
  const now = new Date().toISOString();
  if (!doc) {
    return {
      ok: false,
      message: `Storage connection "${connectionId}" not found.`,
      testedAt: now,
    };
  }

  let ok = false;
  let message = '';

  try {
    const credentials = await openStorageCredentials(doc);
    const s3 = buildS3Client({
      endpoint: doc.endpoint,
      region: doc.region,
      credentials,
    });
    await s3.send(new HeadBucketCommand({ Bucket: doc.bucket }));
    ok = true;
    message = `Bucket "${doc.bucket}" is reachable and ready.`;
  } catch (err) {
    ok = false;
    message =
      err instanceof Error ? err.message : 'Unable to reach storage bucket';
  }

  doc.lastTestOk = ok;
  doc.lastTestAt = now;
  doc.lastTestMessage = message;
  doc.updatedAt = now;
  memoryConnections.set(connectionId, doc);

  const col = await getMongoCollection<StoredStorageConnectionDoc>(
    'storage_connections'
  );
  if (col) {
    await col.updateOne(
      { connectionId },
      {
        $set: {
          lastTestOk: ok,
          lastTestAt: now,
          lastTestMessage: message,
          updatedAt: now,
        },
      }
    );
  }

  return { ok, message, testedAt: now };
}

export async function getActiveStorageSummary(): Promise<{
  bucket: string;
  provider: string;
  connectionId?: string;
}> {
  const docs = (await listStoredDocs()).filter((d) => d.enabled && !d.archivedAt);
  const active = docs.find((d) => d.isDefault) ?? docs[0];
  if (active) {
    return {
      bucket: active.bucket,
      provider: active.provider,
      connectionId: active.connectionId,
    };
  }
  const envCfg = getEnvFallbackConfig();
  if (envCfg) {
    return {
      bucket: envCfg.bucket,
      provider: 's3_env_fallback',
    };
  }
  return {
    bucket: 'local-public',
    provider: 'local-public',
  };
}

export async function uploadObjectToActiveStorage(input: {
  relativeKey: string;
  buffer: Buffer;
  contentType: string;
}): Promise<{
  bucket: string;
  objectKey: string;
  publicUrl: string;
  provider: string;
  connectionId?: string;
}> {
  const docs = (await listStoredDocs()).filter((d) => d.enabled && !d.archivedAt);
  const active = docs.find((d) => d.isDefault) ?? docs[0];

  if (active) {
    const credentials = await openStorageCredentials(active);
    const s3 = buildS3Client({
      endpoint: active.endpoint,
      region: active.region,
      credentials,
    });
    const objectKey = active.pathPrefix
      ? `${active.pathPrefix}/${input.relativeKey}`
      : input.relativeKey;

    await s3.send(
      new PutObjectCommand({
        Bucket: active.bucket,
        Key: objectKey,
        Body: input.buffer,
        ContentType: input.contentType,
      })
    );

    const publicUrl = `${active.publicBaseUrl.replace(/\/+$/, '')}/${objectKey}`;
    return {
      bucket: active.bucket,
      objectKey,
      publicUrl,
      provider: active.provider,
      connectionId: active.connectionId,
    };
  }

  const envCfg = getEnvFallbackConfig();
  if (envCfg) {
    const s3 = buildS3Client(envCfg);
    const objectKey = `media/${input.relativeKey}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: envCfg.bucket,
        Key: objectKey,
        Body: input.buffer,
        ContentType: input.contentType,
      })
    );
    const publicUrl = `${envCfg.publicBaseUrl.replace(/\/+$/, '')}/${objectKey}`;
    return {
      bucket: envCfg.bucket,
      objectKey,
      publicUrl,
      provider: 's3_env_fallback',
    };
  }

  // Local public/uploads fallback so local development & CMS testing works even before R2 credentials are entered
  const safePath = input.relativeKey.replace(/\.\./g, '').replace(/^\/+/, '');
  const diskTarget = path.resolve(process.cwd(), 'public', 'uploads', safePath);
  await fs.mkdir(path.dirname(diskTarget), { recursive: true });
  await fs.writeFile(diskTarget, input.buffer);

  return {
    bucket: 'local-public',
    objectKey: `uploads/${safePath}`,
    publicUrl: `/uploads/${safePath}`,
    provider: 'local-public',
  };
}

export async function deleteObjectFromStorage(input: {
  storageConnectionId?: string;
  storageBucket: string;
  storagePath: string;
  storageProvider?: string;
}): Promise<void> {
  if (input.storageProvider === 'local-public' || input.storageBucket === 'local-public') {
    const cleanRel = input.storagePath.replace(/^uploads\//, '').replace(/\.\./g, '');
    const diskPath = path.resolve(process.cwd(), 'public', 'uploads', cleanRel);
    await fs.unlink(diskPath).catch(() => undefined);
    return;
  }

  const docs = await listStoredDocs();
  const targetDoc =
    (input.storageConnectionId
      ? docs.find((d) => d.connectionId === input.storageConnectionId)
      : docs.find((d) => d.bucket === input.storageBucket)) ?? null;

  if (targetDoc) {
    try {
      const credentials = await openStorageCredentials(targetDoc);
      const s3 = buildS3Client({
        endpoint: targetDoc.endpoint,
        region: targetDoc.region,
        credentials,
      });
      await s3.send(
        new DeleteObjectCommand({
          Bucket: targetDoc.bucket,
          Key: input.storagePath,
        })
      );
      return;
    } catch {
      return;
    }
  }

  const envCfg = getEnvFallbackConfig();
  if (envCfg) {
    try {
      const s3 = buildS3Client(envCfg);
      await s3.send(
        new DeleteObjectCommand({
          Bucket: input.storageBucket || envCfg.bucket,
          Key: input.storagePath,
        })
      );
    } catch {
      // non-blocking delete
    }
  }
}

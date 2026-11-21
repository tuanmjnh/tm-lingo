import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

function loadDotEnvFile(filename: string): void {
  const filePath = path.resolve(process.cwd(), filename);
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf-8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Never overwrite non-empty variables already provided by the host/secret manager
    if (!process.env[key]?.trim() && value) {
      process.env[key] = value;
    }
  }
}

// Load .env.local first (higher precedence for local overrides), then .env
loadDotEnvFile('.env.local');
loadDotEnvFile('.env');

const DEFAULT_DEV_SESSION_SECRET = 'tm-lingo-local-dev-session-secret';

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_BASE_URL: z.string().default('http://localhost:3000'),

  // MongoDB primary data store
  MONGODB_URI: z.string().default(''),
  MONGODB_DATABASE: z.string().default('tm_lingo'),

  // AES-256-GCM master secret for self-managed AI & Storage providers
  AI_CONFIG_SECRET: z.string().default(''),

  // TM-Hub Control Plane (Staff IAM, RBAC, Users, Audit Logs)
  AUTH_PROVIDER: z.string().default('hub'),
  HUB_BASE_URL: z.string().default(''),
  HUB_APP_ID: z.string().default('tm-lingo'),
  HUB_DEVICE_ID: z.string().default(''),
  HUB_DEVICE_SECRET: z.string().default(''),
  HUB_APP_SECRET: z.string().default(''),
  AUTH_JWT_SECRET: z.string().default(''),

  // Local dev staff fallback (only used when HUB_BASE_URL is not configured)
  SEED_ROOT_EMAIL: z.string().default('root@tm-lingo.app'),
  SEED_ROOT_PASSWORD: z.string().default(''),
  SEED_ADMIN_EMAIL: z.string().default('admin@tm-lingo.app'),
  SEED_ADMIN_PASSWORD: z.string().default('TmLingoAdmin#2026'),

  // Firebase optional client VAPID key
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: z.string().default(''),

  // Server-side Gemini API fallback
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_TEXT_MODEL: z.string().default('gemini-4-hydrogen'),
  GEMINI_IMAGE_MODEL: z.string().default('gemini-3.1-flash-lite-image'),
  GEMINI_TTS_MODEL: z.string().default('gemini-3.8-flash-lite-tts'),

  // Object Storage (Cloudflare R2 / S3-compatible) env fallback
  OBJECT_STORAGE_ENDPOINT: z.string().default(''),
  OBJECT_STORAGE_REGION: z.string().default('auto'),
  OBJECT_STORAGE_BUCKET: z.string().default(''),
  OBJECT_STORAGE_ACCESS_KEY: z.string().default(''),
  OBJECT_STORAGE_SECRET_KEY: z.string().default(''),
  OBJECT_STORAGE_PUBLIC_BASE_URL: z.string().default(''),

  // Standard W3C Web Push (VAPID)
  VAPID_SUBJECT: z.string().default('mailto:admin@tm-lingo.local'),
  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),

  SESSION_SECRET: z.string().default(DEFAULT_DEV_SESSION_SECRET),
});

const rawEnv = {
  ...process.env,
  AUTH_PROVIDER:
    process.env.AUTH_PROVIDER ||
    process.env.NEXT_PUBLIC_AUTH_PROVIDER ||
    'hub',
  HUB_BASE_URL:
    process.env.HUB_BASE_URL ||
    process.env.HUB_URL ||
    process.env.VITE_PUBLIC_HUB_URL ||
    process.env.NEXT_PUBLIC_HUB_URL ||
    process.env.NUXT_PUBLIC_HUB_URL ||
    '',
  HUB_APP_ID:
    process.env.HUB_APP_ID ||
    process.env.VITE_PUBLIC_HUB_APP_ID ||
    process.env.NEXT_PUBLIC_HUB_APP_ID ||
    process.env.NUXT_PUBLIC_HUB_APP_ID ||
    process.env.APP_ID ||
    'tm-lingo',
  HUB_APP_SECRET:
    process.env.HUB_APP_SECRET ||
    process.env.VITE_HUB_APP_SECRET ||
    process.env.NUXT_HUB_APP_SECRET ||
    '',
  AUTH_JWT_SECRET:
    process.env.AUTH_JWT_SECRET ||
    '',
  NEXT_PUBLIC_FIREBASE_VAPID_KEY:
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
    process.env.VITE_FIREBASE_VAPID_KEY ||
    '',
};

const parsed = serverEnvSchema.safeParse(rawEnv);
if (!parsed.success) {
  console.warn(
    'Warning: Server environment configuration validation failed:',
    parsed.error.flatten().fieldErrors
  );
}

export const env = parsed.success
  ? parsed.data
  : (serverEnvSchema.parse({}) as z.infer<typeof serverEnvSchema>);

/**
 * Returns a valid 32-byte Uint8Array AES-256-GCM key for encrypting AI & Storage credentials.
 * Uses AI_CONFIG_SECRET when set (32-byte base64 or SHA-256 derived), falling back to SESSION_SECRET.
 */
export function getMasterEncryptionKey(): Uint8Array {
  const configured = env.AI_CONFIG_SECRET.trim();
  if (configured) {
    try {
      const decoded = Buffer.from(configured, 'base64');
      if (decoded.byteLength === 32) {
        return new Uint8Array(decoded);
      }
    } catch {
      // fall through to deterministic SHA-256 derivation
    }
    return new Uint8Array(crypto.createHash('sha256').update(configured).digest());
  }
  const fallbackSeed = env.SESSION_SECRET.trim() || DEFAULT_DEV_SESSION_SECRET;
  return new Uint8Array(
    crypto.createHash('sha256').update(`tm-lingo-config:${fallbackSeed}`).digest()
  );
}

export function isTmHubConfigured(): boolean {
  if (env.AUTH_PROVIDER && env.AUTH_PROVIDER !== 'hub') {
    return false;
  }
  return Boolean(env.HUB_BASE_URL.trim());
}

export function getRuntimeEnvironmentSummary(mongoStatus?: {
  connected: boolean;
  lastError: string | null;
}) {
  const firebaseConfigPath = path.resolve(
    process.cwd(),
    'firebase-applet-config.json'
  );
  const firebaseConfigured = fs.existsSync(firebaseConfigPath);
  const has = (val: string) => Boolean(val && val.trim().length > 0);
  const mongodbConfigured = has(env.MONGODB_URI);
  const tmHubConfigured = isTmHubConfigured();
  const objectStorageConfigured =
    has(env.OBJECT_STORAGE_ENDPOINT) &&
    has(env.OBJECT_STORAGE_BUCKET) &&
    has(env.OBJECT_STORAGE_ACCESS_KEY) &&
    has(env.OBJECT_STORAGE_SECRET_KEY);

  return {
    nodeEnv: env.NODE_ENV,
    appBaseUrl: env.APP_BASE_URL,
    activeStack: {
      parentAuth: firebaseConfigured ? 'firebase-auth' : 'guest-local',
      staffAuth: tmHubConfigured ? 'tm-hub-iam' : 'local-staff-dev',
      storage: objectStorageConfigured ? 's3-r2-env' : 'self-managed-mongodb',
      ai: 'self-managed-tm-ai-client',
      database: mongodbConfigured
        ? mongoStatus?.connected
          ? 'mongodb-connected'
          : 'mongodb-configured'
        : 'in-memory',
      push: 'w3c-web-push',
    },
    databaseMode: mongodbConfigured ? 'mongodb' : 'in-memory',
    databaseName: env.MONGODB_DATABASE,
    providers: {
      mongodbConfigured,
      mongodbConnected: mongoStatus?.connected ?? false,
      firebaseConfigured,
      authProvider: env.AUTH_PROVIDER,
      tmHubConfigured,
      hubBaseUrl: env.HUB_BASE_URL,
      hubAppId: env.HUB_APP_ID,
      hubAppSecretConfigured: has(env.HUB_APP_SECRET),
      authJwtSecretConfigured: has(env.AUTH_JWT_SECRET),
      aiConfigSecretConfigured: has(env.AI_CONFIG_SECRET),
      webPushConfigured: has(env.VAPID_PUBLIC_KEY) && has(env.VAPID_PRIVATE_KEY),
      geminiConfigured: has(env.GEMINI_API_KEY),
      geminiModels: {
        text: env.GEMINI_TEXT_MODEL,
        image: env.GEMINI_IMAGE_MODEL,
        tts: env.GEMINI_TTS_MODEL,
      },
      objectStorageConfigured,
    },
    configuredKeys: {
      APP_BASE_URL: has(env.APP_BASE_URL),
      FIREBASE_APPLET_CONFIG: firebaseConfigured,
      AUTH_PROVIDER: has(env.AUTH_PROVIDER),
      HUB_BASE_URL: tmHubConfigured,
      HUB_APP_ID: has(env.HUB_APP_ID),
      HUB_DEVICE_CREDENTIAL: has(env.HUB_DEVICE_ID) && has(env.HUB_DEVICE_SECRET),
      HUB_APP_SECRET: has(env.HUB_APP_SECRET),
      AUTH_JWT_SECRET: has(env.AUTH_JWT_SECRET),
      AI_CONFIG_SECRET: has(env.AI_CONFIG_SECRET),
      VAPID_SUBJECT: has(env.VAPID_SUBJECT),
      VAPID_PUBLIC_KEY: has(env.VAPID_PUBLIC_KEY),
      VAPID_PRIVATE_KEY: has(env.VAPID_PRIVATE_KEY),
      MONGODB_URI: has(env.MONGODB_URI),
      MONGODB_DATABASE: has(env.MONGODB_DATABASE),
      GEMINI_API_KEY: has(env.GEMINI_API_KEY),
      OBJECT_STORAGE_ENDPOINT: has(env.OBJECT_STORAGE_ENDPOINT),
      OBJECT_STORAGE_BUCKET: has(env.OBJECT_STORAGE_BUCKET),
      OBJECT_STORAGE_ACCESS_KEY: has(env.OBJECT_STORAGE_ACCESS_KEY),
      OBJECT_STORAGE_SECRET_KEY: has(env.OBJECT_STORAGE_SECRET_KEY),
      OBJECT_STORAGE_PUBLIC_BASE_URL: has(env.OBJECT_STORAGE_PUBLIC_BASE_URL),
      SESSION_SECRET:
        has(env.SESSION_SECRET) &&
        env.SESSION_SECRET.trim() !== DEFAULT_DEV_SESSION_SECRET,
    },
  };
}

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env.local first (higher precedence for local overrides), then .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const EPHEMERAL_SESSION_FALLBACK = crypto.randomBytes(32).toString('hex');

const serverEnvSchema = z.object({
  // Runtime
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_BASE_URL: z.string().default('http://localhost:3000'),
  CAPACITOR_SERVER_URL: z.string().default('https://app.tm-lingo.app'),

  // Client
  VITE_APP_NAME: z.string().default('TM-Lingo'),
  VITE_DEFAULT_INTERFACE_LOCALE: z.string().default('vi'),
  VITE_DEFAULT_LEARNING_LOCALE: z.string().default('en'),

  // MongoDB Primary Application Database
  MONGODB_URI: z.string().default(''),
  MONGODB_DATABASE: z.string().default('tm_lingo'),

  // Supabase Auth & Storage (optional)
  VITE_SUPABASE_URL: z.string().default(''),
  VITE_SUPABASE_ANON_KEY: z.string().default(''),
  SUPABASE_URL: z.string().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),

  // AES-256-GCM master secret for self-managed AI & Storage providers
  AI_CONFIG_SECRET: z.string().default(''),

  // TM-Hub Control Plane (Staff IAM, RBAC, Users, Audit Logs)
  AUTH_PROVIDER: z.string().default('hub'),
  VITE_PUBLIC_HUB_URL: z.string().default(''),
  VITE_PUBLIC_HUB_APP_ID: z.string().default('tm-lingo'),
  VITE_HUB_APP_SECRET: z.string().default(''),
  AUTH_JWT_SECRET: z.string().default(''),

  // Hub legacy compatibility keys
  HUB_BASE_URL: z.string().default(''),
  HUB_APP_ID: z.string().default('tm-lingo'),
  HUB_APP_SECRET: z.string().default(''),
  HUB_DEVICE_ID: z.string().default(''),
  HUB_DEVICE_SECRET: z.string().default(''),

  // Firebase optional client VAPID key
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: z.string().default(''),

  // Server-side Gemini AI
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_TEXT_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_IMAGE_MODEL: z.string().default('gemini-2.5-flash-image'),
  GEMINI_TTS_MODEL: z.string().default('gemini-2.5-flash-preview-tts'),

  // Object Storage (Cloudflare R2 / S3-compatible)
  OBJECT_STORAGE_ENDPOINT: z.string().default(''),
  OBJECT_STORAGE_REGION: z.string().default('auto'),
  OBJECT_STORAGE_BUCKET: z.string().default('assets'),
  OBJECT_STORAGE_ACCESS_KEY: z.string().default(''),
  OBJECT_STORAGE_SECRET_KEY: z.string().default(''),
  OBJECT_STORAGE_PUBLIC_BASE_URL: z.string().default(''),

  // Standard W3C Web Push (VAPID)
  VAPID_SUBJECT: z.string().default('mailto:admin@tm-lingo.local'),
  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),

  // Session Signing Secret
  SESSION_SECRET: z.string().default(''),
});

const hubUrl =
  process.env.VITE_PUBLIC_HUB_URL ||
  process.env.NEXT_PUBLIC_HUB_URL ||
  process.env.HUB_BASE_URL ||
  process.env.HUB_URL ||
  process.env.NUXT_PUBLIC_HUB_URL ||
  '';

const hubAppId =
  process.env.VITE_PUBLIC_HUB_APP_ID ||
  process.env.NEXT_PUBLIC_HUB_APP_ID ||
  process.env.HUB_APP_ID ||
  process.env.NUXT_PUBLIC_HUB_APP_ID ||
  process.env.APP_ID ||
  'tm-lingo';

const hubAppSecret =
  process.env.VITE_HUB_APP_SECRET ||
  process.env.HUB_APP_SECRET ||
  process.env.NUXT_HUB_APP_SECRET ||
  '';

const rawEnv = {
  ...process.env,
  AUTH_PROVIDER:
    process.env.AUTH_PROVIDER ||
    process.env.NEXT_PUBLIC_AUTH_PROVIDER ||
    'hub',
  VITE_PUBLIC_HUB_URL: hubUrl,
  VITE_PUBLIC_HUB_APP_ID: hubAppId,
  VITE_HUB_APP_SECRET: hubAppSecret,
  HUB_BASE_URL: hubUrl,
  HUB_APP_ID: hubAppId,
  HUB_APP_SECRET: hubAppSecret,
  AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET || '',
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
 * Derived from AUTH_JWT_SECRET, AI_CONFIG_SECRET, or SESSION_SECRET.
 */
export function getMasterEncryptionKey(): Uint8Array {
  const seed =
    env.AUTH_JWT_SECRET.trim() ||
    env.AI_CONFIG_SECRET.trim() ||
    env.SESSION_SECRET.trim() ||
    EPHEMERAL_SESSION_FALLBACK;

  if (env.AI_CONFIG_SECRET.trim()) {
    try {
      const decoded = Buffer.from(env.AI_CONFIG_SECRET.trim(), 'base64');
      if (decoded.byteLength === 32) {
        return new Uint8Array(decoded);
      }
    } catch {
      // fall through
    }
  }

  return new Uint8Array(
    crypto.createHash('sha256').update(`tm-lingo-config:${seed}`).digest()
  );
}

export function isTmHubConfigured(): boolean {
  if (env.AUTH_PROVIDER && env.AUTH_PROVIDER !== 'hub') {
    return false;
  }
  return Boolean(env.VITE_PUBLIC_HUB_URL.trim() || env.HUB_BASE_URL.trim());
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
  const supabaseConfigured =
    has(env.SUPABASE_URL) || has(env.VITE_SUPABASE_URL);
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
      supabaseConfigured,
      authProvider: env.AUTH_PROVIDER,
      tmHubConfigured,
      hubBaseUrl: env.HUB_BASE_URL || env.VITE_PUBLIC_HUB_URL,
      hubAppId: env.HUB_APP_ID || env.VITE_PUBLIC_HUB_APP_ID,
      hubAppSecretConfigured: has(env.HUB_APP_SECRET || env.VITE_HUB_APP_SECRET),
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
      HUB_APP_ID: has(env.HUB_APP_ID || env.VITE_PUBLIC_HUB_APP_ID),
      HUB_DEVICE_CREDENTIAL: has(env.HUB_DEVICE_ID) && has(env.HUB_DEVICE_SECRET),
      HUB_APP_SECRET: has(env.HUB_APP_SECRET || env.VITE_HUB_APP_SECRET),
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
      SESSION_SECRET: has(env.SESSION_SECRET),
    },
  };
}

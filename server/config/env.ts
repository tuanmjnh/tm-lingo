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

  VITE_FIREBASE_PROJECT_ID: z.string().default(''),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().default(''),
  VITE_FIREBASE_APP_ID: z.string().default(''),
  VITE_FIREBASE_VAPID_KEY: z.string().default(''),

  MONGODB_URI: z.string().default(''),
  MONGODB_DATABASE: z.string().default('tm_lingo'),

  VITE_SUPABASE_URL: z.string().default(''),
  VITE_SUPABASE_ANON_KEY: z.string().default(''),
  SUPABASE_URL: z.string().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),

  GEMINI_API_KEY: z.string().default(''),
  GEMINI_TEXT_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_IMAGE_MODEL: z.string().default('gemini-2.5-flash-image'),
  GEMINI_TTS_MODEL: z.string().default('gemini-2.5-flash-preview-tts'),

  OBJECT_STORAGE_ENDPOINT: z.string().default(''),
  OBJECT_STORAGE_BUCKET: z.string().default(''),
  OBJECT_STORAGE_ACCESS_KEY: z.string().default(''),
  OBJECT_STORAGE_SECRET_KEY: z.string().default(''),

  VAPID_SUBJECT: z.string().default('mailto:admin@tm-lingo.local'),
  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),

  SEED_ADMIN_EMAIL: z.string().default('admin@tm-lingo.app'),
  SEED_ADMIN_PASSWORD: z.string().default('TmLingoAdmin#2026'),

  SESSION_SECRET: z.string().default(DEFAULT_DEV_SESSION_SECRET),
});

const rawEnv = {
  ...process.env,
  VITE_FIREBASE_PROJECT_ID:
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    '',
  VITE_FIREBASE_MESSAGING_SENDER_ID:
    process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    '',
  VITE_FIREBASE_APP_ID:
    process.env.VITE_FIREBASE_APP_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    '',
  VITE_FIREBASE_VAPID_KEY:
    process.env.VITE_FIREBASE_VAPID_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
    '',
  VITE_SUPABASE_URL:
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    '',
  VITE_SUPABASE_ANON_KEY:
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '',
  SUPABASE_URL:
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
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
  const supabaseConfigured =
    has(env.VITE_SUPABASE_URL) &&
    has(env.VITE_SUPABASE_ANON_KEY) &&
    has(env.SUPABASE_URL) &&
    has(env.SUPABASE_SERVICE_ROLE_KEY);

  return {
    nodeEnv: env.NODE_ENV,
    appBaseUrl: env.APP_BASE_URL,
    activeStack: {
      auth: supabaseConfigured ? 'supabase-auth' : 'guest-local',
      storage: supabaseConfigured ? 'supabase-storage' : 'local-assets',
      database: mongodbConfigured
        ? mongoStatus?.connected
          ? 'mongodb-connected'
          : 'mongodb-configured'
        : 'in-memory',
      push: 'w3c-web-push',
    },
    databaseMode: mongodbConfigured
      ? 'mongodb'
      : firebaseConfigured
        ? 'firebase-firestore'
        : 'in-memory',
    databaseName: env.MONGODB_DATABASE,
    providers: {
      mongodbConfigured,
      mongodbConnected: mongoStatus?.connected ?? false,
      supabaseConfigured,
      webPushConfigured: has(env.VAPID_PUBLIC_KEY) && has(env.VAPID_PRIVATE_KEY),
      firebaseConfigured,
      fcmWebPushConfigured: has(env.VITE_FIREBASE_VAPID_KEY),
      geminiConfigured: has(env.GEMINI_API_KEY),
      geminiModels: {
        text: env.GEMINI_TEXT_MODEL,
        image: env.GEMINI_IMAGE_MODEL,
        tts: env.GEMINI_TTS_MODEL,
      },
      objectStorageConfigured:
        has(env.OBJECT_STORAGE_ENDPOINT) &&
        has(env.OBJECT_STORAGE_BUCKET) &&
        has(env.OBJECT_STORAGE_ACCESS_KEY) &&
        has(env.OBJECT_STORAGE_SECRET_KEY),
    },
    configuredKeys: {
      APP_BASE_URL: has(env.APP_BASE_URL),
      FIREBASE_APPLET_CONFIG: firebaseConfigured,
      VITE_FIREBASE_PROJECT_ID: has(env.VITE_FIREBASE_PROJECT_ID),
      VITE_FIREBASE_MESSAGING_SENDER_ID: has(env.VITE_FIREBASE_MESSAGING_SENDER_ID),
      VITE_FIREBASE_APP_ID: has(env.VITE_FIREBASE_APP_ID),
      VITE_FIREBASE_VAPID_KEY: has(env.VITE_FIREBASE_VAPID_KEY),
      VAPID_SUBJECT: has(env.VAPID_SUBJECT),
      VAPID_PUBLIC_KEY: has(env.VAPID_PUBLIC_KEY),
      VAPID_PRIVATE_KEY: has(env.VAPID_PRIVATE_KEY),
      MONGODB_URI: has(env.MONGODB_URI),
      MONGODB_DATABASE: has(env.MONGODB_DATABASE),
      VITE_SUPABASE_URL: has(env.VITE_SUPABASE_URL),
      VITE_SUPABASE_ANON_KEY: has(env.VITE_SUPABASE_ANON_KEY),
      SUPABASE_URL: has(env.SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: has(env.SUPABASE_SERVICE_ROLE_KEY),
      GEMINI_API_KEY: has(env.GEMINI_API_KEY),
      OBJECT_STORAGE_ENDPOINT: has(env.OBJECT_STORAGE_ENDPOINT),
      OBJECT_STORAGE_BUCKET: has(env.OBJECT_STORAGE_BUCKET),
      OBJECT_STORAGE_ACCESS_KEY: has(env.OBJECT_STORAGE_ACCESS_KEY),
      OBJECT_STORAGE_SECRET_KEY: has(env.OBJECT_STORAGE_SECRET_KEY),
      SESSION_SECRET:
        has(env.SESSION_SECRET) &&
        env.SESSION_SECRET.trim() !== DEFAULT_DEV_SESSION_SECRET,
    },
  };
}

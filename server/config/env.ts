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

    // Never overwrite variables already provided by the host/secret manager
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

// Load .env.local first (higher precedence for local overrides), then .env
loadDotEnvFile('.env.local');
loadDotEnvFile('.env');

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_BASE_URL: z.string().default('http://localhost:3000'),

  MONGODB_URI: z.string().default(''),
  MONGODB_DATABASE: z.string().default('tm_lingo'),

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

  SESSION_SECRET: z.string().default('tm-lingo-local-dev-session-secret'),
});

const parsed = serverEnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    'Invalid server environment configuration:',
    parsed.error.flatten().fieldErrors
  );
  process.exit(1);
}

export const env = parsed.data;

export function getRuntimeEnvironmentSummary() {
  const firebaseConfigPath = path.resolve(
    process.cwd(),
    'firebase-applet-config.json'
  );
  const firebaseConfigured = fs.existsSync(firebaseConfigPath);

  return {
    nodeEnv: env.NODE_ENV,
    appBaseUrl: env.APP_BASE_URL,
    databaseMode: firebaseConfigured
      ? 'firebase-firestore'
      : env.MONGODB_URI
        ? 'mongodb'
        : 'in-memory',
    databaseName: env.MONGODB_DATABASE,
    providers: {
      firebaseConfigured,
      webPushConfigured: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
      geminiConfigured: Boolean(env.GEMINI_API_KEY),
      geminiModels: {
        text: env.GEMINI_TEXT_MODEL,
        image: env.GEMINI_IMAGE_MODEL,
        tts: env.GEMINI_TTS_MODEL,
      },
      objectStorageConfigured: Boolean(
        env.OBJECT_STORAGE_ENDPOINT && env.OBJECT_STORAGE_BUCKET
      ),
    },
  };
}

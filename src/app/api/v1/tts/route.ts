import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureServerInit, jsonError } from '../../../../../server/auth/guards';
import {
  normalizeTtsLocale,
  synthesizeSpeech,
} from '../../../../../server/services/ttsService';

const ttsRequestSchema = z.object({
  text: z.string().trim().min(1).max(800),
  locale: z.string().trim().min(2).max(16).default('vi'),
  accent: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_-]{2,24}$/)
    .optional(),
  voiceId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_-]{1,64}$/)
    .optional(),
  voiceName: z
    .enum(['Kore', 'Puck', 'Zephyr', 'Charon', 'Fenrir'])
    .optional(),
});

// Light sliding-window per-IP rate limiter (80 requests / minute)
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 80;

const globalForRate = globalThis as unknown as {
  __tmLingoTtsRate?: Map<string, number[]>;
};

function checkRateLimit(clientKey: string): boolean {
  if (!globalForRate.__tmLingoTtsRate) {
    globalForRate.__tmLingoTtsRate = new Map<string, number[]>();
  }
  const map = globalForRate.__tmLingoTtsRate;
  const now = Date.now();
  const timestamps = (map.get(clientKey) || []).filter(
    (ts) => now - ts < RATE_WINDOW_MS
  );
  if (timestamps.length >= RATE_MAX_REQUESTS) {
    map.set(clientKey, timestamps);
    return false;
  }
  timestamps.push(now);
  map.set(clientKey, timestamps);

  // Periodic cleanup to keep map bounded
  if (map.size > 500) {
    for (const [key, list] of map.entries()) {
      if (list.every((ts) => now - ts >= RATE_WINDOW_MS)) {
        map.delete(key);
      }
    }
  }
  return true;
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip')?.trim() || 'local';
}

export async function POST(request: NextRequest) {
  await ensureServerInit();

  const clientIp = getClientIp(request);
  if (!checkRateLimit(clientIp)) {
    return jsonError('Too many speech requests. Please wait a moment.', 429);
  }

  const body = await request.json().catch(() => null);
  const parsed = ttsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      'Invalid speech request. Provide non-empty text (up to 800 characters) and a supported locale.',
      400
    );
  }

  const normalizedLocale = normalizeTtsLocale(parsed.data.locale);
  if (!normalizedLocale) {
    return jsonError(
      `Unsupported speech language "${parsed.data.locale}". Supported: vi, en, ja, ko, fr, es, zh.`,
      400
    );
  }

  try {
    const result = await synthesizeSpeech({
      text: parsed.data.text,
      locale: normalizedLocale,
      accent: parsed.data.accent,
      voiceId: parsed.data.voiceId,
      voiceName: parsed.data.voiceName,
    });

    const bodyBytes = new Uint8Array(result.audioBuffer);
    return new NextResponse(bodyBytes, {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Length': String(bodyBytes.byteLength),
        'Cache-Control': 'public, max-age=86400',
        'X-TTS-Locale': result.locale,
        'X-TTS-Accent': result.accent,
      },
    });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : 'Unable to synthesize speech audio.',
      502
    );
  }
}

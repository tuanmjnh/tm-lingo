import { generateSpeechAudio } from '../providers/aiManager';

export type SupportedTtsLocale = 'vi' | 'en' | 'ja' | 'ko' | 'fr' | 'es' | 'zh';
export type GeminiVoiceName = 'Kore' | 'Puck' | 'Zephyr' | 'Charon' | 'Fenrir';

export type SupportedTtsAccent =
  | 'en-US'
  | 'en-GB'
  | 'en-AU'
  | 'vi-VN'
  | 'vi-VN-north'
  | 'vi-VN-south'
  | 'ja-JP'
  | 'ko-KR'
  | 'fr-FR'
  | 'es-ES'
  | 'zh-CN';

export interface SynthesizeSpeechInput {
  text: string;
  locale: string;
  accent?: string;
  voiceId?: string;
  voiceName?: GeminiVoiceName;
  style?: string;
}

export interface SynthesizeSpeechResult {
  audioBuffer: Buffer;
  mimeType: 'audio/wav' | 'audio/mpeg';
  engine: 'gemini-tts' | 'azure-neural-tts' | 'cloud-tts';
  locale: SupportedTtsLocale;
  accent: SupportedTtsAccent;
}

const DEFAULT_ACCENT_BY_LOCALE: Record<SupportedTtsLocale, SupportedTtsAccent> = {
  vi: 'vi-VN',
  en: 'en-US',
  ja: 'ja-JP',
  ko: 'ko-KR',
  fr: 'fr-FR',
  es: 'es-ES',
  zh: 'zh-CN',
};

const ALLOWED_ACCENTS = new Set<SupportedTtsAccent>([
  'en-US',
  'en-GB',
  'en-AU',
  'vi-VN',
  'vi-VN-north',
  'vi-VN-south',
  'ja-JP',
  'ko-KR',
  'fr-FR',
  'es-ES',
  'zh-CN',
]);

const CLOUD_TTS_LANG_BY_ACCENT: Record<SupportedTtsAccent, string> = {
  'en-US': 'en-US',
  'en-GB': 'en-GB',
  'en-AU': 'en-AU',
  'vi-VN': 'vi',
  'vi-VN-north': 'vi',
  'vi-VN-south': 'vi',
  'ja-JP': 'ja',
  'ko-KR': 'ko',
  'fr-FR': 'fr',
  'es-ES': 'es',
  'zh-CN': 'zh-CN',
};

// Hardcoded trusted TTS endpoint hosts (never derived from user input)
const CLOUD_TTS_ENDPOINT = 'https://translate.googleapis.com/translate_tts';
const AZURE_REGION_PATTERN = /^[a-z0-9-]{2,32}$/;

const MAX_CACHE_ENTRIES = 180;
const MAX_CACHE_BYTES = 18 * 1024 * 1024; // 18 MB cap

interface CachedAudioEntry {
  audioBuffer: Buffer;
  mimeType: 'audio/wav' | 'audio/mpeg';
  engine: 'gemini-tts' | 'azure-neural-tts' | 'cloud-tts';
  locale: SupportedTtsLocale;
  accent: SupportedTtsAccent;
  createdAt: number;
}

interface GlobalTtsCacheState {
  entries: Map<string, CachedAudioEntry>;
  totalBytes: number;
}

const globalForTts = globalThis as unknown as {
  __tmLingoTtsCache?: GlobalTtsCacheState;
};

function getTtsCache(): GlobalTtsCacheState {
  if (!globalForTts.__tmLingoTtsCache) {
    globalForTts.__tmLingoTtsCache = {
      entries: new Map<string, CachedAudioEntry>(),
      totalBytes: 0,
    };
  }
  return globalForTts.__tmLingoTtsCache;
}

function getCachedAudio(key: string): CachedAudioEntry | null {
  const cache = getTtsCache();
  const entry = cache.entries.get(key);
  if (!entry) return null;
  cache.entries.delete(key);
  cache.entries.set(key, entry);
  return entry;
}

function setCachedAudio(key: string, entry: CachedAudioEntry): void {
  const cache = getTtsCache();
  const existing = cache.entries.get(key);
  if (existing) {
    cache.totalBytes -= existing.audioBuffer.length;
    cache.entries.delete(key);
  }
  cache.entries.set(key, entry);
  cache.totalBytes += entry.audioBuffer.length;

  while (
    cache.entries.size > MAX_CACHE_ENTRIES ||
    cache.totalBytes > MAX_CACHE_BYTES
  ) {
    const oldestKey = cache.entries.keys().next().value;
    if (!oldestKey) break;
    const oldest = cache.entries.get(oldestKey);
    cache.entries.delete(oldestKey);
    if (oldest) {
      cache.totalBytes -= oldest.audioBuffer.length;
    }
  }
}

export function normalizeTtsLocale(raw: string): SupportedTtsLocale | null {
  const base = raw.trim().toLowerCase().split(/[-_]/)[0] || '';
  if (
    base === 'vi' ||
    base === 'en' ||
    base === 'ja' ||
    base === 'ko' ||
    base === 'fr' ||
    base === 'es' ||
    base === 'zh'
  ) {
    return base;
  }
  return null;
}

export function normalizeTtsAccent(
  locale: SupportedTtsLocale,
  rawAccent?: string
): SupportedTtsAccent {
  if (rawAccent) {
    const trimmed = rawAccent.trim() as SupportedTtsAccent;
    if (
      ALLOWED_ACCENTS.has(trimmed) &&
      trimmed.toLowerCase().startsWith(locale)
    ) {
      return trimmed;
    }
  }
  return DEFAULT_ACCENT_BY_LOCALE[locale];
}

function resolveGeminiVoiceName(
  voiceId?: string,
  explicitVoiceName?: GeminiVoiceName
): GeminiVoiceName {
  if (explicitVoiceName) return explicitVoiceName;
  const id = (voiceId || '').toLowerCase();
  if (id.includes('zephyr')) return 'Zephyr';
  if (id.includes('puck') || id.includes('playful')) return 'Puck';
  if (id.includes('charon') || id.includes('vi-warm')) return 'Charon';
  if (id.includes('fenrir')) return 'Fenrir';
  return 'Kore';
}

function buildGeminiStylePrompt(
  locale: SupportedTtsLocale,
  accent: SupportedTtsAccent,
  voiceName: GeminiVoiceName,
  customStyle?: string
): string {
  if (customStyle?.trim()) return customStyle.trim();

  const personaStyle: Record<GeminiVoiceName, string> = {
    Kore: 'warm, nurturing, clear storyteller',
    Zephyr: 'soft, gentle, soothing bedtime narrator',
    Puck: 'cheerful, upbeat, friendly playful teacher',
    Charon: 'calm, steady, reassuring classic narrator',
    Fenrir: 'expressive, lively, engaging adventure storyteller',
  };

  const accentDirection: Record<SupportedTtsAccent, string> = {
    'en-US': 'Natural American English (US) accent',
    'en-GB': 'Clear British English (UK) accent',
    'en-AU': 'Friendly Australian English (AU) accent',
    'vi-VN': 'Natural, clear standard Vietnamese pronunciation',
    'vi-VN-north': 'Clear Northern Vietnamese (Hanoi) accent',
    'vi-VN-south': 'Warm Southern Vietnamese (Ho Chi Minh City) accent',
    'ja-JP': 'Clear, polite standard Japanese pronunciation',
    'ko-KR': 'Clear, friendly standard Korean pronunciation',
    'fr-FR': 'Clear, gentle standard French pronunciation',
    'es-ES': 'Clear, warm Spanish pronunciation',
    'zh-CN': 'Clear, gentle Mandarin Chinese pronunciation',
  };

  return `${accentDirection[accent]}; ${personaStyle[voiceName]} for young learners, well-paced and articulate (${locale}).`;
}

function sanitizeTtsText(raw: string): string {
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function resolveAzureNeuralVoice(
  accent: SupportedTtsAccent,
  voiceName: GeminiVoiceName,
  voiceId?: string
): { lang: string; name: string } {
  const isMalePersona =
    voiceName === 'Charon' ||
    voiceName === 'Fenrir' ||
    (voiceId || '').toLowerCase().includes('vi-warm') ||
    (voiceId || '').toLowerCase().includes('playful');

  switch (accent) {
    case 'vi-VN':
    case 'vi-VN-north':
    case 'vi-VN-south':
      return {
        lang: 'vi-VN',
        name: isMalePersona ? 'vi-VN-NamMinhNeural' : 'vi-VN-HoaiMyNeural',
      };
    case 'en-GB':
      return {
        lang: 'en-GB',
        name: isMalePersona ? 'en-GB-RyanNeural' : 'en-GB-SoniaNeural',
      };
    case 'en-AU':
      return {
        lang: 'en-AU',
        name: isMalePersona ? 'en-AU-WilliamNeural' : 'en-AU-NatashaNeural',
      };
    case 'en-US':
      return {
        lang: 'en-US',
        name: isMalePersona ? 'en-US-GuyNeural' : 'en-US-JennyNeural',
      };
    case 'ja-JP':
      return { lang: 'ja-JP', name: 'ja-JP-NanamiNeural' };
    case 'ko-KR':
      return { lang: 'ko-KR', name: 'ko-KR-SunHiNeural' };
    case 'fr-FR':
      return { lang: 'fr-FR', name: 'fr-FR-DeniseNeural' };
    case 'es-ES':
      return { lang: 'es-ES', name: 'es-ES-ElviraNeural' };
    case 'zh-CN':
      return { lang: 'zh-CN', name: 'zh-CN-XiaoxiaoNeural' };
  }
}

/**
 * Optional Tier 2: High-quality Azure Neural TTS (e.g. vi-VN-HoaiMyNeural,
 * vi-VN-NamMinhNeural, en-GB-SoniaNeural, en-AU-NatashaNeural) when
 * AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are configured server-side.
 */
async function synthesizeViaAzureNeuralTts(
  text: string,
  accent: SupportedTtsAccent,
  voiceName: GeminiVoiceName,
  voiceId?: string
): Promise<Buffer | null> {
  const key = (process.env.AZURE_SPEECH_KEY || '').trim();
  const region = (process.env.AZURE_SPEECH_REGION || '').trim().toLowerCase();
  if (!key || !region || !AZURE_REGION_PATTERN.test(region)) {
    return null;
  }

  const azureVoice = resolveAzureNeuralVoice(accent, voiceName, voiceId);
  const ssml = `<speak version="1.0" xml:lang="${azureVoice.lang}"><voice name="${azureVoice.name}">${escapeXml(text)}</voice></speak>`;

  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'tm-lingo-tts',
    },
    body: ssml,
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Azure Neural TTS responded with status ${response.status}`);
  }

  const buf = Buffer.from(await response.arrayBuffer());
  if (buf.length < 128) {
    throw new Error('Azure Neural TTS returned empty audio payload.');
  }
  return buf;
}

/**
 * Splits text into natural chunks <= maxChars preserving Vietnamese diacritics
 * and never splitting inside a word unless a single token exceeds maxChars.
 */
export function splitTextIntoTtsChunks(text: string, maxChars = 175): string[] {
  const clean = sanitizeTtsText(text);
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const chunks: string[] = [];
  let remaining = clean;

  while (remaining.length > maxChars) {
    const slice = remaining.slice(0, maxChars);

    let splitAt = -1;
    const sentenceMatches = Array.from(slice.matchAll(/[.!?…]+(?=\s|$)/g));
    if (sentenceMatches.length > 0) {
      const last = sentenceMatches[sentenceMatches.length - 1];
      if (last.index !== undefined && last.index >= Math.floor(maxChars * 0.35)) {
        splitAt = last.index + last[0].length;
      }
    }

    if (splitAt === -1) {
      const clauseMatches = Array.from(slice.matchAll(/[,;:–—]+(?=\s|$)/g));
      if (clauseMatches.length > 0) {
        const last = clauseMatches[clauseMatches.length - 1];
        if (last.index !== undefined && last.index >= Math.floor(maxChars * 0.35)) {
          splitAt = last.index + last[0].length;
        }
      }
    }

    if (splitAt === -1) {
      const lastSpace = slice.lastIndexOf(' ');
      splitAt = lastSpace > 20 ? lastSpace : maxChars;
    }

    const head = remaining.slice(0, splitAt).trim();
    if (head) chunks.push(head);
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

function stripId3v2Header(buf: Buffer): Buffer {
  if (
    buf.length > 10 &&
    buf[0] === 0x49 &&
    buf[1] === 0x44 &&
    buf[2] === 0x33
  ) {
    const tagSize =
      ((buf[6] & 0x7f) << 21) |
      ((buf[7] & 0x7f) << 14) |
      ((buf[8] & 0x7f) << 7) |
      (buf[9] & 0x7f);
    const offset = 10 + tagSize;
    if (offset < buf.length) {
      return buf.subarray(offset);
    }
  }
  return buf;
}

async function synthesizeViaCloudTts(
  text: string,
  accent: SupportedTtsAccent
): Promise<Buffer> {
  const tl = CLOUD_TTS_LANG_BY_ACCENT[accent];
  const chunks = splitTextIntoTtsChunks(text, 175);
  if (chunks.length === 0) {
    throw new Error('No readable text provided for TTS.');
  }

  const buffers: Buffer[] = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const url = new URL(CLOUD_TTS_ENDPOINT);
    url.searchParams.set('ie', 'UTF-8');
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('tl', tl);
    url.searchParams.set('q', chunk);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'audio/mpeg, audio/*;q=0.9',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Cloud TTS responded with status ${response.status}`);
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('audio')) {
      throw new Error(`Unexpected TTS response content-type: ${contentType}`);
    }

    const arrayBuf = await response.arrayBuffer();
    const rawBuf = Buffer.from(arrayBuf);
    if (rawBuf.length < 64) {
      throw new Error('Cloud TTS returned empty audio payload.');
    }

    buffers.push(i === 0 ? rawBuf : stripId3v2Header(rawBuf));
  }

  return buffers.length === 1 ? buffers[0] : Buffer.concat(buffers);
}

/**
 * Multi-tier server-side speech synthesis:
 * 1. Gemini Neural TTS (Kore, Zephyr, Puck, Charon, Fenrir + regional accent style)
 * 2. Azure Neural TTS alternative (vi-VN-HoaiMyNeural / NamMinhNeural & regional English) when configured
 * 3. Built-in Regional Cloud TTS (zero-config Vietnamese & US/UK/AU English MP3 synthesis)
 */
export async function synthesizeSpeech(
  input: SynthesizeSpeechInput
): Promise<SynthesizeSpeechResult> {
  const locale = normalizeTtsLocale(input.locale);
  if (!locale) {
    throw new Error(`Unsupported TTS locale: ${input.locale}`);
  }

  const accent = normalizeTtsAccent(locale, input.accent);
  const cleanText = sanitizeTtsText(input.text);
  if (!cleanText) {
    throw new Error('Please provide non-empty text for TTS.');
  }

  const voiceName = resolveGeminiVoiceName(input.voiceId, input.voiceName);
  const cacheKey = `${locale}:${accent}:${input.voiceId || voiceName}:${cleanText}`;
  const cached = getCachedAudio(cacheKey);
  if (cached) {
    return {
      audioBuffer: cached.audioBuffer,
      mimeType: cached.mimeType,
      engine: cached.engine,
      locale: cached.locale,
      accent: cached.accent,
    };
  }

  // Tier 1: Gemini Neural TTS with selected voice + regional accent direction
  try {
    const geminiStyle = buildGeminiStylePrompt(
      locale,
      accent,
      voiceName,
      input.style
    );
    const geminiResult = await generateSpeechAudio({
      text: cleanText,
      locale,
      voiceName,
      style: geminiStyle,
    });
    const entry: CachedAudioEntry = {
      audioBuffer: geminiResult.wavBuffer,
      mimeType: 'audio/wav',
      engine: 'gemini-tts',
      locale,
      accent,
      createdAt: Date.now(),
    };
    setCachedAudio(cacheKey, entry);
    return {
      audioBuffer: entry.audioBuffer,
      mimeType: entry.mimeType,
      engine: entry.engine,
      locale,
      accent,
    };
  } catch {
    // Fall through to alternative high-quality neural / regional cloud providers
  }

  // Tier 2: Optional Azure Cognitive Services Neural TTS (high-quality Vietnamese & regional English)
  try {
    const azureBuf = await synthesizeViaAzureNeuralTts(
      cleanText,
      accent,
      voiceName,
      input.voiceId
    );
    if (azureBuf) {
      const entry: CachedAudioEntry = {
        audioBuffer: azureBuf,
        mimeType: 'audio/mpeg',
        engine: 'azure-neural-tts',
        locale,
        accent,
        createdAt: Date.now(),
      };
      setCachedAudio(cacheKey, entry);
      return {
        audioBuffer: entry.audioBuffer,
        mimeType: entry.mimeType,
        engine: entry.engine,
        locale,
        accent,
      };
    }
  } catch {
    // Fall through to zero-config regional cloud TTS
  }

  // Tier 3: Built-in zero-config Regional Cloud TTS (supports vi, en-US, en-GB, en-AU, etc.)
  const mp3Buffer = await synthesizeViaCloudTts(cleanText, accent);
  const entry: CachedAudioEntry = {
    audioBuffer: mp3Buffer,
    mimeType: 'audio/mpeg',
    engine: 'cloud-tts',
    locale,
    accent,
    createdAt: Date.now(),
  };
  setCachedAudio(cacheKey, entry);
  return {
    audioBuffer: entry.audioBuffer,
    mimeType: entry.mimeType,
    engine: entry.engine,
    locale,
    accent,
  };
}

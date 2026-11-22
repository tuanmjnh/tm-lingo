import type { VoiceProfile } from '../../packages/contracts/types';

const BCP47_MAP: Record<string, string> = {
  en: 'en-US',
  vi: 'vi-VN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  fr: 'fr-FR',
  es: 'es-ES',
  zh: 'zh-CN',
};

const SERVER_TTS_SUPPORTED_LOCALES = new Set([
  'vi',
  'en',
  'ja',
  'ko',
  'fr',
  'es',
  'zh',
]);

const PREFERRED_VI_VOICE_HINTS = [
  'google tiếng việt',
  'hoaimy',
  'namminh',
  'linh',
  'microsoft an',
  'vietnamese',
  'tiếng việt',
];

const MAX_CLIENT_AUDIO_CACHE = 80;
const TTS_PERSISTENT_CACHE_NAME = 'tm-lingo-tts-audio-v1';
const MAX_PERSISTENT_TTS_ENTRIES = 40;
const clientAudioCache = new Map<string, string>();
const inflightFetches = new Map<string, Promise<string | null>>();

let activeAudioEl: HTMLAudioElement | null = null;
let activeAbortController: AbortController | null = null;
let playbackGeneration = 0;

function buildPersistentCacheRequestUrl(cacheKey: string): string {
  // Deterministic safe synthetic same-origin URL for Cache API storage
  let hash = 2166136261;
  for (let i = 0; i < cacheKey.length; i += 1) {
    hash ^= cacheKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `${window.location.origin}/_offline_tts/${hex}-${cacheKey.length}`;
}

async function readPersistentTtsBlob(cacheKey: string): Promise<Blob | null> {
  if (typeof window === 'undefined' || !('caches' in window)) return null;
  try {
    const cache = await window.caches.open(TTS_PERSISTENT_CACHE_NAME);
    const match = await cache.match(buildPersistentCacheRequestUrl(cacheKey));
    if (!match) return null;
    const blob = await match.blob();
    return blob.size >= 64 ? blob : null;
  } catch {
    return null;
  }
}

async function writePersistentTtsBlob(
  cacheKey: string,
  blob: Blob,
  contentType: string
): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const cache = await window.caches.open(TTS_PERSISTENT_CACHE_NAME);
    const url = buildPersistentCacheRequestUrl(cacheKey);
    await cache.put(
      url,
      new Response(blob, {
        status: 200,
        headers: { 'Content-Type': contentType || 'audio/mpeg' },
      })
    );
    const keys = await cache.keys();
    if (keys.length > MAX_PERSISTENT_TTS_ENTRIES) {
      const excess = keys.length - MAX_PERSISTENT_TTS_ENTRIES;
      await Promise.all(keys.slice(0, excess).map((k) => cache.delete(k)));
    }
  } catch {
    // ignore storage quota errors
  }
}

function normalizeBaseLocale(locale: string): string {
  return (locale || 'en').trim().toLowerCase().split(/[-_]/)[0] || 'en';
}

function resolveEffectiveBcp47(locale: string, accent?: string): string {
  const base = normalizeBaseLocale(locale);
  if (accent && accent.trim()) {
    const clean = accent.trim();
    if (clean.startsWith('vi-VN')) return 'vi-VN';
    if (clean.toLowerCase().startsWith(base)) return clean;
  }
  return BCP47_MAP[base] ?? locale;
}

function buildCacheKey(
  text: string,
  locale: string,
  accent?: string,
  voiceId?: string
): string {
  const base = normalizeBaseLocale(locale);
  const accentKey = accent?.trim() || BCP47_MAP[base] || base;
  return `${base}:${accentKey}:${voiceId || 'default'}:${text.trim()}`;
}

function getCachedBlobUrl(key: string): string | null {
  const existing = clientAudioCache.get(key);
  if (!existing) return null;
  clientAudioCache.delete(key);
  clientAudioCache.set(key, existing);
  return existing;
}

function setCachedBlobUrl(key: string, objectUrl: string): void {
  const prev = clientAudioCache.get(key);
  if (prev && prev !== objectUrl) {
    try {
      URL.revokeObjectURL(prev);
    } catch {
      // ignore
    }
    clientAudioCache.delete(key);
  }
  clientAudioCache.set(key, objectUrl);

  while (clientAudioCache.size > MAX_CLIENT_AUDIO_CACHE) {
    const oldestKey = clientAudioCache.keys().next().value;
    if (!oldestKey) break;
    const oldestUrl = clientAudioCache.get(oldestKey);
    clientAudioCache.delete(oldestKey);
    if (oldestUrl) {
      try {
        URL.revokeObjectURL(oldestUrl);
      } catch {
        // ignore
      }
    }
  }
}

function waitForBrowserVoices(timeoutMs = 350): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve([]);
  }
  const immediate = window.speechSynthesis.getVoices();
  if (immediate.length > 0) {
    return Promise.resolve(immediate);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
      window.clearTimeout(timer);
      resolve(window.speechSynthesis.getVoices());
    };
    const onVoices = () => finish();
    const timer = window.setTimeout(finish, timeoutMs);
    window.speechSynthesis.addEventListener('voiceschanged', onVoices);
  });
}

function findBestBrowserVoice(
  voices: SpeechSynthesisVoice[],
  locale: string,
  accent?: string
): SpeechSynthesisVoice | undefined {
  const base = normalizeBaseLocale(locale);
  const langTag = resolveEffectiveBcp47(locale, accent).toLowerCase();

  const matching = voices.filter((v) => {
    const vLang = v.lang.toLowerCase().replace('_', '-');
    return vLang === langTag || vLang.startsWith(`${base}-`) || vLang === base;
  });

  if (matching.length === 0) {
    if (base === 'vi') {
      return voices.find((v) =>
        PREFERRED_VI_VOICE_HINTS.some((hint) =>
          v.name.toLowerCase().includes(hint)
        )
      );
    }
    return undefined;
  }

  if (base === 'vi') {
    for (const hint of PREFERRED_VI_VOICE_HINTS) {
      const hit = matching.find((v) => v.name.toLowerCase().includes(hint));
      if (hit) return hit;
    }
  }

  const exact = matching.find(
    (v) => v.lang.toLowerCase().replace('_', '-') === langTag
  );
  return exact ?? matching[0];
}

function shouldPreferServerTts(
  locale: string,
  voiceProfile?: VoiceProfile | null,
  accent?: string
): boolean {
  const base = normalizeBaseLocale(locale);
  if (!SERVER_TTS_SUPPORTED_LOCALES.has(base)) return false;

  // Always use server TTS for Vietnamese & non-English locales so narration
  // works reliably with consistent quality across every device/browser.
  if (base !== 'en') return true;

  // Prefer server TTS when a Gemini / cloud voice profile is selected.
  const provider = (voiceProfile?.providerId || '').toLowerCase();
  if (provider.includes('gemini') || provider.includes('cloud') || provider.includes('neural')) {
    return true;
  }

  // Prefer server TTS whenever an explicit regional accent (e.g. en-GB, en-AU)
  // is requested so the accent is guaranteed regardless of OS voice packs.
  if (accent && accent.trim() && accent.trim().toLowerCase() !== 'en-us') {
    return true;
  }

  // Fallback to server TTS if the browser has no matching voice installed.
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0 && findBestBrowserVoice(voices, base, accent)) {
      return false;
    }
  }

  return true;
}

async function fetchServerTtsAudioUrl(params: {
  text: string;
  locale: string;
  accent?: string;
  voiceId?: string;
  signal?: AbortSignal;
}): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const trimmed = params.text.trim();
  if (!trimmed) return null;

  const base = normalizeBaseLocale(params.locale);
  if (!SERVER_TTS_SUPPORTED_LOCALES.has(base)) return null;

  const cacheKey = buildCacheKey(trimmed, base, params.accent, params.voiceId);
  const cached = getCachedBlobUrl(cacheKey);
  if (cached) return cached;

  const pending = inflightFetches.get(cacheKey);
  if (pending) return pending;

  const task = (async () => {
    try {
      // Check persistent Cache API first so narration still works on unstable/offline networks
      const persistentBlob = await readPersistentTtsBlob(cacheKey);
      if (persistentBlob) {
        const objectUrl = URL.createObjectURL(persistentBlob);
        setCachedBlobUrl(cacheKey, objectUrl);
        return objectUrl;
      }

      const res = await fetch('/api/v1/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: trimmed.slice(0, 800),
          locale: base,
          accent: params.accent || undefined,
          voiceId: params.voiceId || undefined,
        }),
        signal: params.signal,
      });
      if (!res.ok) return null;
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('audio')) return null;

      const blob = await res.blob();
      if (blob.size < 64) return null;
      void writePersistentTtsBlob(cacheKey, blob, contentType);
      const objectUrl = URL.createObjectURL(blob);
      setCachedBlobUrl(cacheKey, objectUrl);
      return objectUrl;
    } catch {
      return null;
    } finally {
      inflightFetches.delete(cacheKey);
    }
  })();

  inflightFetches.set(cacheKey, task);
  return task;
}

export function prefetchSpeech(options: {
  text: string;
  locale: string;
  accent?: string;
  voiceProfile?: VoiceProfile | null;
}): void {
  if (typeof window === 'undefined') return;
  const trimmed = options.text.trim();
  if (!trimmed) return;
  if (!shouldPreferServerTts(options.locale, options.voiceProfile, options.accent)) {
    return;
  }
  void fetchServerTtsAudioUrl({
    text: trimmed,
    locale: options.locale,
    accent: options.accent,
    voiceId: options.voiceProfile?.voiceId,
  });
}

export function stopSpeaking(): void {
  playbackGeneration += 1;

  if (activeAbortController) {
    try {
      activeAbortController.abort();
    } catch {
      // ignore
    }
    activeAbortController = null;
  }

  if (activeAudioEl) {
    try {
      activeAudioEl.onplay = null;
      activeAudioEl.onplaying = null;
      activeAudioEl.onended = null;
      activeAudioEl.onerror = null;
      activeAudioEl.pause();
      activeAudioEl.currentTime = 0;
    } catch {
      // ignore
    }
    activeAudioEl = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

export function speakText(options: {
  text: string;
  locale: string;
  accent?: string;
  audioUrl?: string;
  rate?: number;
  voiceProfile?: VoiceProfile | null;
  onLoading?: () => void;
  onStart?: (meta?: { durationSec?: number }) => void;
  onEnd?: () => void;
  onError?: (message?: string) => void;
}): void {
  stopSpeaking();
  const gen = playbackGeneration;
  const cleanText = options.text.trim();
  if (!cleanText) {
    options.onEnd?.();
    return;
  }

  const baseLocale = normalizeBaseLocale(options.locale);
  const desiredRate = Math.min(
    1.5,
    Math.max(0.6, options.rate ?? options.voiceProfile?.defaultRate ?? 0.92)
  );

  const playWebSpeech = async () => {
    if (gen !== playbackGeneration) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      options.onStart?.();
      globalThis.setTimeout(() => {
        if (gen === playbackGeneration) options.onEnd?.();
      }, 600);
      return;
    }

    const voices = await waitForBrowserVoices(350);
    if (gen !== playbackGeneration) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const langTag = resolveEffectiveBcp47(baseLocale, options.accent);
    utterance.lang = langTag;
    utterance.rate = desiredRate;
    utterance.pitch = options.voiceProfile?.pitch ?? 1.02;

    const matchedVoice = findBestBrowserVoice(voices, baseLocale, options.accent);
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onstart = () => {
      if (gen === playbackGeneration) options.onStart?.();
    };
    utterance.onend = () => {
      if (gen === playbackGeneration) options.onEnd?.();
    };
    utterance.onerror = () => {
      if (gen === playbackGeneration) options.onEnd?.();
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      if (gen === playbackGeneration) options.onEnd?.();
    }
  };

  const playHtmlAudio = (src: string, onFallback: () => void) => {
    if (gen !== playbackGeneration || typeof window === 'undefined') return;
    try {
      const audio = new Audio(src);
      audio.playbackRate = desiredRate;
      if ('preservesPitch' in audio) {
        (audio as HTMLAudioElement & { preservesPitch: boolean }).preservesPitch =
          true;
      }
      activeAudioEl = audio;

      let started = false;
      const emitStart = () => {
        if (started || gen !== playbackGeneration) return;
        started = true;
        const durationSec =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration / Math.max(0.6, audio.playbackRate)
            : undefined;
        options.onStart?.({ durationSec });
      };

      audio.onplaying = emitStart;
      audio.onplay = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          emitStart();
        }
      };
      audio.onended = () => {
        if (activeAudioEl === audio) activeAudioEl = null;
        if (gen === playbackGeneration) options.onEnd?.();
      };
      audio.onerror = () => {
        if (activeAudioEl === audio) activeAudioEl = null;
        if (gen === playbackGeneration) onFallback();
      };

      void audio.play().catch(() => {
        if (activeAudioEl === audio) activeAudioEl = null;
        if (gen === playbackGeneration) onFallback();
      });
    } catch {
      if (gen === playbackGeneration) onFallback();
    }
  };

  const playServerTtsThenFallback = async () => {
    if (gen !== playbackGeneration) return;
    const cacheKey = buildCacheKey(
      cleanText,
      baseLocale,
      options.accent,
      options.voiceProfile?.voiceId
    );
    const cachedUrl = getCachedBlobUrl(cacheKey);
    if (cachedUrl) {
      playHtmlAudio(cachedUrl, () => {
        void playWebSpeech();
      });
      return;
    }

    options.onLoading?.();
    const controller = new AbortController();
    activeAbortController = controller;

    const fetchedUrl = await fetchServerTtsAudioUrl({
      text: cleanText,
      locale: baseLocale,
      accent: options.accent,
      voiceId: options.voiceProfile?.voiceId,
      signal: controller.signal,
    });

    if (activeAbortController === controller) {
      activeAbortController = null;
    }
    if (gen !== playbackGeneration) return;

    if (fetchedUrl) {
      playHtmlAudio(fetchedUrl, () => {
        void playWebSpeech();
      });
      return;
    }

    // Offline or server TTS unavailable -> graceful Web Speech fallback
    void playWebSpeech();
  };

  // 1. Pre-recorded story/lesson audio URL always has top priority
  if (typeof window !== 'undefined' && options.audioUrl?.trim()) {
    playHtmlAudio(options.audioUrl.trim(), () => {
      if (shouldPreferServerTts(baseLocale, options.voiceProfile, options.accent)) {
        void playServerTtsThenFallback();
      } else {
        void playWebSpeech();
      }
    });
    return;
  }

  // 2. Server TTS for Vietnamese, regional accents, AI/cloud voices, or missing browser voices
  if (shouldPreferServerTts(baseLocale, options.voiceProfile, options.accent)) {
    void playServerTtsThenFallback();
    return;
  }

  // 3. Local Web Speech when browser natively supports the selected default English voice
  void playWebSpeech();
}

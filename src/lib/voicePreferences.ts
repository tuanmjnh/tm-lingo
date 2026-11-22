import type { VoiceProfile } from '../../packages/contracts/types';

export interface AccentOption {
  code: string;
  shortLabel: string;
  labelVi: string;
  labelEn: string;
}

export const REGIONAL_ACCENTS_BY_LOCALE: Record<string, AccentOption[]> = {
  en: [
    {
      code: 'en-US',
      shortLabel: 'US',
      labelVi: 'Anh – Mỹ (US)',
      labelEn: 'American (US)',
    },
    {
      code: 'en-GB',
      shortLabel: 'UK',
      labelVi: 'Anh – Anh (UK)',
      labelEn: 'British (UK)',
    },
    {
      code: 'en-AU',
      shortLabel: 'AU',
      labelVi: 'Anh – Úc (AU)',
      labelEn: 'Australian (AU)',
    },
  ],
  vi: [
    {
      code: 'vi-VN',
      shortLabel: 'Chuẩn',
      labelVi: 'Tiếng Việt chuẩn',
      labelEn: 'Standard Vietnamese',
    },
    {
      code: 'vi-VN-north',
      shortLabel: 'Bắc',
      labelVi: 'Giọng miền Bắc',
      labelEn: 'Northern (Hanoi)',
    },
    {
      code: 'vi-VN-south',
      shortLabel: 'Nam',
      labelVi: 'Giọng miền Nam',
      labelEn: 'Southern (Saigon)',
    },
  ],
};

export interface StoredVoiceSelection {
  voiceId: string;
  accent: string;
}

const STORAGE_PREFIX = 'tm_lingo_voice_pref_v1';
export const VOICE_PREF_CHANGED_EVENT = 'tm-lingo:voice-pref-changed';

export function normalizeBaseLocale(locale: string): string {
  return (locale || 'en').trim().toLowerCase().split(/[-_]/)[0] || 'en';
}

export function getAccentOptionsForLocale(locale: string): AccentOption[] {
  const base = normalizeBaseLocale(locale);
  return REGIONAL_ACCENTS_BY_LOCALE[base] ?? [];
}

export function getDefaultAccentForLocale(locale: string): string {
  const options = getAccentOptionsForLocale(locale);
  if (options.length > 0) return options[0].code;
  const base = normalizeBaseLocale(locale);
  return base;
}

export function loadVoiceSelection(
  learnerId: string,
  locale: string
): StoredVoiceSelection | null {
  if (typeof window === 'undefined') return null;
  const base = normalizeBaseLocale(locale);
  try {
    const raw = window.localStorage.getItem(
      `${STORAGE_PREFIX}:${learnerId}:${base}`
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredVoiceSelection>;
    if (typeof parsed.voiceId !== 'string' && typeof parsed.accent !== 'string') {
      return null;
    }
    const validAccents = getAccentOptionsForLocale(base);
    const accent =
      parsed.accent && validAccents.some((a) => a.code === parsed.accent)
        ? parsed.accent
        : getDefaultAccentForLocale(base);
    return {
      voiceId: typeof parsed.voiceId === 'string' ? parsed.voiceId : '',
      accent,
    };
  } catch {
    return null;
  }
}

export function saveVoiceSelection(
  learnerId: string,
  locale: string,
  selection: StoredVoiceSelection
): void {
  if (typeof window === 'undefined') return;
  const base = normalizeBaseLocale(locale);
  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}:${learnerId}:${base}`,
      JSON.stringify(selection)
    );
    window.dispatchEvent(
      new CustomEvent(VOICE_PREF_CHANGED_EVENT, {
        detail: { learnerId, locale: base, ...selection },
      })
    );
  } catch {
    // ignore storage quota errors
  }
}

export function pickDefaultVoiceForLocale(
  voices: VoiceProfile[],
  locale: string
): VoiceProfile | null {
  if (voices.length === 0) return null;
  const base = normalizeBaseLocale(locale);
  if (base === 'vi') {
    return (
      voices.find((v) => v.voiceId === 'voice-vi-calm') ??
      voices.find((v) => v.voiceId === 'voice-gemini-kore') ??
      voices[0]
    );
  }
  return (
    voices.find((v) => v.voiceId === 'voice-gemini-kore') ??
    voices.find((v) => v.voiceId === 'voice-en-warm') ??
    voices[0]
  );
}

const VOICE_DESC_VI: Record<string, string> = {
  'voice-vi-calm': 'Mai · Giọng kể dịu nhẹ',
  'voice-vi-warm': 'Minh · Giọng kể ấm áp',
  'voice-gemini-kore': 'Kore · Giọng kể ấm áp, rõ ràng',
  'voice-gemini-zephyr': 'Zephyr · Giọng dịu êm, ru ngủ',
  'voice-gemini-puck': 'Puck · Giọng vui tươi, sinh động',
  'voice-gemini-charon': 'Charon · Giọng trầm ổn, điềm tĩnh',
  'voice-gemini-fenrir': 'Fenrir · Giọng phiêu lưu truyền cảm',
  'voice-en-warm': 'Clara · Giọng kể chuyện ấm áp',
  'voice-en-playful': 'Leo · Giọng thầy giáo vui vẻ',
};

const VOICE_DESC_EN: Record<string, string> = {
  'voice-vi-calm': 'Mai · Gentle Vietnamese Storyteller',
  'voice-vi-warm': 'Minh · Warm Vietnamese Narrator',
  'voice-gemini-kore': 'Kore · Warm, Nurturing Storyteller',
  'voice-gemini-zephyr': 'Zephyr · Gentle Bedtime Narrator',
  'voice-gemini-puck': 'Puck · Playful, Upbeat Teacher',
  'voice-gemini-charon': 'Charon · Calm, Classic Narrator',
  'voice-gemini-fenrir': 'Fenrir · Expressive Adventure Voice',
  'voice-en-warm': 'Clara · Warm Storyteller',
  'voice-en-playful': 'Leo · Playful Teacher',
};

export function formatVoiceOptionLabel(
  voice: VoiceProfile,
  interfaceLocale: string
): string {
  const isVi = interfaceLocale === 'vi';
  const mapped = isVi
    ? VOICE_DESC_VI[voice.voiceId]
    : VOICE_DESC_EN[voice.voiceId];
  if (mapped) return mapped;
  return `${voice.displayName} · ${voice.voiceStyleTags.join(', ')}`;
}

export function getSamplePreviewText(locale: string, accent: string): string {
  const base = normalizeBaseLocale(locale);
  if (base === 'vi') {
    if (accent === 'vi-VN-north') {
      return 'Xin chào bé yêu! Hôm nay chúng ta cùng đọc một câu chuyện thật hay nhé.';
    }
    if (accent === 'vi-VN-south') {
      return 'Chào bé cưng nha! Hôm nay mình cùng nghe kể chuyện thiệt vui nhé.';
    }
    return 'Xin chào bé! Hôm nay chúng ta cùng học từ mới và đọc truyện nhé.';
  }
  if (accent === 'en-GB') {
    return 'Hello there! Shall we read a lovely story and practise new words together today?';
  }
  if (accent === 'en-AU') {
    return 'G’day little explorer! Let us read a bright story and learn new words together.';
  }
  return 'Hello little explorer! Let us read a fun story and practice new words together.';
}

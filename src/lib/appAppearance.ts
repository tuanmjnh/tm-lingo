'use client';

export type AppThemeMode = 'light' | 'dark' | 'system';

export type AppAccentColor = 'sky' | 'emerald' | 'indigo' | 'amber' | 'rose';

export interface AppAppearanceSettings {
  themeMode: AppThemeMode;
  accentColor: AppAccentColor;
  guestLocale: string;
  reducedMotion: boolean;
}

const STORAGE_KEY = 'tm_lingo_appearance_v1';

export const DEFAULT_APPEARANCE: AppAppearanceSettings = {
  themeMode: 'light',
  accentColor: 'sky',
  guestLocale: 'vi',
  reducedMotion: false,
};

export const ACCENT_PRESETS: Array<{
  id: AppAccentColor;
  labelVi: string;
  labelEn: string;
  swatchHex: string;
}> = [
  { id: 'sky', labelVi: 'Xanh dương', labelEn: 'Sky Blue', swatchHex: '#0284C7' },
  { id: 'emerald', labelVi: 'Ngọc lục bảo', labelEn: 'Emerald', swatchHex: '#059669' },
  { id: 'indigo', labelVi: 'Chàm học thuật', labelEn: 'Indigo', swatchHex: '#4F46E5' },
  { id: 'amber', labelVi: 'Hổ phách ấm', labelEn: 'Warm Amber', swatchHex: '#D97706' },
  { id: 'rose', labelVi: 'San hô', labelEn: 'Coral Rose', swatchHex: '#E11D48' },
];

export function loadAppearanceSettings(): AppAppearanceSettings {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = JSON.parse(raw) as Partial<AppAppearanceSettings>;
    const themeMode: AppThemeMode =
      parsed.themeMode === 'dark' ||
      parsed.themeMode === 'light' ||
      parsed.themeMode === 'system'
        ? parsed.themeMode
        : DEFAULT_APPEARANCE.themeMode;
    const accentColor: AppAccentColor =
      parsed.accentColor === 'sky' ||
      parsed.accentColor === 'emerald' ||
      parsed.accentColor === 'indigo' ||
      parsed.accentColor === 'amber' ||
      parsed.accentColor === 'rose'
        ? parsed.accentColor
        : DEFAULT_APPEARANCE.accentColor;
    const guestLocale =
      typeof parsed.guestLocale === 'string' && parsed.guestLocale.length >= 2
        ? parsed.guestLocale
        : DEFAULT_APPEARANCE.guestLocale;
    return {
      themeMode,
      accentColor,
      guestLocale,
      reducedMotion: Boolean(parsed.reducedMotion),
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function saveAppearanceSettings(next: AppAppearanceSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
}

export function resolveIsDark(mode: AppThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyAppearanceToDocument(
  settings: AppAppearanceSettings
): boolean {
  if (typeof document === 'undefined') return false;
  const isDark = resolveIsDark(settings.themeMode);
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.setAttribute('data-accent', settings.accentColor);
  root.classList.toggle('reduced-motion', settings.reducedMotion);
  return isDark;
}

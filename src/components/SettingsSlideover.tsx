'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Globe,
  LogIn,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Settings,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  AuthUserProfile,
  LocaleConfig,
} from '../../packages/contracts/types';
import {
  ACCENT_PRESETS,
  type AppAccentColor,
  type AppAppearanceSettings,
  type AppThemeMode,
} from '../lib/appAppearance';
import {
  isSoundEffectsMuted,
  playSuccessChime,
  setSoundEffectsMuted,
} from '../audio/soundEffects';

interface SettingsSlideoverProps {
  open: boolean;
  onClose: () => void;
  interfaceLocale: string;
  uiLocales: LocaleConfig[];
  appearance: AppAppearanceSettings;
  onChangeThemeMode: (mode: AppThemeMode) => void;
  onChangeAccentColor: (accent: AppAccentColor) => void;
  onChangeReducedMotion: (reduced: boolean) => void;
  onChangeInterfaceLocale: (locale: string) => void;
  parentUser: AuthUserProfile | null;
  onOpenAuth: (mode: 'signin' | 'signup') => void;
  onSignOut: () => void;
}

export function SettingsSlideover({
  open,
  onClose,
  interfaceLocale,
  uiLocales,
  appearance,
  onChangeThemeMode,
  onChangeAccentColor,
  onChangeReducedMotion,
  onChangeInterfaceLocale,
  parentUser,
  onOpenAuth,
  onSignOut,
}: SettingsSlideoverProps) {
  const isVi = interfaceLocale === 'vi';
  const [sfxMuted, setSfxMuted] = useState(false);

  useEffect(() => {
    if (open) {
      setSfxMuted(isSoundEffectsMuted());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const availableLocales =
    uiLocales.length > 0
      ? uiLocales
      : [
          { locale: 'vi', nativeName: 'Tiếng Việt', displayName: 'Vietnamese' },
          { locale: 'en', nativeName: 'English', displayName: 'English' },
        ];

  const themeOptions: Array<{
    key: AppThemeMode;
    label: string;
    icon: typeof Sun;
  }> = [
    { key: 'light', label: isVi ? 'Sáng' : 'Light', icon: Sun },
    { key: 'dark', label: isVi ? 'Tối' : 'Dark', icon: Moon },
    { key: 'system', label: isVi ? 'Hệ thống' : 'System', icon: Monitor },
  ];

  const handleToggleSfx = () => {
    const next = !sfxMuted;
    setSfxMuted(next);
    setSoundEffectsMuted(next);
    if (!next) playSuccessChime();
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label={isVi ? 'Cài đặt giao diện & ứng dụng' : 'App Settings'}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/45 backdrop-blur-[2px]"
          />

          {/* Slideover Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-sm h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-accent" aria-hidden="true" />
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                  {isVi ? 'Cài đặt ứng dụng' : 'App Settings'}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={isVi ? 'Đóng cài đặt' : 'Close settings'}
                className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">
              {/* 1. Theme Mode (Light / Dark / System) */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {isVi ? 'Chế độ giao diện' : 'Appearance'}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {appearance.themeMode === 'dark'
                      ? isVi
                        ? 'Nền tối dịu mắt'
                        : 'Dark surface'
                      : appearance.themeMode === 'system'
                        ? isVi
                          ? 'Theo thiết bị'
                          : 'Matches device'
                        : isVi
                          ? 'Nền sáng tiêu chuẩn'
                          : 'Light surface'}
                  </span>
                </div>

                <div
                  className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70"
                  role="radiogroup"
                  aria-label={isVi ? 'Chọn chế độ sáng tối' : 'Choose color theme'}
                >
                  {themeOptions.map(({ key, label, icon: Icon }) => {
                    const active = appearance.themeMode === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChangeThemeMode(key)}
                        className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                          active
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 2. App Accent Color */}
              <section className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="pt-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-2">
                    <Palette className="w-4 h-4 text-accent" aria-hidden="true" />
                    <span>{isVi ? 'Màu sắc ứng dụng' : 'App Accent Color'}</span>
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {isVi
                      ? ACCENT_PRESETS.find((p) => p.id === appearance.accentColor)
                          ?.labelVi
                      : ACCENT_PRESETS.find((p) => p.id === appearance.accentColor)
                          ?.labelEn}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-2.5">
                  {ACCENT_PRESETS.map((preset) => {
                    const selected = appearance.accentColor === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => onChangeAccentColor(preset.id)}
                        aria-label={isVi ? preset.labelVi : preset.labelEn}
                        aria-pressed={selected}
                        title={isVi ? preset.labelVi : preset.labelEn}
                        className={`group flex flex-col items-center gap-1.5 py-2 rounded-xl border transition-colors cursor-pointer ${
                          selected
                            ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white shadow-xs transition-transform group-hover:scale-105"
                          style={{ backgroundColor: preset.swatchHex }}
                        >
                          {selected && (
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 3. Interface Language */}
              <section className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="pt-4 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-accent" aria-hidden="true" />
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {isVi ? 'Ngôn ngữ giao diện' : 'Interface Language'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {availableLocales.map((loc) => {
                    const selected = interfaceLocale === loc.locale;
                    return (
                      <button
                        key={loc.locale}
                        type="button"
                        onClick={() => onChangeInterfaceLocale(loc.locale)}
                        aria-pressed={selected}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
                          selected
                            ? 'border-accent bg-accent-soft font-semibold'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        <span>{loc.nativeName}</span>
                        <span className="text-xs uppercase opacity-75">
                          {loc.locale}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 4. Audio & Accessibility */}
              <section className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="pt-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {isVi ? 'Âm thanh & Trải nghiệm' : 'Audio & Comfort'}
                </div>

                <button
                  type="button"
                  onClick={handleToggleSfx}
                  aria-pressed={!sfxMuted}
                  className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200">
                    {sfxMuted ? (
                      <VolumeX className="w-4 h-4 text-slate-400" aria-hidden="true" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-accent" aria-hidden="true" />
                    )}
                    <span>
                      {isVi ? 'Âm thanh tương tác' : 'Interactive sound effects'}
                    </span>
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      sfxMuted
                        ? 'text-slate-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {sfxMuted ? (isVi ? 'Đang tắt' : 'Off') : isVi ? 'Đang bật' : 'On'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onChangeReducedMotion(!appearance.reducedMotion)
                  }
                  aria-pressed={appearance.reducedMotion}
                  className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200">
                    <Sparkles className="w-4 h-4 text-accent" aria-hidden="true" />
                    <span>
                      {isVi ? 'Giảm hiệu ứng chuyển động' : 'Reduce motion'}
                    </span>
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      appearance.reducedMotion
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {appearance.reducedMotion
                      ? isVi
                        ? 'Đang bật'
                        : 'On'
                      : isVi
                        ? 'Tắt'
                        : 'Off'}
                  </span>
                </button>
              </section>
            </div>

            {/* Footer Account Actions */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5 bg-slate-50/70 dark:bg-slate-950/60">
              {parentUser ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {parentUser.displayName || parentUser.email}
                    </p>
                    {parentUser.email && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {parentUser.email}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSignOut();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 cursor-pointer shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{isVi ? 'Đăng xuất' : 'Sign out'}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAuth('signin');
                    }}
                    className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{isVi ? 'Đăng nhập' : 'Sign in'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAuth('signup');
                    }}
                    className="inline-flex items-center justify-center py-2.5 px-3 rounded-xl btn-accent text-xs font-semibold cursor-pointer"
                  >
                    {isVi ? 'Tạo tài khoản' : 'Create account'}
                  </button>
                </div>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

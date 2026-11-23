'use client';

import { useState } from 'react';
import { Globe2, Loader2, Mic, Square, Volume2 } from 'lucide-react';
import type { VoiceProfile } from '../../packages/contracts/types';
import { speakText, stopSpeaking } from '../audio/speechPlayer';
import {
  formatVoiceOptionLabel,
  getAccentOptionsForLocale,
  getSamplePreviewText,
} from '../lib/voicePreferences';

interface VoiceAccentControlsProps {
  locale: string;
  interfaceLocale: string;
  voices: VoiceProfile[];
  selectedVoiceId: string;
  selectedAccent: string;
  onVoiceChange: (voiceId: string) => void;
  onAccentChange: (accentCode: string) => void;
  rate?: number;
  bedtimeMode?: boolean;
  compact?: boolean;
  voiceLabel?: string;
  emptyNotice?: string;
}

export function VoiceAccentControls({
  locale,
  interfaceLocale,
  voices,
  selectedVoiceId,
  selectedAccent,
  onVoiceChange,
  onAccentChange,
  rate = 0.92,
  bedtimeMode = false,
  compact = false,
  voiceLabel,
  emptyNotice,
}: VoiceAccentControlsProps) {
  const isVi = interfaceLocale === 'vi';
  const accentOptions = getAccentOptionsForLocale(locale);
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'playing'>(
    'idle'
  );

  const activeVoice =
    voices.find((v) => v.voiceId === selectedVoiceId) ?? voices[0] ?? null;

  const handlePreviewToggle = () => {
    if (previewState !== 'idle') {
      stopSpeaking();
      setPreviewState('idle');
      return;
    }
    const sample = getSamplePreviewText(locale, selectedAccent);
    speakText({
      text: sample,
      locale,
      accent: selectedAccent,
      rate,
      voiceProfile: activeVoice,
      onLoading: () => setPreviewState('loading'),
      onStart: () => setPreviewState('playing'),
      onEnd: () => setPreviewState('idle'),
    });
  };

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {/* Voice Persona Selector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={`voice-select-${locale}-${compact ? 'compact' : 'full'}`}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
              bedtimeMode
                ? 'text-stone-300'
                : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
            <span>
              {voiceLabel ||
                (isVi ? 'Giọng đọc' : 'Narrator voice')}
            </span>
          </label>
          <button
            type="button"
            onClick={handlePreviewToggle}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              bedtimeMode
                ? 'border-stone-700 bg-stone-900 text-amber-200 hover:bg-stone-800'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-accent hover:text-accent'
            }`}
          >
            {previewState === 'loading' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : previewState === 'playing' ? (
              <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>
              {previewState === 'playing'
                ? isVi
                  ? 'Dừng'
                  : 'Stop'
                : isVi
                  ? 'Nghe thử'
                  : 'Preview'}
            </span>
          </button>
        </div>

        {voices.length > 0 ? (
          <select
            id={`voice-select-${locale}-${compact ? 'compact' : 'full'}`}
            value={selectedVoiceId}
            onChange={(e) => {
              if (previewState !== 'idle') {
                stopSpeaking();
                setPreviewState('idle');
              }
              onVoiceChange(e.target.value);
            }}
            className={`w-full ${
              compact ? 'min-h-[42px]' : 'min-h-[44px]'
            } rounded-xl border px-3 text-sm focus:outline-none focus:border-sky-500 ${
              bedtimeMode
                ? 'border-stone-700 bg-stone-900 text-[#F5EFE6]'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100'
            }`}
          >
            {voices.map((voice) => (
              <option key={voice.voiceId} value={voice.voiceId}>
                {formatVoiceOptionLabel(voice, interfaceLocale)}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {emptyNotice ||
              (isVi
                ? 'Đang sử dụng giọng đọc mặc định của hệ thống.'
                : 'Using default built-in voice.')}
          </p>
        )}
      </div>

      {/* Regional Accent Switcher */}
      {accentOptions.length > 0 && (
        <div className="space-y-1.5">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
              bedtimeMode
                ? 'text-stone-300'
                : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            <Globe2 className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
            <span>
              {locale.startsWith('vi')
                ? isVi
                  ? 'Phong cách vùng miền'
                  : 'Vietnamese regional style'
                : isVi
                  ? 'Giọng vùng miền (Accent)'
                  : 'Regional accent'}
            </span>
          </span>
          <div
            className="grid grid-cols-3 gap-2"
            role="radiogroup"
            aria-label={isVi ? 'Chọn giọng vùng miền' : 'Choose regional accent'}
          >
            {accentOptions.map((opt) => {
              const active = selectedAccent === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  title={isVi ? opt.labelVi : opt.labelEn}
                  onClick={() => {
                    if (previewState !== 'idle') {
                      stopSpeaking();
                      setPreviewState('idle');
                    }
                    onAccentChange(opt.code);
                  }}
                  className={`px-2 py-2.5 min-h-[42px] rounded-xl border text-xs font-semibold transition-colors cursor-pointer truncate ${
                    bedtimeMode
                      ? active
                        ? 'border-amber-400 bg-amber-600 text-white'
                        : 'border-stone-700 bg-stone-900 text-stone-300 hover:bg-stone-800'
                      : active
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {isVi ? opt.labelVi.replace(/^Anh – |^Tiếng Việt |^Giọng miền /g, '') : opt.labelEn.replace(/ Vietnamese$/, '')}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

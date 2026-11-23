'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BookOpen,
  Check,
  Clock,
  Cloud,
  Download,
  Headphones,
  Infinity as InfinityIcon,
  ListOrdered,
  Loader2,
  Moon,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Type,
  Volume2,
  X,
} from 'lucide-react';
import type {
  LocaleConfig,
  StoryBook,
  VoiceProfile,
} from '../../../packages/contracts/types';
import {
  prefetchSpeech,
  speakText,
  stopSpeaking,
} from '../../audio/speechPlayer';
import { playPageTurn } from '../../audio/soundEffects';
import { AssetImage } from '../../components/AssetImage';
import { VoiceAccentControls } from '../../components/VoiceAccentControls';
import type { OfflineCacheRecord } from '../../lib/swPrecache';

interface AudiobookPlayerProps {
  story: StoryBook;
  chapterIndex: number;
  narrationLocale: string;
  explanationLocale: string;
  interfaceLocale: string;
  languages: LocaleConfig[];
  voices: VoiceProfile[];
  selectedVoiceId: string;
  selectedAccent: string;
  bedtimeMode: boolean;
  savedNotice: boolean;
  offlineRecord: OfflineCacheRecord;
  offlineSaving: boolean;
  offlineAudioProgress: { done: number; total: number } | null;
  audioSavedForCurrent: boolean;
  onSelectChapter: (index: number) => void;
  onChangeNarrationLocale: (locale: string) => void;
  onVoiceChange: (voiceId: string) => void;
  onAccentChange: (accent: string) => void;
  onSaveOffline: () => void;
  onSwitchToPictureMode: () => void;
}

const SPEED_OPTIONS = [0.75, 0.9, 1.0, 1.25, 1.5] as const;
const SLEEP_OPTIONS = [0, 5, 10, 15, 30] as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function splitParagraphs(text: string): string[] {
  const clean = text.trim();
  if (!clean) return [];
  const raw = clean
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (raw.length > 1) return raw;
  // If single long block, split gracefully every 2–3 sentences for smooth read-along narration
  if (clean.length > 420) {
    const sentences = clean.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [clean];
    const groups: string[] = [];
    let buf = '';
    for (const s of sentences) {
      if (buf.length + s.length > 340 && buf.length > 80) {
        groups.push(buf.trim());
        buf = s.trim();
      } else {
        buf = buf ? `${buf} ${s.trim()}` : s.trim();
      }
    }
    if (buf.trim()) groups.push(buf.trim());
    return groups;
  }
  return [clean];
}

export function AudiobookPlayer({
  story,
  chapterIndex,
  narrationLocale,
  explanationLocale,
  interfaceLocale,
  languages,
  voices,
  selectedVoiceId,
  selectedAccent,
  bedtimeMode,
  savedNotice,
  offlineRecord,
  offlineSaving,
  offlineAudioProgress,
  audioSavedForCurrent,
  onSelectChapter,
  onChangeNarrationLocale,
  onVoiceChange,
  onAccentChange,
  onSaveOffline,
  onSwitchToPictureMode,
}: AudiobookPlayerProps) {
  const isVi = interfaceLocale === 'vi';
  const chapter = story.segments[chapterIndex] ?? story.segments[0];
  const totalChapters = story.segments.length;

  const directAudioUrl = chapter?.audioUrlByLocale?.[narrationLocale] ||
    (chapter?.audioUrlByLocale ? Object.values(chapter.audioUrlByLocale)[0] : undefined);
  const hasDirectMp3 = Boolean(directAudioUrl);

  const chapterText = useMemo(() => {
    if (!chapter) return '';
    return (
      chapter.textByLocale[narrationLocale] ??
      chapter.textByLocale.vi ??
      chapter.textByLocale.en ??
      Object.values(chapter.textByLocale)[0] ??
      ''
    );
  }, [chapter, narrationLocale]);

  const chapterNote = useMemo(() => {
    if (!chapter) return '';
    return (
      chapter.explanationByLocale[explanationLocale] ??
      chapter.explanationByLocale.vi ??
      Object.values(chapter.explanationByLocale)[0] ??
      ''
    );
  }, [chapter, explanationLocale]);

  const paragraphs = useMemo(() => splitParagraphs(chapterText), [chapterText]);

  // Playback state
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [autoNextChapter, setAutoNextChapter] = useState<boolean>(true);
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [mobileSheet, setMobileSheet] = useState<'none' | 'settings' | 'chapters'>('none');
  const [desktopPanelTab, setDesktopPanelTab] = useState<'settings' | 'chapters'>('settings');
  const paragraphRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Direct MP3 HTML5 Audio state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mp3Playing, setMp3Playing] = useState(false);
  const [mp3Buffering, setMp3Buffering] = useState(false);
  const [mp3CurrentTime, setMp3CurrentTime] = useState(0);
  const [mp3Duration, setMp3Duration] = useState<number>(chapter?.durationSec || 0);
  const [mp3Error, setMp3Error] = useState<string | null>(null);
  const autoPlayNextChapterRef = useRef(false);

  // Continuous paragraph-by-paragraph TTS state (for text-based long stories)
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [activeParaIndex, setActiveParaIndex] = useState<number>(0);
  const ttsPlayingRef = useRef(false);
  ttsPlayingRef.current = ttsPlaying;
  const autoNextRef = useRef(autoNextChapter);
  autoNextRef.current = autoNextChapter;
  const playbackRateRef = useRef(playbackRate);
  playbackRateRef.current = playbackRate;

  // Sleep timer state (works anytime in Audiobook Mode)
  const [sleepMinutes, setSleepMinutes] = useState<0 | 5 | 10 | 15 | 30>(0);
  const [sleepRemainingSec, setSleepRemainingSec] = useState(0);
  const [sleepDoneNotice, setSleepDoneNotice] = useState(false);

  const activeVoice = useMemo(
    () => voices.find((v) => v.voiceId === selectedVoiceId) ?? null,
    [voices, selectedVoiceId]
  );

  const effectiveRate = bedtimeMode ? Math.min(playbackRate, 0.9) : playbackRate;
  const effectiveRateRef = useRef(effectiveRate);
  effectiveRateRef.current = effectiveRate;

  const stopAllPlayback = useCallback(() => {
    stopSpeaking();
    setTtsPlaying(false);
    setTtsLoading(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setMp3Playing(false);
    setMp3Buffering(false);
  }, []);

  // Stop playback on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  // Close mobile sheet on Escape & lock background scroll while open
  useEffect(() => {
    if (mobileSheet === 'none') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileSheet('none');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileSheet]);

  // Sync audio playbackRate without restarting playback
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = effectiveRate;
    }
  }, [effectiveRate]);

  // Reset state ONLY when story or chapter changes (not when speed changes)
  useEffect(() => {
    stopSpeaking();
    setTtsPlaying(false);
    setTtsLoading(false);
    setActiveParaIndex(0);
    setMp3CurrentTime(0);
    setMp3Duration(chapter?.durationSec || 0);
    setMp3Error(null);
    setMp3Buffering(false);

    if (hasDirectMp3 && audioRef.current) {
      audioRef.current.load();
      audioRef.current.playbackRate = effectiveRateRef.current;
      if (autoPlayNextChapterRef.current) {
        autoPlayNextChapterRef.current = false;
        setMp3Buffering(true);
        void audioRef.current
          .play()
          .then(() => {
            setMp3Playing(true);
            setMp3Buffering(false);
          })
          .catch(() => {
            setMp3Playing(false);
            setMp3Buffering(false);
          });
      } else {
        setMp3Playing(false);
      }
    }
  }, [story.id, chapterIndex, directAudioUrl, hasDirectMp3, chapter?.durationSec]);

  // Sleep timer countdown
  useEffect(() => {
    if (sleepMinutes === 0) {
      setSleepRemainingSec(0);
      return;
    }
    setSleepDoneNotice(false);
    setSleepRemainingSec(sleepMinutes * 60);
    const id = window.setInterval(() => {
      setSleepRemainingSec((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          stopAllPlayback();
          setSleepMinutes(0);
          setSleepDoneNotice(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [sleepMinutes, stopAllPlayback]);

  // Continuous TTS reader for a given paragraph index
  const speakParagraphAt = useCallback(
    (paraIdx: number) => {
      if (paraIdx < 0 || paraIdx >= paragraphs.length) {
        setTtsPlaying(false);
        setTtsLoading(false);
        return;
      }
      const text = paragraphs[paraIdx];
      if (!text) return;

      setActiveParaIndex(paraIdx);
      setTtsPlaying(true);
      setSleepDoneNotice(false);

      // Prefetch next paragraph for seamless continuous narration
      const nextText = paragraphs[paraIdx + 1];
      if (nextText) {
        prefetchSpeech({
          text: nextText,
          locale: narrationLocale,
          accent: selectedAccent,
          voiceProfile: activeVoice,
        });
      }

      speakText({
        text,
        locale: narrationLocale,
        accent: selectedAccent,
        rate: bedtimeMode ? Math.min(playbackRateRef.current, 0.9) : playbackRateRef.current,
        voiceProfile: activeVoice,
        onLoading: () => setTtsLoading(true),
        onStart: () => {
          setTtsLoading(false);
          setTtsPlaying(true);
        },
        onEnd: () => {
          setTtsLoading(false);
          if (!ttsPlayingRef.current) return;
          if (paraIdx + 1 < paragraphs.length) {
            const nextEl = paragraphRefs.current[paraIdx + 1];
            if (nextEl) {
              nextEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            speakParagraphAt(paraIdx + 1);
          } else if (autoNextRef.current && chapterIndex + 1 < totalChapters) {
            autoPlayNextChapterRef.current = true;
            playPageTurn();
            onSelectChapter(chapterIndex + 1);
          } else {
            setTtsPlaying(false);
          }
        },
      });
    },
    [
      paragraphs,
      narrationLocale,
      selectedAccent,
      activeVoice,
      bedtimeMode,
      chapterIndex,
      totalChapters,
      onSelectChapter,
    ]
  );

  // Auto-start TTS narration after auto-advancing to next chapter on text-based long books
  useEffect(() => {
    if (!hasDirectMp3 && autoPlayNextChapterRef.current && paragraphs.length > 0) {
      autoPlayNextChapterRef.current = false;
      const timer = window.setTimeout(() => {
        speakParagraphAt(0);
      }, 280);
      return () => window.clearTimeout(timer);
    }
  }, [hasDirectMp3, chapterIndex, paragraphs, speakParagraphAt]);

  // Direct MP3 play/pause
  const handleTogglePlay = () => {
    setSleepDoneNotice(false);
    if (hasDirectMp3) {
      const el = audioRef.current;
      if (!el) return;
      if (mp3Playing) {
        el.pause();
        setMp3Playing(false);
      } else {
        setMp3Error(null);
        setMp3Buffering(true);
        el.playbackRate = effectiveRate;
        void el
          .play()
          .then(() => {
            setMp3Playing(true);
            setMp3Buffering(false);
          })
          .catch(() => {
            setMp3Playing(false);
            setMp3Buffering(false);
            setMp3Error(
              isVi
                ? 'Không phát được tệp âm thanh chương này. Hãy thử lại hoặc chọn chương khác.'
                : 'Unable to play this audio chapter. Please retry or choose another chapter.'
            );
          });
      }
      return;
    }

    // Text-based audiobook TTS toggle
    if (ttsPlaying || ttsLoading) {
      stopSpeaking();
      setTtsPlaying(false);
      setTtsLoading(false);
      return;
    }
    speakParagraphAt(activeParaIndex < paragraphs.length ? activeParaIndex : 0);
  };

  const handleSeekBy = (deltaSec: number) => {
    if (hasDirectMp3 && audioRef.current) {
      const dur = Number.isFinite(audioRef.current.duration)
        ? audioRef.current.duration
        : mp3Duration;
      const next = Math.max(0, Math.min(dur || 0, audioRef.current.currentTime + deltaSec));
      audioRef.current.currentTime = next;
      setMp3CurrentTime(next);
      return;
    }
    // For text-based audiobooks, -15s / +15s steps by paragraph
    const nextPara = Math.max(
      0,
      Math.min(paragraphs.length - 1, activeParaIndex + (deltaSec < 0 ? -1 : 1))
    );
    if (ttsPlaying) {
      speakParagraphAt(nextPara);
    } else {
      setActiveParaIndex(nextPara);
    }
  };

  const handleJumpChapter = (nextIdx: number) => {
    if (nextIdx < 0 || nextIdx >= totalChapters) return;
    const wasPlaying = hasDirectMp3 ? mp3Playing : ttsPlaying;
    stopAllPlayback();
    autoPlayNextChapterRef.current = wasPlaying;
    playPageTurn();
    onSelectChapter(nextIdx);
    setMobileSheet('none');
  };

  const getLocaleLabel = (code: string) => {
    const found = languages.find((l) => l.locale === code);
    return found ? `${found.nativeName} (${found.locale.toUpperCase()})` : code.toUpperCase();
  };

  const bookTitle =
    story.titles[interfaceLocale] ||
    story.titles[narrationLocale] ||
    story.titles.vi ||
    story.titles.en ||
    Object.values(story.titles)[0];

  const activeChapterTitle =
    chapter?.chapterTitle ||
    (isVi ? `Chương ${chapterIndex + 1}` : `Chapter ${chapterIndex + 1}`);

  const isCurrentlyPlaying = hasDirectMp3 ? mp3Playing : ttsPlaying;
  const isCurrentlyLoading = hasDirectMp3 ? mp3Buffering : ttsLoading;

  const fontSizeClass =
    fontSize === 'sm'
      ? 'text-base leading-relaxed'
      : fontSize === 'lg'
        ? 'text-xl sm:text-2xl leading-loose'
        : 'text-lg sm:text-[19px] leading-relaxed';

  const cardSurface = bedtimeMode
    ? 'border-stone-700 bg-[#26221F] text-[#F5EFE6]'
    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100';

  const mutedText = bedtimeMode
    ? 'text-stone-400'
    : 'text-slate-500 dark:text-slate-400';

  const progressPercent = hasDirectMp3
    ? mp3Duration > 0
      ? Math.min(100, Math.round((mp3CurrentTime / mp3Duration) * 100))
      : 0
    : Math.round(((activeParaIndex + 1) / Math.max(1, paragraphs.length)) * 100);

  const renderChapterListItems = () => (
    <div className="space-y-1.5">
      {story.segments.map((seg, idx) => {
        const active = idx === chapterIndex;
        const title =
          seg.chapterTitle ||
          (isVi ? `Chương ${idx + 1}` : `Chapter ${idx + 1}`);
        return (
          <button
            key={seg.id}
            type="button"
            onClick={() => handleJumpChapter(idx)}
            className={`w-full text-left px-3 py-3 min-h-[44px] rounded-xl border text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
              active
                ? bedtimeMode
                  ? 'border-amber-400/70 bg-stone-800 text-amber-100 font-bold'
                  : 'border-accent bg-accent-soft font-bold'
                : bedtimeMode
                  ? 'border-stone-800 bg-stone-900/50 text-stone-300 hover:border-stone-600'
                  : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <span className="inline-flex items-center gap-2.5 min-w-0">
              <span
                className={`w-6 h-6 rounded-lg inline-flex items-center justify-center text-[11px] font-bold shrink-0 ${
                  active
                    ? bedtimeMode
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : bedtimeMode
                      ? 'bg-stone-800 text-stone-400'
                      : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {active && isCurrentlyPlaying ? (
                  <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  idx + 1
                )}
              </span>
              <span className="truncate">{title}</span>
            </span>
            {seg.durationSec ? (
              <span className={`text-[11px] tabular-nums shrink-0 ${mutedText}`}>
                {formatTime(seg.durationSec)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );

  const renderListeningSettingsContent = (includeMobileExtras = false) => (
    <div className="space-y-4">
      {includeMobileExtras && story.availableLocales.length > 1 && (
        <label className="block space-y-1.5">
          <span
            className={`text-xs font-semibold ${
              bedtimeMode ? 'text-stone-300' : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            {isVi ? 'Ngôn ngữ truyện' : 'Book language'}
          </span>
          <select
            value={narrationLocale}
            onChange={(e) => {
              stopAllPlayback();
              onChangeNarrationLocale(e.target.value);
            }}
            className={`w-full min-h-[44px] rounded-xl border px-3 text-sm font-medium ${
              bedtimeMode
                ? 'border-stone-700 bg-stone-900 text-[#F5EFE6]'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100'
            }`}
          >
            {story.availableLocales.map((loc) => (
              <option key={loc} value={loc}>
                {getLocaleLabel(loc)}
              </option>
            ))}
          </select>
        </label>
      )}

      {!hasDirectMp3 && (
        <div
          className={
            includeMobileExtras && story.availableLocales.length > 1
              ? 'pt-3 border-t border-slate-100 dark:border-slate-800'
              : ''
          }
        >
          <VoiceAccentControls
            locale={narrationLocale}
            interfaceLocale={interfaceLocale}
            voices={voices}
            selectedVoiceId={selectedVoiceId}
            selectedAccent={selectedAccent}
            onVoiceChange={onVoiceChange}
            onAccentChange={onAccentChange}
            rate={effectiveRate}
            bedtimeMode={bedtimeMode}
            voiceLabel={isVi ? 'Giọng đọc sách nói' : 'Audiobook Voice'}
            emptyNotice={
              isVi
                ? 'Sử dụng giọng đọc chuẩn mặc định.'
                : 'Using default clear narration voice.'
            }
          />
        </div>
      )}

      {includeMobileExtras && hasDirectMp3 && (
        <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-bold tabular-nums">
            <span>{isVi ? 'Tua thời gian' : 'Seek audio'}</span>
            <span className={mutedText}>
              {formatTime(mp3CurrentTime)} / {mp3Duration > 0 ? formatTime(mp3Duration) : '--:--'}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={mp3Duration > 0 ? mp3Duration : 100}
            step={1}
            value={Math.min(mp3CurrentTime, mp3Duration || 100)}
            onChange={(e) => {
              const val = Number(e.target.value);
              setMp3CurrentTime(val);
              if (audioRef.current) {
                audioRef.current.currentTime = val;
              }
            }}
            aria-label={isVi ? 'Tua thời gian sách nói' : 'Seek audiobook playback'}
            className="w-full accent-sky-600 cursor-pointer h-2"
          />
        </div>
      )}

      {includeMobileExtras && (
        <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-bold">
            <span>{isVi ? 'Tốc độ đọc' : 'Playback speed'}</span>
            <span className={`tabular-nums ${mutedText}`}>{effectiveRate.toFixed(2)}x</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {SPEED_OPTIONS.map((rate) => {
              const active = Math.abs(playbackRate - rate) < 0.01;
              return (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setPlaybackRate(rate)}
                  className={`min-h-[42px] rounded-xl text-xs font-bold tabular-nums cursor-pointer transition-colors ${
                    active
                      ? bedtimeMode
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                      : bedtimeMode
                        ? 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {rate}x
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold inline-flex items-center gap-1.5">
            <Clock
              className={`w-3.5 h-3.5 ${bedtimeMode ? 'text-amber-300' : 'text-accent'}`}
              aria-hidden="true"
            />
            <span>{isVi ? 'Hẹn giờ tự dừng sách nói' : 'Sleep Timer'}</span>
          </span>
          {sleepRemainingSec > 0 && (
            <span className="text-xs font-extrabold text-amber-600 dark:text-amber-300 tabular-nums">
              {formatTime(sleepRemainingSec)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {SLEEP_OPTIONS.map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => setSleepMinutes(mins)}
              className={`min-h-[40px] py-1.5 px-1 rounded-xl text-xs font-semibold tabular-nums cursor-pointer transition-colors ${
                sleepMinutes === mins
                  ? bedtimeMode
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : bedtimeMode
                    ? 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {mins === 0 ? (isVi ? 'Tắt' : 'Off') : `${mins}${isVi ? 'p' : 'm'}`}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 min-h-[44px] text-xs font-medium cursor-pointer pt-2 border-t border-slate-100 dark:border-slate-800">
        <span>
          {isVi
            ? 'Tự động phát tiếp chương kế tiếp'
            : 'Auto-play next chapter continuously'}
        </span>
        <input
          type="checkbox"
          checked={autoNextChapter}
          onChange={(e) => setAutoNextChapter(e.target.checked)}
          className="w-4 h-4 accent-sky-600 shrink-0"
        />
      </label>

      {includeMobileExtras && (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
            <Type className={`w-3.5 h-3.5 ${mutedText}`} aria-hidden="true" />
            <span>{isVi ? 'Cỡ chữ đọc' : 'Text size'}</span>
          </span>
          <div className="flex items-center gap-1.5">
            {(['sm', 'md', 'lg'] as const).map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setFontSize(sz)}
                className={`min-w-[40px] min-h-[38px] px-2.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  fontSize === sz
                    ? bedtimeMode
                      ? 'bg-amber-600 text-white'
                      : 'bg-accent-soft border border-accent'
                    : bedtimeMode
                      ? 'bg-stone-800 text-stone-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {sz === 'sm' ? 'A-' : sz === 'md' ? 'A' : 'A+'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-24 md:pb-20 lg:pb-0">
      {/* Hidden native HTML5 audio element for direct MP3 chapters */}
      {hasDirectMp3 && directAudioUrl && (
        <audio
          ref={audioRef}
          src={directAudioUrl}
          preload="metadata"
          onLoadedMetadata={(e) => {
            const dur = e.currentTarget.duration;
            if (Number.isFinite(dur) && dur > 0) setMp3Duration(dur);
            e.currentTarget.playbackRate = effectiveRateRef.current;
          }}
          onTimeUpdate={(e) => {
            setMp3CurrentTime(e.currentTarget.currentTime);
          }}
          onWaiting={() => setMp3Buffering(true)}
          onPlaying={() => {
            setMp3Buffering(false);
            setMp3Playing(true);
          }}
          onPause={() => setMp3Playing(false)}
          onError={() => {
            setMp3Buffering(false);
            setMp3Playing(false);
            setMp3Error(
              isVi
                ? 'Tệp âm thanh chương này tạm thời chậm phản hồi. Bạn có thể bấm Thử lại hoặc chọn chương khác.'
                : 'Audio stream temporarily slow. Please retry or select another chapter.'
            );
          }}
          onEnded={() => {
            setMp3Playing(false);
            if (autoNextRef.current && chapterIndex + 1 < totalChapters) {
              autoPlayNextChapterRef.current = true;
              playPageTurn();
              onSelectChapter(chapterIndex + 1);
            }
          }}
        />
      )}

      {/* Left / Main Stage: Audiobook Player + Long-Form Reader */}
      <section className={`lg:col-span-8 min-w-0 rounded-2xl border ${cardSurface}`}>
        {/* Compact Book Hero Strip (Side-by-side on mobile to save vertical space) */}
        <div
          className={`p-4 sm:p-5 border-b rounded-t-2xl space-y-3 ${
            bedtimeMode
              ? 'bg-stone-900/70 border-stone-700'
              : 'bg-gradient-to-br from-slate-50 to-sky-50/40 dark:from-slate-950 dark:to-slate-900 border-slate-100 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3.5 sm:gap-5">
            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-slate-200/70 dark:border-slate-700 bg-[#FAF8F2] dark:bg-slate-800 shadow-sm shrink-0">
              <AssetImage
                assetRef={story.coverAssetRef}
                altOverride={bookTitle}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              <p
                className={`text-[11px] font-bold inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 ${
                  bedtimeMode ? 'text-amber-300' : 'text-accent'
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  <Headphones className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {hasDirectMp3
                      ? isVi
                        ? 'Sách nói MP3'
                        : 'MP3 Audiobook'
                      : isVi
                        ? 'Sách nói & Truyện dài'
                        : 'Audiobook'}
                  </span>
                </span>
                <span className={mutedText} aria-hidden="true">·</span>
                <span
                  className={`inline-flex items-center gap-1 ${
                    bedtimeMode
                      ? 'text-emerald-300'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  <InfinityIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isVi ? 'Nghe không giới hạn' : 'Unlimited'}</span>
                </span>
              </p>

              <h2 className="text-lg sm:text-2xl font-bold leading-snug line-clamp-2">
                {bookTitle}
              </h2>

              <p className={`text-xs font-medium truncate ${mutedText}`}>
                {story.author ? `${story.author} · ` : ''}
                {story.totalDurationSec
                  ? `~${Math.max(1, Math.round(story.totalDurationSec / 60))} ${isVi ? 'phút' : 'min'} · `
                  : ''}
                {`${totalChapters} ${isVi ? 'chương' : 'chapters'}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSwitchToPictureMode}
              className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                bedtimeMode
                  ? 'border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-accent'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="whitespace-nowrap">
                {isVi ? 'Kiểu từng trang' : 'Picture Mode'}
              </span>
            </button>

            {offlineSaving && offlineAudioProgress ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-2 min-h-[38px] rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 text-xs font-semibold tabular-nums">
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                <span>
                  {offlineAudioProgress.done}/{offlineAudioProgress.total}
                </span>
              </span>
            ) : offlineRecord.status === 'ready' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-2 min-h-[38px] rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                <Cloud className="w-3.5 h-3.5" aria-hidden="true" />
                <Check className="w-3 h-3 -ml-1" aria-hidden="true" />
                <span className="whitespace-nowrap">
                  {audioSavedForCurrent
                    ? isVi
                      ? 'Đã lưu ngoại tuyến'
                      : 'Saved Offline'
                    : isVi
                      ? 'Sẵn sàng ngoại tuyến'
                      : 'Offline Ready'}
                </span>
              </span>
            ) : (
              <button
                type="button"
                onClick={onSaveOffline}
                className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                  bedtimeMode
                    ? 'border-amber-400/40 bg-stone-800 text-amber-200 hover:bg-stone-700'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-accent'
                }`}
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="whitespace-nowrap">
                  {isVi ? 'Lưu ngoại tuyến' : 'Save Offline'}
                </span>
              </button>
            )}

            {savedNotice && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {isVi ? 'Đã đánh dấu chương' : 'Bookmark saved'}
              </span>
            )}
          </div>
        </div>

        {/* Long-Form Book Reading Canvas (Mobile player & settings are pinned cleanly at the bottom; Desktop uses Right Panel) */}
        <div className="p-4 sm:p-8 space-y-4 sm:space-y-5">
          {/* Clean Chapter Title Strip on Mobile/Tablet (Zero cluttered top transport controls) */}
          <div className="lg:hidden space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className={`text-[11px] font-semibold tabular-nums ${mutedText}`}>
                  {isVi
                    ? `Chương ${chapterIndex + 1} / ${totalChapters}`
                    : `Chapter ${chapterIndex + 1} of ${totalChapters}`}
                  {sleepRemainingSec > 0 ? ` · ${formatTime(sleepRemainingSec)}` : ''}
                </p>
                <h3 className="text-base font-bold truncate">{activeChapterTitle}</h3>
              </div>
              {!hasDirectMp3 && (
                <span className={`text-[11px] font-medium tabular-nums shrink-0 ${mutedText}`}>
                  {isVi
                    ? `Đoạn ${activeParaIndex + 1}/${Math.max(1, paragraphs.length)}`
                    : `Para ${activeParaIndex + 1}/${Math.max(1, paragraphs.length)}`}
                </span>
              )}
            </div>

            {mp3Error && (
              <div className="rounded-xl border border-amber-300/70 bg-amber-50 dark:bg-amber-950/50 px-3.5 py-2 text-xs font-medium text-amber-800 dark:text-amber-200">
                {mp3Error}
              </div>
            )}

            {sleepDoneNotice && (
              <div className="rounded-xl border border-amber-400/40 bg-stone-900 text-amber-100 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-2">
                  <Moon className="w-4 h-4 text-amber-300 shrink-0" aria-hidden="true" />
                  <span>
                    {isVi
                      ? 'Đã tạm dừng sách nói theo đồng hồ hẹn giờ ngủ.'
                      : 'Paused automatically by sleep timer.'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setSleepDoneNotice(false)}
                  className="p-1.5 text-stone-400 hover:text-white cursor-pointer"
                  aria-label={isVi ? 'Đóng thông báo' : 'Dismiss'}
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
          {/* Reader Font Size & Language Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <Type className={`w-4 h-4 ${mutedText}`} aria-hidden="true" />
              <span className={`text-xs font-semibold mr-0.5 ${mutedText}`}>
                {isVi ? 'Cỡ chữ:' : 'Text:'}
              </span>
              {(['sm', 'md', 'lg'] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setFontSize(sz)}
                  className={`min-w-[36px] min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    fontSize === sz
                      ? bedtimeMode
                        ? 'bg-amber-600 text-white'
                        : 'bg-accent-soft border border-accent'
                      : bedtimeMode
                        ? 'bg-stone-800 text-stone-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {sz === 'sm' ? 'A-' : sz === 'md' ? 'A' : 'A+'}
                </button>
              ))}
            </div>

            {story.availableLocales.length > 1 && (
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold hidden sm:inline ${mutedText}`}>
                  {isVi ? 'Ngôn ngữ:' : 'Language:'}
                </span>
                <select
                  value={narrationLocale}
                  aria-label={isVi ? 'Ngôn ngữ truyện' : 'Book language'}
                  onChange={(e) => {
                    stopAllPlayback();
                    onChangeNarrationLocale(e.target.value);
                  }}
                  className={`min-h-[36px] rounded-xl border px-2.5 text-xs font-semibold ${
                    bedtimeMode
                      ? 'border-stone-700 bg-stone-900 text-[#F5EFE6]'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100'
                  }`}
                >
                  {story.availableLocales.map((loc) => (
                    <option key={loc} value={loc}>
                      {getLocaleLabel(loc)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Literary Paragraphs — Natural page scroll so reading flows effortlessly beside the sticky right Control Deck */}
          <article className="space-y-3 sm:space-y-4">
            {paragraphs.map((para, idx) => {
              const isHighlighted = !hasDirectMp3 && activeParaIndex === idx;
              return (
                <div
                  key={`${chapterIndex}-${idx}`}
                  ref={(el) => {
                    paragraphRefs.current[idx] = el;
                  }}
                  onClick={() => {
                    if (!hasDirectMp3) {
                      speakParagraphAt(idx);
                    }
                  }}
                  role={!hasDirectMp3 ? 'button' : undefined}
                  tabIndex={!hasDirectMp3 ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (!hasDirectMp3 && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      speakParagraphAt(idx);
                    }
                  }}
                  className={`rounded-xl px-3.5 sm:px-4 py-3 transition-colors ${
                    !hasDirectMp3 ? 'cursor-pointer' : ''
                  } ${
                    isHighlighted
                      ? bedtimeMode
                        ? 'bg-amber-950/60 border border-amber-500/40 text-amber-50'
                        : 'bg-sky-50/90 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/70'
                      : bedtimeMode
                        ? 'hover:bg-stone-900/60 border border-transparent'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <p className={`${fontSizeClass} font-normal`}>{para}</p>
                </div>
              );
            })}
          </article>

          {chapterNote && (
            <div
              className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${
                bedtimeMode
                  ? 'border-stone-700 bg-stone-900/70 text-stone-300'
                  : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-slate-600 dark:text-slate-300'
              }`}
            >
              {chapterNote}
            </div>
          )}

          {/* Bottom Chapter Navigation */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={chapterIndex === 0}
              onClick={() => handleJumpChapter(chapterIndex - 1)}
              className={`inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 min-h-[44px] rounded-xl border text-xs font-bold disabled:opacity-40 cursor-pointer disabled:cursor-default whitespace-nowrap ${
                bedtimeMode
                  ? 'border-stone-700 bg-stone-900 text-stone-200 hover:bg-stone-800'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <SkipBack className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isVi ? 'Chương trước' : 'Previous'}</span>
            </button>

            <span className={`text-xs font-semibold tabular-nums ${mutedText}`}>
              {chapterIndex + 1} / {totalChapters}
            </span>

            <button
              type="button"
              disabled={chapterIndex + 1 >= totalChapters}
              onClick={() => handleJumpChapter(chapterIndex + 1)}
              className={`inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 min-h-[44px] rounded-xl text-xs font-bold disabled:opacity-40 cursor-pointer disabled:cursor-default whitespace-nowrap ${
                bedtimeMode
                  ? 'bg-stone-100 text-stone-900 hover:bg-white'
                  : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white'
              }`}
            >
              <span>{isVi ? 'Chương tiếp' : 'Next'}</span>
              <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* Desktop Sticky Right Control Deck: Full Play Console + Voice/Sleep & Chapters Tabs (Zero Scroll Control!) */}
      <aside className="hidden lg:flex lg:flex-col lg:col-span-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] space-y-4">
        {/* Top Deck: Audiobook Transport Console */}
        <section className={`rounded-2xl border p-4 sm:p-5 space-y-3.5 shrink-0 ${cardSurface}`}>
          <div className="min-w-0">
            <p className={`text-[11px] font-bold uppercase tracking-wide ${mutedText}`}>
              {isVi
                ? `Đang nghe · Chương ${chapterIndex + 1} / ${totalChapters}`
                : `Now Playing · Chapter ${chapterIndex + 1} of ${totalChapters}`}
              {sleepRemainingSec > 0 ? ` · ${formatTime(sleepRemainingSec)}` : ''}
            </p>
            <h3 className="text-base font-bold truncate mt-0.5">
              {activeChapterTitle}
            </h3>
          </div>

          {/* Progress Bar (Real MP3 Seek Slider OR Paragraph Progress Bar) */}
          {hasDirectMp3 ? (
            <div className="space-y-1">
              <input
                type="range"
                min={0}
                max={mp3Duration > 0 ? mp3Duration : 100}
                step={1}
                value={Math.min(mp3CurrentTime, mp3Duration || 100)}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setMp3CurrentTime(val);
                  if (audioRef.current) {
                    audioRef.current.currentTime = val;
                  }
                }}
                aria-label={isVi ? 'Tua thời gian sách nói' : 'Seek audiobook playback'}
                className="w-full accent-sky-600 cursor-pointer h-2"
              />
              <div className={`flex items-center justify-between text-xs tabular-nums ${mutedText}`}>
                <span>{formatTime(mp3CurrentTime)}</span>
                <span>{mp3Duration > 0 ? formatTime(mp3Duration) : '--:--'}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div
                className={`h-2 w-full rounded-full overflow-hidden ${
                  bedtimeMode ? 'bg-stone-800' : 'bg-slate-200 dark:bg-slate-800'
                }`}
              >
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    bedtimeMode
                      ? 'bg-gradient-to-r from-amber-500 to-amber-300'
                      : 'bg-gradient-to-r from-sky-500 to-emerald-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className={`flex items-center justify-between gap-2 text-xs tabular-nums ${mutedText}`}>
                <span>
                  {isVi
                    ? `Đoạn ${activeParaIndex + 1} / ${Math.max(1, paragraphs.length)}`
                    : `Para ${activeParaIndex + 1} / ${Math.max(1, paragraphs.length)}`}
                </span>
                <span>{progressPercent}%</span>
              </div>
            </div>
          )}

          {mp3Error && (
            <div className="rounded-xl border border-amber-300/70 bg-amber-50 dark:bg-amber-950/50 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-200">
              {mp3Error}
            </div>
          )}

          {sleepDoneNotice && (
            <div className="rounded-xl border border-amber-400/40 bg-stone-900 text-amber-100 px-3 py-2 flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-hidden="true" />
                <span>
                  {isVi ? 'Đã tự dừng theo hẹn giờ ngủ.' : 'Paused by sleep timer.'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setSleepDoneNotice(false)}
                className="p-1 text-stone-400 hover:text-white cursor-pointer"
                aria-label={isVi ? 'Đóng thông báo' : 'Dismiss'}
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Primary Play / Pause Button */}
          <button
            type="button"
            onClick={handleTogglePlay}
            className={`w-full inline-flex items-center justify-center gap-2 h-12 rounded-2xl text-white text-sm font-bold shadow-sm cursor-pointer transition-colors ${
              bedtimeMode ? 'bg-amber-600 hover:bg-amber-700' : 'btn-accent'
            }`}
          >
            {isCurrentlyLoading ? (
              <Loader2 className="w-5 h-5 animate-spin shrink-0" aria-hidden="true" />
            ) : isCurrentlyPlaying ? (
              <Pause className="w-5 h-5 fill-current shrink-0" aria-hidden="true" />
            ) : (
              <Play className="w-5 h-5 fill-current shrink-0" aria-hidden="true" />
            )}
            <span className="whitespace-nowrap">
              {isCurrentlyLoading
                ? isVi
                  ? 'Đang tải giọng...'
                  : 'Loading...'
                : isCurrentlyPlaying
                  ? isVi
                    ? 'Tạm dừng'
                    : 'Pause'
                  : isVi
                    ? 'Nghe sách nói'
                    : 'Play Audiobook'}
            </span>
          </button>

          {/* Secondary Transport Row: Prev Chapter / -15s / +15s / Next Chapter */}
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              disabled={chapterIndex === 0}
              onClick={() => handleJumpChapter(chapterIndex - 1)}
              title={isVi ? 'Chương trước' : 'Previous chapter'}
              aria-label={isVi ? 'Chương trước' : 'Previous chapter'}
              className={`inline-flex items-center justify-center h-10 rounded-xl border disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors ${
                bedtimeMode
                  ? 'border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <SkipBack className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => handleSeekBy(-15)}
              title={hasDirectMp3 ? (isVi ? 'Tua lùi 15 giây' : 'Rewind 15s') : isVi ? 'Đoạn trước' : 'Previous paragraph'}
              className={`inline-flex items-center justify-center gap-1 h-10 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                bedtimeMode
                  ? 'border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{hasDirectMp3 ? '15s' : isVi ? 'Lùi' : 'Prev'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSeekBy(15)}
              title={hasDirectMp3 ? (isVi ? 'Tua nhanh 15 giây' : 'Forward 15s') : isVi ? 'Đoạn tiếp' : 'Next paragraph'}
              className={`inline-flex items-center justify-center gap-1 h-10 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                bedtimeMode
                  ? 'border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <span>{hasDirectMp3 ? '15s' : isVi ? 'Tiếp' : 'Next'}</span>
              <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
            </button>

            <button
              type="button"
              disabled={chapterIndex + 1 >= totalChapters}
              onClick={() => handleJumpChapter(chapterIndex + 1)}
              title={isVi ? 'Chương tiếp theo' : 'Next chapter'}
              aria-label={isVi ? 'Chương tiếp theo' : 'Next chapter'}
              className={`inline-flex items-center justify-center h-10 rounded-xl border disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors ${
                bedtimeMode
                  ? 'border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <SkipForward className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Playback Speed Row */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className={mutedText}>{isVi ? 'Tốc độ đọc' : 'Playback speed'}</span>
              <span className="tabular-nums font-bold">{effectiveRate.toFixed(2)}x</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {SPEED_OPTIONS.map((rate) => {
                const active = Math.abs(playbackRate - rate) < 0.01;
                return (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setPlaybackRate(rate)}
                    className={`py-1.5 rounded-lg text-xs font-bold tabular-nums cursor-pointer transition-colors ${
                      active
                        ? bedtimeMode
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                        : bedtimeMode
                          ? 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {rate}x
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Bottom Deck: Tabbed Voice/Sleep Settings & Chapter Table of Contents */}
        <section className={`rounded-2xl border overflow-hidden flex flex-col min-h-0 flex-1 ${cardSurface}`}>
          <div
            role="tablist"
            aria-label={isVi ? 'Cài đặt sách nói và mục lục' : 'Audiobook settings and chapters'}
            className={`grid grid-cols-2 p-1.5 gap-1 border-b shrink-0 ${
              bedtimeMode
                ? 'bg-stone-900/80 border-stone-700'
                : 'bg-slate-50/80 dark:bg-slate-950/70 border-slate-100 dark:border-slate-800'
            }`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={desktopPanelTab === 'settings'}
              onClick={() => setDesktopPanelTab('settings')}
              className={`inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                desktopPanelTab === 'settings'
                  ? bedtimeMode
                    ? 'bg-stone-800 text-amber-200 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-accent shadow-xs'
                  : mutedText
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isVi ? 'Giọng & Hẹn giờ' : 'Voice & Timer'}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={desktopPanelTab === 'chapters'}
              onClick={() => setDesktopPanelTab('chapters')}
              className={`inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                desktopPanelTab === 'chapters'
                  ? bedtimeMode
                    ? 'bg-stone-800 text-amber-200 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-accent shadow-xs'
                  : mutedText
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="tabular-nums">
                {isVi ? `Mục lục (${totalChapters})` : `Chapters (${totalChapters})`}
              </span>
            </button>
          </div>

          <div className="p-4 overflow-y-auto flex-1">
            {desktopPanelTab === 'settings'
              ? renderListeningSettingsContent(false)
              : renderChapterListItems()}
          </div>
        </section>
      </aside>

      {/* Always-Pinned Mobile Bottom Player & Settings Dock (Flush above Mobile Nav, Zero Top Clutter) */}
      {mobileSheet === 'none' && (
        <div
          role="region"
          aria-label={isVi ? 'Thanh điều khiển sách nói' : 'Audiobook player bar'}
          className={`lg:hidden fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] md:bottom-0 z-20 border-t shadow-[0_-6px_24px_rgba(15,23,42,0.08)] backdrop-blur-md md:pb-[env(safe-area-inset-bottom)] ${
            bedtimeMode
              ? 'border-stone-700/90 bg-[#26221F]/96 text-[#F5EFE6]'
              : 'border-slate-200/90 dark:border-slate-800/90 bg-white/96 dark:bg-slate-900/96 text-slate-900 dark:text-slate-100'
          }`}
        >
          {/* Top Progress Hairline */}
          <div
            className={`h-0.5 w-full ${
              bedtimeMode ? 'bg-stone-800' : 'bg-slate-200/80 dark:bg-slate-800'
            }`}
          >
            <div
              className={`h-full transition-all duration-300 ${
                bedtimeMode ? 'bg-amber-400' : 'bg-sky-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="max-w-3xl mx-auto px-2.5 sm:px-4 py-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleTogglePlay}
              aria-label={
                isCurrentlyPlaying
                  ? isVi
                    ? 'Tạm dừng sách nói'
                    : 'Pause audiobook'
                  : isVi
                    ? 'Nghe sách nói'
                    : 'Play audiobook'
              }
              className={`inline-flex items-center justify-center w-11 h-11 rounded-xl text-white shrink-0 cursor-pointer transition-colors shadow-xs ${
                bedtimeMode ? 'bg-amber-600 hover:bg-amber-700' : 'btn-accent'
              }`}
            >
              {isCurrentlyLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              ) : isCurrentlyPlaying ? (
                <Pause className="w-5 h-5 fill-current" aria-hidden="true" />
              ) : (
                <Play className="w-5 h-5 fill-current" aria-hidden="true" />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate">{activeChapterTitle}</p>
              <p className={`text-[11px] tabular-nums truncate ${mutedText}`}>
                {hasDirectMp3
                  ? `${formatTime(mp3CurrentTime)} / ${mp3Duration > 0 ? formatTime(mp3Duration) : '--:--'} · ${effectiveRate}x`
                  : isVi
                    ? `Đoạn ${activeParaIndex + 1}/${Math.max(1, paragraphs.length)} · ${effectiveRate}x`
                    : `Para ${activeParaIndex + 1}/${Math.max(1, paragraphs.length)} · ${effectiveRate}x`}
                {sleepRemainingSec > 0 ? ` · ${formatTime(sleepRemainingSec)}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => handleSeekBy(-15)}
                aria-label={hasDirectMp3 ? (isVi ? 'Lùi 15 giây' : 'Back 15s') : isVi ? 'Đoạn trước' : 'Previous paragraph'}
                className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border cursor-pointer transition-colors ${
                  bedtimeMode
                    ? 'border-stone-700 bg-stone-800/80 text-stone-200'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => handleSeekBy(15)}
                aria-label={hasDirectMp3 ? (isVi ? 'Tiến 15 giây' : 'Forward 15s') : isVi ? 'Đoạn tiếp' : 'Next paragraph'}
                className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border cursor-pointer transition-colors ${
                  bedtimeMode
                    ? 'border-stone-700 bg-stone-800/80 text-stone-200'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                <RotateCw className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => setMobileSheet('settings')}
                aria-label={isVi ? 'Cài đặt giọng đọc và tốc độ' : 'Voice and playback settings'}
                className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border cursor-pointer transition-colors ${
                  bedtimeMode
                    ? 'border-amber-400/40 bg-stone-800 text-amber-200'
                    : 'border-accent bg-accent-soft text-accent'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => setMobileSheet('chapters')}
                aria-label={isVi ? 'Mở mục lục chương' : 'Open chapters'}
                className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border cursor-pointer transition-colors ${
                  bedtimeMode
                    ? 'border-stone-700 bg-stone-800 text-stone-200'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                <ListOrdered className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet: Voice, Accent, Speed, Sleep Timer OR Chapters */}
      <AnimatePresence>
        {mobileSheet !== 'none' && (
          <div
            className="lg:hidden fixed inset-0 z-50 flex items-end justify-center"
            role="dialog"
            aria-modal="true"
            aria-label={
              mobileSheet === 'settings'
                ? isVi
                  ? 'Cài đặt giọng đọc và nghe sách nói'
                  : 'Audiobook voice and playback settings'
                : isVi
                  ? 'Mục lục các chương'
                  : 'Audiobook chapters'
            }
          >
            <motion.button
              type="button"
              aria-label={isVi ? 'Đóng bảng cài đặt' : 'Close sheet'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMobileSheet('none')}
              className="fixed inset-0 bg-slate-950/55 backdrop-blur-[2px]"
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className={`relative w-full max-w-lg max-h-[84dvh] rounded-t-3xl border-t border-x shadow-2xl flex flex-col overflow-hidden ${
                bedtimeMode
                  ? 'border-stone-700 bg-[#26221F] text-[#F5EFE6]'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
              }`}
            >
              {/* Drag Handle */}
              <div className="pt-2.5 pb-1 flex justify-center shrink-0">
                <div
                  className={`w-10 h-1 rounded-full ${
                    bedtimeMode ? 'bg-stone-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                />
              </div>

              {/* Sheet Header */}
              <div
                className={`px-5 py-3 border-b flex items-center justify-between gap-3 shrink-0 ${
                  bedtimeMode
                    ? 'border-stone-700'
                    : 'border-slate-100 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {mobileSheet === 'settings' ? (
                    <SlidersHorizontal
                      className={`w-4 h-4 shrink-0 ${bedtimeMode ? 'text-amber-300' : 'text-accent'}`}
                      aria-hidden="true"
                    />
                  ) : (
                    <ListOrdered
                      className={`w-4 h-4 shrink-0 ${bedtimeMode ? 'text-amber-300' : 'text-accent'}`}
                      aria-hidden="true"
                    />
                  )}
                  <h3 className="text-base font-bold truncate">
                    {mobileSheet === 'settings'
                      ? isVi
                        ? 'Cài đặt giọng đọc & Nghe sách'
                        : 'Voice & Playback Settings'
                      : isVi
                        ? `Mục lục (${totalChapters} chương)`
                        : `Chapters (${totalChapters})`}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileSheet('none')}
                  aria-label={isVi ? 'Đóng' : 'Close'}
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border cursor-pointer shrink-0 ${
                    bedtimeMode
                      ? 'border-stone-700 bg-stone-800 text-stone-200'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {/* Sheet Scrollable Content */}
              <div className="px-5 py-4 overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
                {mobileSheet === 'settings'
                  ? renderListeningSettingsContent(true)
                  : renderChapterListItems()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

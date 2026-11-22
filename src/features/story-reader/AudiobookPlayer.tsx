'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [showChaptersMobile, setShowChaptersMobile] = useState(false);

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

  // Sync audio playbackRate
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = effectiveRate;
    }
  }, [effectiveRate]);

  // Reset state when chapter or story changes
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
      audioRef.current.playbackRate = effectiveRate;
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
  }, [story.id, chapterIndex, directAudioUrl, hasDirectMp3, chapter?.durationSec, effectiveRate]);

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
    setShowChaptersMobile(false);
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Hidden native HTML5 audio element for direct MP3 chapters */}
      {hasDirectMp3 && directAudioUrl && (
        <audio
          ref={audioRef}
          src={directAudioUrl}
          preload="metadata"
          onLoadedMetadata={(e) => {
            const dur = e.currentTarget.duration;
            if (Number.isFinite(dur) && dur > 0) setMp3Duration(dur);
            e.currentTarget.playbackRate = effectiveRate;
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
      <section className={`lg:col-span-8 rounded-2xl border overflow-hidden ${cardSurface}`}>
        {/* Top Book Hero Strip */}
        <div
          className={`p-5 sm:p-6 border-b flex flex-col sm:flex-row gap-5 items-start sm:items-center ${
            bedtimeMode
              ? 'bg-stone-900/70 border-stone-700'
              : 'bg-gradient-to-br from-slate-50 to-sky-50/40 dark:from-slate-950 dark:to-slate-900 border-slate-100 dark:border-slate-800'
          }`}
        >
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border border-slate-200/70 dark:border-slate-700 bg-[#FAF8F2] dark:bg-slate-800 shadow-sm shrink-0">
            <AssetImage
              assetRef={story.coverAssetRef}
              altOverride={bookTitle}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                  bedtimeMode
                    ? 'bg-amber-950/80 text-amber-200 border border-amber-500/40'
                    : 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/70'
                }`}
              >
                <Headphones className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {hasDirectMp3
                    ? isVi
                      ? 'Sách nói MP3 (Người thật đọc)'
                      : 'Human-Narrated MP3 Audiobook'
                    : isVi
                      ? 'Sách nói & Truyện dài nhiều chương'
                      : 'Long-Form Audiobook'}
                </span>
              </span>

              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                  bedtimeMode
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70'
                }`}
              >
                <InfinityIcon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {isVi ? 'Nghe không giới hạn thời gian' : 'Unlimited listening'}
                </span>
              </span>
            </div>

            <div className="space-y-0.5">
              <h2 className="text-xl sm:text-2xl font-bold leading-snug">
                {bookTitle}
              </h2>
              {story.author && (
                <p className={`text-xs font-medium ${mutedText}`}>
                  {story.author}
                  {story.totalDurationSec
                    ? ` · ~${Math.max(1, Math.round(story.totalDurationSec / 60))} ${isVi ? 'phút' : 'min'}`
                    : ''}
                  {` · ${totalChapters} ${isVi ? 'chương' : 'chapters'}`}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={onSwitchToPictureMode}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                  bedtimeMode
                    ? 'border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-accent'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {isVi ? 'Đọc kiểu từng trang minh họa' : 'Switch to Picture Mode'}
                </span>
              </button>

              {offlineSaving && offlineAudioProgress ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 text-xs font-semibold tabular-nums">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  <span>
                    {offlineAudioProgress.done}/{offlineAudioProgress.total}
                  </span>
                </span>
              ) : offlineRecord.status === 'ready' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                  <Cloud className="w-3.5 h-3.5" aria-hidden="true" />
                  <Check className="w-3 h-3 -ml-1" aria-hidden="true" />
                  <span>
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                    bedtimeMode
                      ? 'border-amber-400/40 bg-stone-800 text-amber-200 hover:bg-stone-700'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-accent'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isVi ? 'Lưu đọc ngoại tuyến' : 'Save Offline'}</span>
                </button>
              )}

              {savedNotice && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {isVi ? 'Đã đánh dấu chương' : 'Bookmark saved'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dedicated Audiobook Transport Console */}
        <div
          className={`p-5 sm:p-6 border-b space-y-4 ${
            bedtimeMode
              ? 'bg-[#1F1B18] border-stone-700'
              : 'bg-slate-50/70 dark:bg-slate-950/70 border-slate-100 dark:border-slate-800'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className={`text-[11px] font-bold uppercase tracking-wide ${mutedText}`}>
                {isVi
                  ? `Đang nghe · Chương ${chapterIndex + 1} / ${totalChapters}`
                  : `Now Playing · Chapter ${chapterIndex + 1} of ${totalChapters}`}
              </p>
              <h3 className="text-base sm:text-lg font-bold truncate">
                {activeChapterTitle}
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setShowChaptersMobile((v) => !v)}
              className={`lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                bedtimeMode
                  ? 'border-stone-700 bg-stone-800 text-amber-200'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {isVi ? 'Mục lục' : 'Chapters'} ({totalChapters})
              </span>
            </button>
          </div>

          {/* Progress Bar (Real MP3 Seek Slider OR Paragraph Progress Bar) */}
          {hasDirectMp3 ? (
            <div className="space-y-1.5">
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
                className="w-full accent-sky-600 cursor-pointer"
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
                  style={{
                    width: `${Math.round(
                      ((activeParaIndex + 1) / Math.max(1, paragraphs.length)) * 100
                    )}%`,
                  }}
                />
              </div>
              <div className={`flex items-center justify-between text-xs tabular-nums ${mutedText}`}>
                <span>
                  {isVi
                    ? `Đoạn ${activeParaIndex + 1} / ${Math.max(1, paragraphs.length)}`
                    : `Paragraph ${activeParaIndex + 1} of ${Math.max(1, paragraphs.length)}`}
                </span>
                <span>
                  {isVi
                    ? 'Chạm vào bất kỳ đoạn văn nào để nghe từ đoạn đó'
                    : 'Tap any paragraph below to start listening there'}
                </span>
              </div>
            </div>
          )}

          {mp3Error && (
            <div className="rounded-xl border border-amber-300/70 bg-amber-50 dark:bg-amber-950/50 px-3.5 py-2 text-xs font-medium text-amber-800 dark:text-amber-200">
              {mp3Error}
            </div>
          )}

          {sleepDoneNotice && (
            <div className="rounded-xl border border-amber-400/40 bg-stone-900 text-amber-100 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-2">
                <Moon className="w-4 h-4 text-amber-300" aria-hidden="true" />
                <span>
                  {isVi
                    ? 'Đã tạm dừng sách nói theo đồng hồ hẹn giờ ngủ. Chúc ngủ ngon!'
                    : 'Audiobook paused automatically by your sleep timer. Sweet dreams!'}
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

          {/* Main Transport Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={chapterIndex === 0}
                onClick={() => handleJumpChapter(chapterIndex - 1)}
                title={isVi ? 'Chương trước' : 'Previous chapter'}
                aria-label={isVi ? 'Chương trước' : 'Previous chapter'}
                className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors ${
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
                className={`inline-flex items-center gap-1 px-2.5 h-10 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                  bedtimeMode
                    ? 'border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{hasDirectMp3 ? '15s' : isVi ? 'Đoạn' : 'Prev'}</span>
              </button>

              <button
                type="button"
                onClick={handleTogglePlay}
                className={`inline-flex items-center gap-2 px-5 h-12 rounded-2xl text-white text-sm font-bold shadow-sm cursor-pointer transition-colors ${
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

              <button
                type="button"
                onClick={() => handleSeekBy(15)}
                title={hasDirectMp3 ? (isVi ? 'Tua nhanh 15 giây' : 'Forward 15s') : isVi ? 'Đoạn tiếp' : 'Next paragraph'}
                className={`inline-flex items-center gap-1 px-2.5 h-10 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
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
                className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors ${
                  bedtimeMode
                    ? 'border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <SkipForward className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Playback Speed Quick Selector */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className={`text-[11px] font-semibold mr-1 ${mutedText}`}>
                {isVi ? 'Tốc độ:' : 'Speed:'}
              </span>
              {SPEED_OPTIONS.map((rate) => {
                const active = Math.abs(playbackRate - rate) < 0.01;
                return (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setPlaybackRate(rate)}
                    className={`px-2 py-1 rounded-lg text-xs font-bold tabular-nums cursor-pointer transition-colors ${
                      active
                        ? bedtimeMode
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                        : bedtimeMode
                          ? 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {rate}x
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Long-Form Book Reading Canvas */}
        <div className="p-6 sm:p-8 space-y-5">
          {/* Reader Font Size & Language Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Type className={`w-4 h-4 ${mutedText}`} aria-hidden="true" />
              <span className={`text-xs font-semibold ${mutedText}`}>
                {isVi ? 'Cỡ chữ đọc:' : 'Text size:'}
              </span>
              {(['sm', 'md', 'lg'] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setFontSize(sz)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
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
                <span className={`text-xs font-semibold ${mutedText}`}>
                  {isVi ? 'Ngôn ngữ truyện:' : 'Book language:'}
                </span>
                <select
                  value={narrationLocale}
                  onChange={(e) => {
                    stopAllPlayback();
                    onChangeNarrationLocale(e.target.value);
                  }}
                  className={`min-h-[34px] rounded-xl border px-2.5 text-xs font-semibold ${
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

          {/* Scrollable Literary Paragraphs */}
          <article className="space-y-4 max-h-[540px] overflow-y-auto pr-1">
            {paragraphs.map((para, idx) => {
              const isHighlighted = !hasDirectMp3 && activeParaIndex === idx;
              return (
                <div
                  key={`${chapterIndex}-${idx}`}
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
                  className={`rounded-xl px-4 py-3 transition-colors ${
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
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={chapterIndex === 0}
              onClick={() => handleJumpChapter(chapterIndex - 1)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold disabled:opacity-40 cursor-pointer disabled:cursor-default ${
                bedtimeMode
                  ? 'border-stone-700 bg-stone-900 text-stone-200 hover:bg-stone-800'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <SkipBack className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isVi ? 'Chương trước' : 'Previous Chapter'}</span>
            </button>

            <span className={`text-xs font-semibold tabular-nums ${mutedText}`}>
              {isVi
                ? `Chương ${chapterIndex + 1} / ${totalChapters}`
                : `Chapter ${chapterIndex + 1} / ${totalChapters}`}
            </span>

            <button
              type="button"
              disabled={chapterIndex + 1 >= totalChapters}
              onClick={() => handleJumpChapter(chapterIndex + 1)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-40 cursor-pointer disabled:cursor-default ${
                bedtimeMode
                  ? 'bg-stone-100 text-stone-900 hover:bg-white'
                  : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white'
              }`}
            >
              <span>{isVi ? 'Chương tiếp theo' : 'Next Chapter'}</span>
              <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* Right Sidebar: Chapter List + Sleep Timer + Voice Settings */}
      <aside className="lg:col-span-4 space-y-5">
        {/* Chapter Table of Contents */}
        <section
          className={`rounded-2xl border p-5 space-y-3 ${cardSurface} ${
            showChaptersMobile ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold inline-flex items-center gap-2">
              <ListOrdered
                className={`w-4 h-4 ${bedtimeMode ? 'text-amber-300' : 'text-accent'}`}
                aria-hidden="true"
              />
              <span>
                {isVi ? 'Mục lục các chương' : 'Chapters'} ({totalChapters})
              </span>
            </h3>
            <span className={`text-[11px] font-medium ${mutedText}`}>
              {isVi ? 'Tự lưu vị trí' : 'Auto-bookmarked'}
            </span>
          </div>

          <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
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
                  className={`w-full text-left px-3 py-2.5 rounded-xl border text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                    active
                      ? bedtimeMode
                        ? 'border-amber-400/70 bg-stone-800 text-amber-100 font-bold'
                        : 'border-accent bg-accent-soft font-bold'
                      : bedtimeMode
                        ? 'border-stone-800 bg-stone-900/50 text-stone-300 hover:border-stone-600'
                        : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-md inline-flex items-center justify-center text-[10px] font-bold shrink-0 ${
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
                        <Volume2 className="w-3 h-3" aria-hidden="true" />
                      ) : (
                        idx + 1
                      )}
                    </span>
                    <span className="truncate">{title}</span>
                  </span>
                  {seg.durationSec ? (
                    <span className={`text-[10px] tabular-nums shrink-0 ${mutedText}`}>
                      {formatTime(seg.durationSec)}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        {/* Sleep Timer & Listening Preferences */}
        <section className={`rounded-2xl border p-5 space-y-4 ${cardSurface}`}>
          <div className="space-y-2.5">
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
                  className={`py-1.5 px-1 rounded-lg text-xs font-semibold tabular-nums cursor-pointer transition-colors ${
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

          <label className="flex items-center justify-between gap-2 text-xs font-medium cursor-pointer pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>
              {isVi
                ? 'Tự động phát tiếp chương kế tiếp'
                : 'Auto-play next chapter continuously'}
            </span>
            <input
              type="checkbox"
              checked={autoNextChapter}
              onChange={(e) => setAutoNextChapter(e.target.checked)}
              className="w-4 h-4 accent-sky-600"
            />
          </label>

          {!hasDirectMp3 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
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
        </section>
      </aside>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Compass,
  Download,
  Moon,
  PlayCircle,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  Sun,
  Volume2,
  X,
} from 'lucide-react';
import type {
  AgeGroupConfig,
  LearnerProfile,
  LocaleConfig,
  StoryBook,
  VoiceProfile,
} from '../../../packages/contracts/types';
import type { UiMessages } from '../../i18n/messages';
import { apiClient } from '../../shared/apiClient';
import { speakText, stopSpeaking } from '../../audio/speechPlayer';
import {
  playCelebrationFanfare,
  playPageTurn,
  playSuccessChime,
} from '../../audio/soundEffects';
import {
  recordLearnerActivity,
  recordWordReplay,
} from '../../lib/learnerRewards';
import {
  cacheContent,
  enqueueOfflineMutation,
  getCachedContent,
} from '../../lib/offlineQueue';
import { AssetImage } from '../../components/AssetImage';
import { StorySourceDiscovery } from './StorySourceDiscovery';

interface StoryReaderProps {
  learner: LearnerProfile;
  ageGroups?: AgeGroupConfig[];
  languages: LocaleConfig[];
  messages: UiMessages;
  onOpenPackage?: (packageId?: string) => void;
}

interface WordPopEntry {
  word: string;
  meaningVi: string;
  meaningEn: string;
  assetRef?: string;
}

const STORY_WORD_GLOSSARY: Record<string, WordPopEntry> = {
  apple: {
    word: 'Apple',
    meaningVi: 'Quả táo — giòn và ngọt',
    meaningEn: 'A sweet, crunchy fruit',
    assetRef: 'img-apple',
  },
  apples: {
    word: 'Apples',
    meaningVi: 'Những quả táo đỏ tươi',
    meaningEn: 'Fresh red apples',
    assetRef: 'img-apple',
  },
  banana: {
    word: 'Banana',
    meaningVi: 'Quả chuối vàng mềm ngọt',
    meaningEn: 'A soft, sweet yellow fruit',
    assetRef: 'img-banana',
  },
  bananas: {
    word: 'Bananas',
    meaningVi: 'Những quả chuối chín vàng',
    meaningEn: 'Ripe yellow bananas',
    assetRef: 'img-banana',
  },
  orange: {
    word: 'Orange',
    meaningVi: 'Quả cam mọng nước giàu vitamin C',
    meaningEn: 'A juicy citrus fruit',
    assetRef: 'img-orange',
  },
  oranges: {
    word: 'Oranges',
    meaningVi: 'Những quả cam mọng nước',
    meaningEn: 'Juicy oranges',
    assetRef: 'img-orange',
  },
  cat: {
    word: 'Cat',
    meaningVi: 'Bạn mèo con êm ái',
    meaningEn: 'A soft, gentle kitten',
    assetRef: 'img-cat',
  },
  dog: {
    word: 'Dog',
    meaningVi: 'Bạn cún con thân thiện',
    meaningEn: 'A friendly playful puppy',
    assetRef: 'img-dog',
  },
  duck: {
    word: 'Duck',
    meaningVi: 'Bạn vịt vàng thích bơi lội',
    meaningEn: 'A cheerful yellow duck',
    assetRef: 'img-duck',
  },
  farm: {
    word: 'Farm',
    meaningVi: 'Nông trại đầy nắng và các bạn thú',
    meaningEn: 'A sunny place where animals live',
    assetRef: 'img-story-sunny-farm',
  },
  market: {
    word: 'Market',
    meaningVi: 'Khu chợ trái cây rực rỡ sắc màu',
    meaningEn: 'A colorful fruit market',
    assetRef: 'img-story-fruit-market',
  },
  táo: {
    word: 'Táo',
    meaningVi: 'Apple — Quả táo giòn ngọt',
    meaningEn: 'Apple — a crunchy red fruit',
    assetRef: 'img-apple',
  },
  chuối: {
    word: 'Chuối',
    meaningVi: 'Banana — Quả chuối vàng',
    meaningEn: 'Banana — a sweet yellow fruit',
    assetRef: 'img-banana',
  },
  cam: {
    word: 'Cam',
    meaningVi: 'Orange — Quả cam thơm mát',
    meaningEn: 'Orange — a juicy citrus fruit',
    assetRef: 'img-orange',
  },
  mèo: {
    word: 'Mèo',
    meaningVi: 'Cat — Chú mèo ngoan',
    meaningEn: 'Cat — a cozy kitten',
    assetRef: 'img-cat',
  },
  chó: {
    word: 'Chó',
    meaningVi: 'Dog — Bạn cún tinh nghịch',
    meaningEn: 'Dog — a playful puppy',
    assetRef: 'img-dog',
  },
  vịt: {
    word: 'Vịt',
    meaningVi: 'Duck — Chú vịt vàng',
    meaningEn: 'Duck — a curious duckling',
    assetRef: 'img-duck',
  },
};

function cleanToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

export function StoryReader({
  learner,
  ageGroups = [],
  languages,
  messages,
  onOpenPackage,
}: StoryReaderProps) {
  const isVi = learner.preferences.interfaceLocale === 'vi';
  const [stories, setStories] = useState<StoryBook[]>([]);
  const [viewTab, setViewTab] = useState<'library' | 'discover'>('library');
  const [ageFilter, setAgeFilter] = useState<string>(learner.ageBand || 'all');
  const [librarySearch, setLibrarySearch] = useState<string>('');
  const [activeStoryId, setActiveStoryId] = useState('story-fruit-market');
  const [story, setStory] = useState<StoryBook | null>(null);

  useEffect(() => {
    if (learner.ageBand) {
      setAgeFilter(learner.ageBand);
    }
  }, [learner.id, learner.ageBand]);
  const [narrationLocale, setNarrationLocale] = useState(
    learner.preferences.narrationLocale
  );
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [speed, setSpeed] = useState(learner.preferences.audioSpeed);
  const [showCaptions, setShowCaptions] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  // Feature upgrades: Read-along highlight, Interactive Word Pop, Bedtime Mode + Sleep Timer
  const [activeWordIdx, setActiveWordIdx] = useState<number>(-1);
  const [poppedWord, setPoppedWord] = useState<WordPopEntry | null>(null);
  const [bedtimeMode, setBedtimeMode] = useState(false);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<0 | 5 | 10>(0);
  const [sleepRemainingSec, setSleepRemainingSec] = useState<number>(0);
  const [storyRewardedId, setStoryRewardedId] = useState<string | null>(null);

  const autoAdvanceTimerRef = useRef<number | null>(null);
  const highlightIntervalRef = useRef<number | null>(null);
  const autoAdvanceRef = useRef(autoAdvance);
  autoAdvanceRef.current = autoAdvance;

  const clearAutoTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  const clearHighlightTimer = useCallback(() => {
    if (highlightIntervalRef.current !== null) {
      window.clearInterval(highlightIntervalRef.current);
      highlightIntervalRef.current = null;
    }
    setActiveWordIdx(-1);
  }, []);

  useEffect(() => {
    setNarrationLocale(learner.preferences.narrationLocale);
  }, [learner.preferences.narrationLocale]);

  // Bedtime Sleep Timer countdown
  useEffect(() => {
    if (sleepTimerMinutes === 0) {
      setSleepRemainingSec(0);
      return;
    }
    setSleepRemainingSec(sleepTimerMinutes * 60);
    const id = window.setInterval(() => {
      setSleepRemainingSec((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          clearAutoTimer();
          clearHighlightTimer();
          stopSpeaking();
          setIsPlaying(false);
          setAutoAdvance(false);
          setSleepTimerMinutes(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [sleepTimerMinutes, clearAutoTimer, clearHighlightTimer]);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getStories()
      .then((res) => {
        if (cancelled) return;
        setStories(res.stories);
        void cacheContent('stories:catalog', res.stories);
        if (
          res.stories.length > 0 &&
          !res.stories.some((s) => s.id === activeStoryId)
        ) {
          setActiveStoryId(res.stories[0].id);
        }
      })
      .catch(async () => {
        const cached = await getCachedContent<StoryBook[]>('stories:catalog');
        if (!cancelled && cached && cached.length > 0) {
          setStories(cached);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeStoryId]);

  useEffect(() => {
    let cancelled = false;
    clearAutoTimer();
    clearHighlightTimer();
    setSegmentIndex(0);
    setIsPlaying(false);
    setPoppedWord(null);
    const storyCacheKey = `story:${activeStoryId}`;
    apiClient
      .getStory(activeStoryId, learner.id)
      .then((res) => {
        if (cancelled) return;
        setStory(res.story);
        void cacheContent(storyCacheKey, res.story);
        if (res.readingPosition) {
          setSegmentIndex(
            Math.min(
              res.readingPosition.segmentIndex,
              res.story.segments.length - 1
            )
          );
        }
      })
      .catch(async () => {
        const cached = await getCachedContent<StoryBook>(storyCacheKey);
        if (!cancelled && cached) {
          setStory(cached);
        }
      });

    return () => {
      cancelled = true;
      clearAutoTimer();
      clearHighlightTimer();
      stopSpeaking();
    };
  }, [activeStoryId, learner.id, clearAutoTimer, clearHighlightTimer]);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getVoices(narrationLocale)
      .then((res) => {
        if (cancelled) return;
        setVoices(res.voices);
        setSelectedVoiceId(res.voices[0]?.voiceId ?? '');
      })
      .catch(() => {
        if (!cancelled) {
          setVoices([]);
          setSelectedVoiceId('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [narrationLocale]);

  const filteredStories = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    return stories.filter((s) => {
      if (ageFilter !== 'all' && !s.ageBands.includes(ageFilter)) {
        return false;
      }
      if (q) {
        const hay = [
          ...Object.values(s.titles),
          ...Object.values(s.summaries),
          s.sourceName || '',
          s.author || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [stories, ageFilter, librarySearch]);

  const handleStoryImported = (imported: StoryBook) => {
    clearAutoTimer();
    clearHighlightTimer();
    stopSpeaking();
    setIsPlaying(false);
    setPoppedWord(null);
    setStories((prev) => {
      const next = [imported, ...prev.filter((s) => s.id !== imported.id)];
      void cacheContent('stories:catalog', next);
      return next;
    });
    void cacheContent(`story:${imported.id}`, imported);
    setStory(imported);
    setActiveStoryId(imported.id);
    setSegmentIndex(0);
    if (
      imported.availableLocales.length > 0 &&
      !imported.availableLocales.includes(narrationLocale)
    ) {
      setNarrationLocale(imported.availableLocales[0]);
    }
    setViewTab('library');
  };

  const handleOpenExistingFromDiscovery = (storyId: string) => {
    clearAutoTimer();
    clearHighlightTimer();
    stopSpeaking();
    setIsPlaying(false);
    setActiveStoryId(storyId);
    setViewTab('library');
  };

  const segment = story ? (story.segments[segmentIndex] ?? story.segments[0]) : null;
  const explanationLocale = learner.preferences.explanationLocale;
  const segmentText = segment
    ? (segment.textByLocale[narrationLocale] ??
      segment.textByLocale.en ??
      Object.values(segment.textByLocale)[0] ??
      '')
    : '';
  const segmentExplanation = segment
    ? (segment.explanationByLocale[explanationLocale] ??
      segment.explanationByLocale.vi ??
      Object.values(segment.explanationByLocale)[0] ??
      '')
    : '';
  const activeVoice =
    voices.find((v) => v.voiceId === selectedVoiceId) ?? null;
  const segmentAudioUrl = segment?.audioUrlByLocale?.[narrationLocale];
  const isLastPage = story ? segmentIndex + 1 >= story.segments.length : false;
  const words = useMemo(
    () => (segmentText ? segmentText.split(/\s+/).filter(Boolean) : []),
    [segmentText]
  );

  // Record story completion reward once per story when reaching the final page
  useEffect(() => {
    if (story && isLastPage && storyRewardedId !== story.id) {
      setStoryRewardedId(story.id);
      recordLearnerActivity(learner.id, {
        kind: 'story',
        sourceId: story.id,
        wordsCount: Math.max(3, story.segments.length),
      });
      playCelebrationFanfare();
    }
  }, [story, isLastPage, storyRewardedId, learner.id]);

  if (viewTab === 'library' && (!story || !segment)) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="h-24 rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
          <div className="h-24 rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-800" />
            <div className="p-8 space-y-4">
              <div className="h-4 w-48 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800/70" />
            </div>
          </div>
          <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="h-5 w-40 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800/70" />
            <div className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800/70" />
          </div>
        </div>
      </div>
    );
  }

  const effectiveSpeed = bedtimeMode ? Math.min(speed, 0.8) : speed;

  const persistPosition = async (nextIndex: number, nextLocale: string) => {
    if (!story) return;
    const payload = {
      learnerId: learner.id,
      narrationLocale: nextLocale,
      segmentIndex: nextIndex,
    };
    try {
      await apiClient.saveStoryPosition(story.id, payload);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    } catch {
      await enqueueOfflineMutation({
        kind: 'story_position',
        storyId: story.id,
        payload,
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    }
  };

  const startReadAlongTicker = (text: string, rate: number) => {
    clearHighlightTimer();
    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return;
    const msPerWord = Math.max(240, Math.round(420 / Math.max(0.6, rate)));
    let idx = 0;
    setActiveWordIdx(0);
    highlightIntervalRef.current = window.setInterval(() => {
      idx += 1;
      if (idx >= tokens.length) {
        clearHighlightTimer();
      } else {
        setActiveWordIdx(idx);
      }
    }, msPerWord);
  };

  const playSegmentAt = (idx: number) => {
    if (!story) return;
    const target = story.segments[idx];
    if (!target) return;
    const text =
      target.textByLocale[narrationLocale] ??
      target.textByLocale.en ??
      Object.values(target.textByLocale)[0] ??
      '';
    const audioUrl = target.audioUrlByLocale?.[narrationLocale];

    speakText({
      text,
      locale: narrationLocale,
      rate: effectiveSpeed,
      audioUrl,
      voiceProfile: activeVoice,
      onStart: () => {
        setIsPlaying(true);
        startReadAlongTicker(text, effectiveSpeed);
      },
      onEnd: () => {
        setIsPlaying(false);
        clearHighlightTimer();
        if (autoAdvanceRef.current && idx + 1 < story.segments.length) {
          clearAutoTimer();
          autoAdvanceTimerRef.current = window.setTimeout(() => {
            const nextIdx = idx + 1;
            setSegmentIndex(nextIdx);
            setPoppedWord(null);
            playPageTurn();
            void persistPosition(nextIdx, narrationLocale);
            playSegmentAt(nextIdx);
          }, 700);
        }
      },
    });
  };

  const handlePlayToggle = () => {
    clearAutoTimer();
    if (isPlaying) {
      stopSpeaking();
      clearHighlightTimer();
      setIsPlaying(false);
      return;
    }
    playSegmentAt(segmentIndex);
  };

  const goToSegment = (nextIndex: number) => {
    clearAutoTimer();
    clearHighlightTimer();
    stopSpeaking();
    setIsPlaying(false);
    setPoppedWord(null);
    setSegmentIndex(nextIndex);
    playPageTurn();
    void persistPosition(nextIndex, narrationLocale);
  };

  const handleWordTap = (rawToken: string) => {
    const normalized = cleanToken(rawToken);
    if (!normalized) return;
    const glossaryMatch = STORY_WORD_GLOSSARY[normalized];
    const entry: WordPopEntry = glossaryMatch ?? {
      word: rawToken.replace(/[.,!?;:"'()]+$/g, ''),
      meaningVi: isVi
        ? 'Chạm nút Nghe chậm để luyện phát âm từ này cùng bé.'
        : 'Tap Listen Slowly to practice pronouncing this word.',
      meaningEn: 'Tap Listen Slowly to practice pronouncing this word.',
    };
    setPoppedWord(entry);
    recordWordReplay(learner.id, `story-word:${normalized}`, entry.word);
    playSuccessChime();
    speakText({
      text: entry.word,
      locale: narrationLocale,
      rate: 0.78,
      voiceProfile: activeVoice,
    });
  };

  const getLocaleLabel = (code: string) => {
    const found = languages.find((l) => l.locale === code);
    return found ? `${found.nativeName} (${found.locale})` : code;
  };

  const toggleBedtimeMode = () => {
    setBedtimeMode((prev) => {
      const next = !prev;
      if (next && speed > 0.85) {
        setSpeed(0.8);
      }
      return next;
    });
  };

  const formatTimer = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      className={`space-y-6 rounded-3xl transition-colors duration-300 ${
        bedtimeMode ? 'bg-[#1C1917] text-[#F5EFE6] p-4 sm:p-6' : ''
      }`}
    >
      {/* Top Mode Switcher: My Library vs. Discover & Download from Sources */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className={`inline-flex rounded-2xl border p-1 gap-1 ${
            bedtimeMode
              ? 'border-stone-700 bg-stone-900'
              : 'border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900'
          }`}
          role="tablist"
          aria-label={isVi ? 'Chế độ thư viện truyện' : 'Story library mode'}
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewTab === 'library'}
            onClick={() => setViewTab('library')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              viewTab === 'library'
                ? bedtimeMode
                  ? 'bg-stone-800 text-amber-200 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : bedtimeMode
                  ? 'text-stone-400 hover:text-stone-200'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4" aria-hidden="true" />
            <span>
              {isVi ? 'Kệ truyện của bạn' : 'My Library'} ({stories.length})
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewTab === 'discover'}
            onClick={() => {
              clearAutoTimer();
              clearHighlightTimer();
              stopSpeaking();
              setIsPlaying(false);
              setViewTab('discover');
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              viewTab === 'discover'
                ? bedtimeMode
                  ? 'bg-stone-800 text-amber-200 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-accent shadow-xs'
                : bedtimeMode
                  ? 'text-stone-400 hover:text-stone-200'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Compass className="w-4 h-4" aria-hidden="true" />
            <span>
              {isVi ? 'Khám phá & Tải truyện' : 'Discover & Download'}
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={toggleBedtimeMode}
          aria-pressed={bedtimeMode}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
            bedtimeMode
              ? 'border-amber-400/50 bg-amber-950/70 text-amber-200 hover:bg-amber-900/70'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          {bedtimeMode ? (
            <Sun className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" aria-hidden="true" />
          )}
          <span>
            {bedtimeMode
              ? isVi
                ? 'Tắt chế độ đi ngủ'
                : 'Exit Bedtime Mode'
              : isVi
                ? 'Chế độ đi ngủ'
                : 'Bedtime Mode'}
          </span>
        </button>
      </div>

      {viewTab === 'discover' ? (
        <StorySourceDiscovery
          interfaceLocale={learner.preferences.interfaceLocale}
          ageGroups={ageGroups}
          initialAgeBand={learner.ageBand}
          bedtimeMode={bedtimeMode}
          onStoryImported={handleStoryImported}
          onOpenExistingStory={handleOpenExistingFromDiscovery}
        />
      ) : (
        <>
          {/* Visual Story Bookshelf */}
          {stories.length > 0 && (
            <section
              aria-label={isVi ? 'Kệ sách truyện kể' : 'Picture story bookshelf'}
              className="space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2
                  className={`text-sm font-bold inline-flex items-center gap-2 ${
                    bedtimeMode
                      ? 'text-[#F5EFE6]'
                      : 'text-slate-900 dark:text-slate-100'
                  }`}
                >
                  <BookOpen
                    className={`w-4 h-4 ${
                      bedtimeMode ? 'text-amber-300' : 'text-accent'
                    }`}
                    aria-hidden="true"
                  />
                  <span>
                    {isVi ? 'Chọn truyện tranh để đọc' : 'Choose a picture story'}
                  </span>
                </h2>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search
                      className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={librarySearch}
                      onChange={(e) => setLibrarySearch(e.target.value)}
                      placeholder={isVi ? 'Lọc nhanh trên kệ...' : 'Filter shelf...'}
                      className={`min-h-[34px] w-40 sm:w-48 rounded-xl border pl-8 pr-2.5 text-xs ${
                        bedtimeMode
                          ? 'border-stone-700 bg-stone-900 text-stone-200 placeholder:text-stone-500'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 placeholder:text-slate-400'
                      }`}
                    />
                  </div>

                  {ageGroups.length > 0 && (
                    <select
                      value={ageFilter}
                      onChange={(e) => setAgeFilter(e.target.value)}
                      aria-label={isVi ? 'Lọc theo nhóm tuổi' : 'Filter by age group'}
                      className={`min-h-[34px] rounded-xl border px-2.5 text-xs font-semibold ${
                        bedtimeMode
                          ? 'border-stone-700 bg-stone-900 text-stone-200'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <option value="all">
                        {isVi ? 'Mọi nhóm tuổi' : 'All ages'} ({stories.length})
                      </option>
                      {ageGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {isVi ? g.shortLabels.vi : g.shortLabels.en}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    type="button"
                    onClick={() => setViewTab('discover')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-xl border text-xs font-semibold cursor-pointer ${
                      bedtimeMode
                        ? 'border-amber-400/40 bg-stone-800 text-amber-200 hover:bg-stone-700'
                        : 'border-accent bg-accent-soft'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{isVi ? 'Tải thêm truyện' : 'Get more stories'}</span>
                  </button>
                </div>
              </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(filteredStories.length > 0 ? filteredStories : stories).map((item) => {
              const selected = item.id === activeStoryId;
              const itemTitle =
                item.titles[learner.preferences.interfaceLocale] ||
                item.titles.en ||
                Object.values(item.titles)[0];
              const itemSummary =
                item.summaries[learner.preferences.interfaceLocale] ||
                item.summaries.vi ||
                Object.values(item.summaries)[0] ||
                '';
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    clearAutoTimer();
                    clearHighlightTimer();
                    stopSpeaking();
                    setIsPlaying(false);
                    setActiveStoryId(item.id);
                  }}
                  className={`group text-left rounded-2xl border p-3 flex items-center gap-3.5 transition-colors cursor-pointer ${
                    bedtimeMode
                      ? selected
                        ? 'border-amber-400/70 bg-stone-800/90'
                        : 'border-stone-700 bg-stone-900/70 hover:border-stone-500'
                      : selected
                        ? 'border-accent bg-accent-soft'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-accent'
                  }`}
                >
                  <div className="w-20 h-16 rounded-xl overflow-hidden border border-slate-200/40 dark:border-slate-700 bg-[#FAF8F2] dark:bg-slate-800 shrink-0">
                    <AssetImage
                      assetRef={item.coverAssetRef}
                      altOverride={itemTitle}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-sm font-bold truncate ${
                          bedtimeMode
                            ? 'text-[#F5EFE6]'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {itemTitle}
                      </p>
                      {selected && (
                        <Check
                          className={`w-4 h-4 shrink-0 ${
                            bedtimeMode ? 'text-amber-300' : 'text-accent'
                          }`}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <p
                      className={`text-xs line-clamp-2 ${
                        bedtimeMode
                          ? 'text-stone-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {itemSummary}
                    </p>
                    <p
                      className={`text-[11px] font-medium tabular-nums pt-0.5 truncate ${
                        bedtimeMode
                          ? 'text-stone-500'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {item.segments.length} {isVi ? 'trang' : 'pages'} ·{' '}
                      {item.ageBands.join(', ')}
                      {item.sourceName ? ` · ${item.sourceName}` : ''}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {story && segment && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left/Primary Zone: Picture Book Stage */}
        <section
          className={`lg:col-span-8 rounded-2xl border overflow-hidden ${
            bedtimeMode
              ? 'border-stone-700 bg-[#26221F]'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
          }`}
        >
          <div
            className={`aspect-[16/10] w-full overflow-hidden border-b ${
              bedtimeMode
                ? 'bg-[#2C2722] border-stone-700'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800'
            }`}
          >
            <AssetImage
              assetRef={segment.assetRef}
              altOverride={story.titles[narrationLocale] ?? story.titles.en}
              className={`w-full h-full object-contain ${
                bedtimeMode
                  ? 'bg-[#2C2722] brightness-90'
                  : 'bg-[#FAF8F2] dark:bg-slate-950'
              }`}
            />
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div
              className={`flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums ${
                bedtimeMode
                  ? 'text-stone-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span>
                {story.titles[narrationLocale] ?? story.titles.en} ·{' '}
                {messages.story.pageOf} {segmentIndex + 1}/{story.segments.length}
              </span>
              <div className="flex items-center gap-3">
                {sleepRemainingSec > 0 && (
                  <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{formatTimer(sleepRemainingSec)}</span>
                  </span>
                )}
                {savedNotice && (
                  <span
                    className={`font-medium ${
                      bedtimeMode
                        ? 'text-emerald-300'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {messages.story.positionSaved}
                  </span>
                )}
              </div>
            </div>

            {showCaptions && (
              <div
                className={`rounded-xl p-5 border transition-colors space-y-3 ${
                  bedtimeMode
                    ? isPlaying
                      ? 'border-amber-500/60 bg-stone-900/90'
                      : 'border-stone-700 bg-stone-900/60'
                    : isPlaying
                      ? 'border-accent bg-accent-soft'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60'
                }`}
              >
                <p
                  className={`text-2xl sm:text-3xl font-semibold leading-relaxed flex flex-wrap gap-x-2 gap-y-1 ${
                    bedtimeMode
                      ? 'text-[#F5EFE6]'
                      : 'text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {words.map((token, wIdx) => {
                    const normalized = cleanToken(token);
                    const hasGlossary = Boolean(STORY_WORD_GLOSSARY[normalized]);
                    const isReadActive = isPlaying && activeWordIdx === wIdx;
                    return (
                      <button
                        key={`${wIdx}-${token}`}
                        type="button"
                        onClick={() => handleWordTap(token)}
                        title={
                          isVi
                            ? 'Chạm vào từ để nghe phát âm chậm và xem nghĩa'
                            : 'Tap word to hear slow pronunciation & meaning'
                        }
                        className={`rounded-lg px-1 py-0.5 transition-colors cursor-pointer text-left ${
                          isReadActive
                            ? bedtimeMode
                              ? 'bg-amber-400/30 text-amber-100'
                              : 'bg-sky-200/90 dark:bg-sky-500/30 text-sky-950 dark:text-sky-100'
                            : hasGlossary
                              ? bedtimeMode
                                ? 'underline decoration-amber-400/70 decoration-2 underline-offset-4 hover:bg-stone-800'
                                : 'underline decoration-sky-400 decoration-2 underline-offset-4 hover:bg-sky-100/70 dark:hover:bg-slate-800'
                              : bedtimeMode
                                ? 'hover:bg-stone-800'
                                : 'hover:bg-slate-200/60 dark:hover:bg-slate-800'
                        }`}
                      >
                        {token}
                      </button>
                    );
                  })}
                </p>

                <p
                  className={`text-[11px] ${
                    bedtimeMode
                      ? 'text-stone-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {isVi
                    ? 'Mẹo: Chạm vào bất kỳ từ nào (đặc biệt các từ gạch chân) để xem minh họa và nghe đọc chậm.'
                    : 'Tip: Tap any word (especially underlined keywords) to pop open its meaning and hear it slowly.'}
                </p>

                {showTranslation && (
                  <p
                    className={`pt-2 border-t text-base leading-relaxed ${
                      bedtimeMode
                        ? 'border-stone-800 text-stone-300'
                        : 'border-slate-200/70 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {segmentExplanation}
                  </p>
                )}
              </div>
            )}

            {/* Interactive Word Pop Card */}
            {poppedWord && (
              <div
                className={`rounded-2xl border p-4 flex flex-wrap items-center gap-4 ${
                  bedtimeMode
                    ? 'border-amber-500/40 bg-stone-900 text-[#F5EFE6]'
                    : 'border-sky-200 bg-sky-50/70 text-slate-900'
                }`}
              >
                {poppedWord.assetRef && (
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200/40 bg-white shrink-0">
                    <AssetImage
                      assetRef={poppedWord.assetRef}
                      altOverride={poppedWord.word}
                      className="w-full h-full object-contain p-1"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles
                      className={`w-4 h-4 shrink-0 ${
                        bedtimeMode ? 'text-amber-300' : 'text-sky-600'
                      }`}
                      aria-hidden="true"
                    />
                    <p className="text-base font-bold">{poppedWord.word}</p>
                  </div>
                  <p
                    className={`text-xs ${
                      bedtimeMode ? 'text-stone-300' : 'text-slate-600'
                    }`}
                  >
                    {isVi ? poppedWord.meaningVi : poppedWord.meaningEn}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      speakText({
                        text: poppedWord.word,
                        locale: narrationLocale,
                        rate: 0.75,
                        voiceProfile: activeVoice,
                      })
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                      bedtimeMode
                        ? 'bg-amber-600 text-white hover:bg-amber-700'
                        : 'bg-sky-600 text-white hover:bg-sky-700'
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{isVi ? 'Nghe chậm' : 'Listen slowly'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPoppedWord(null)}
                    aria-label={isVi ? 'Đóng thẻ từ' : 'Close word popup'}
                    className={`p-1.5 rounded-lg cursor-pointer ${
                      bedtimeMode
                        ? 'text-stone-400 hover:bg-stone-800'
                        : 'text-slate-500 hover:bg-white'
                    }`}
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <button
                type="button"
                disabled={segmentIndex === 0}
                onClick={() => goToSegment(segmentIndex - 1)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl border text-sm font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-default ${
                  bedtimeMode
                    ? 'border-stone-700 bg-stone-900 text-stone-200 hover:bg-stone-800'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span className="whitespace-nowrap">
                  {messages.story.previousPage}
                </span>
              </button>

              <button
                type="button"
                disabled={voices.length === 0 && !segmentAudioUrl}
                onClick={handlePlayToggle}
                className={`inline-flex items-center gap-2 px-6 py-3 min-h-[48px] rounded-xl text-white font-semibold disabled:opacity-40 transition-colors cursor-pointer ${
                  bedtimeMode ? 'bg-amber-600 hover:bg-amber-700' : 'btn-accent'
                }`}
              >
                {isPlaying ? (
                  <Square className="w-4 h-4 fill-current" aria-hidden="true" />
                ) : (
                  <Volume2 className="w-5 h-5" aria-hidden="true" />
                )}
                <span className="whitespace-nowrap">
                  {isPlaying
                    ? messages.story.stopAudio
                    : messages.story.playSegment}
                </span>
              </button>

              <button
                type="button"
                disabled={isLastPage}
                onClick={() => goToSegment(segmentIndex + 1)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-default ${
                  bedtimeMode
                    ? 'bg-stone-100 text-stone-900 hover:bg-white'
                    : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white'
                }`}
              >
                <span className="whitespace-nowrap">
                  {messages.story.nextPage}
                </span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {isLastPage && (
              <div
                className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${
                  bedtimeMode
                    ? 'border-emerald-700/60 bg-emerald-950/60 text-emerald-100'
                    : 'border-emerald-200 bg-emerald-50/70'
                }`}
              >
                <div className="space-y-0.5">
                  <p
                    className={`text-sm font-bold ${
                      bedtimeMode ? 'text-emerald-100' : 'text-emerald-950'
                    }`}
                  >
                    {isVi
                      ? 'Bé đã đọc hết cuốn truyện này rồi!'
                      : 'You finished the story!'}
                  </p>
                  <p
                    className={`text-xs ${
                      bedtimeMode ? 'text-emerald-200/80' : 'text-emerald-800'
                    }`}
                  >
                    {isVi
                      ? 'Bé có thể đọc lại từ đầu hoặc ôn tập các từ vựng vừa gặp trong truyện.'
                      : 'Read again from page 1 or practice the words from this story.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToSegment(0)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl border text-xs font-semibold cursor-pointer ${
                      bedtimeMode
                        ? 'border-emerald-600 bg-stone-900 text-emerald-100'
                        : 'border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-50'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{isVi ? 'Đọc lại' : 'Read again'}</span>
                  </button>
                  {onOpenPackage && (
                    <button
                      type="button"
                      onClick={() => onOpenPackage(story.learningPackageId)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 cursor-pointer"
                    >
                      <PlayCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {isVi ? 'Ôn từ vựng bài học' : 'Practice lesson words'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Zone: Narration & Bedtime Controls */}
        <aside
          className={`lg:col-span-4 rounded-2xl border p-6 space-y-5 ${
            bedtimeMode
              ? 'border-stone-700 bg-[#26221F] text-[#F5EFE6]'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
          }`}
        >
          <div className="space-y-1">
            <h2
              className={`text-lg font-bold ${
                bedtimeMode
                  ? 'text-[#F5EFE6]'
                  : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {messages.story.heading}
            </h2>
            <p
              className={`text-sm ${
                bedtimeMode
                  ? 'text-stone-300'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {story.summaries[explanationLocale] ??
                story.summaries.vi ??
                Object.values(story.summaries)[0]}
            </p>
          </div>

          <div
            className={`space-y-4 pt-2 border-t ${
              bedtimeMode
                ? 'border-stone-700'
                : 'border-slate-100 dark:border-slate-800'
            }`}
          >
            <label className="block space-y-1.5">
              <span
                className={`text-xs font-semibold ${
                  bedtimeMode
                    ? 'text-stone-300'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {messages.story.narrationLanguage}
              </span>
              <select
                value={narrationLocale}
                onChange={(e) => {
                  const nextLocale = e.target.value;
                  clearAutoTimer();
                  clearHighlightTimer();
                  stopSpeaking();
                  setIsPlaying(false);
                  setNarrationLocale(nextLocale);
                  void persistPosition(segmentIndex, nextLocale);
                }}
                className={`w-full min-h-[44px] rounded-xl border px-3 text-sm focus:outline-none focus:border-sky-500 ${
                  bedtimeMode
                    ? 'border-stone-700 bg-stone-900 text-[#F5EFE6]'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100'
                }`}
              >
                {story.availableLocales.map((loc) => (
                  <option key={loc} value={loc}>
                    {getLocaleLabel(loc)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span
                className={`text-xs font-semibold ${
                  bedtimeMode
                    ? 'text-stone-300'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {messages.story.voiceSelect}
              </span>
              {voices.length > 0 ? (
                <select
                  value={selectedVoiceId}
                  onChange={(e) => setSelectedVoiceId(e.target.value)}
                  className={`w-full min-h-[44px] rounded-xl border px-3 text-sm focus:outline-none focus:border-sky-500 ${
                    bedtimeMode
                      ? 'border-stone-700 bg-stone-900 text-[#F5EFE6]'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {voices.map((voice) => (
                    <option key={voice.voiceId} value={voice.voiceId}>
                      {voice.displayName} · {voice.voiceStyleTags.join(', ')}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {messages.story.noVoiceAvailable}
                </p>
              )}
            </label>

            <div className="space-y-1.5">
              <div
                className={`flex items-center justify-between text-xs font-semibold tabular-nums ${
                  bedtimeMode
                    ? 'text-stone-300'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>{messages.story.speedLabel}</span>
                <span>{effectiveSpeed.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.75}
                max={1.15}
                step={0.05}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
            </div>

            {bedtimeMode && (
              <div className="rounded-xl border border-stone-700 bg-stone-900/70 p-3 space-y-2">
                <span className="text-xs font-semibold text-amber-200 inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {isVi ? 'Hẹn giờ tự động tắt kể chuyện' : 'Bedtime auto-stop timer'}
                  </span>
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {([0, 5, 10] as const).map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setSleepTimerMinutes(mins)}
                      className={`py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        sleepTimerMinutes === mins
                          ? 'bg-amber-600 text-white'
                          : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                      }`}
                    >
                      {mins === 0
                        ? isVi
                          ? 'Hết truyện'
                          : 'End of book'
                        : `${mins} ${isVi ? 'phút' : 'min'}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div
              className={`space-y-2.5 pt-2 border-t ${
                bedtimeMode
                  ? 'border-stone-700'
                  : 'border-slate-100 dark:border-slate-800'
              }`}
            >
              <label
                className={`flex items-center justify-between text-sm cursor-pointer ${
                  bedtimeMode
                    ? 'text-stone-200'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>
                  {isVi
                    ? 'Tự động lật trang khi đọc xong'
                    : 'Auto-advance pages while reading'}
                </span>
                <input
                  type="checkbox"
                  checked={autoAdvance}
                  onChange={(e) => {
                    setAutoAdvance(e.target.checked);
                    if (!e.target.checked) clearAutoTimer();
                  }}
                  className="w-4 h-4 accent-sky-600"
                />
              </label>
              <label
                className={`flex items-center justify-between text-sm cursor-pointer ${
                  bedtimeMode
                    ? 'text-stone-200'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>{messages.story.captionsToggle}</span>
                <input
                  type="checkbox"
                  checked={showCaptions}
                  onChange={(e) => setShowCaptions(e.target.checked)}
                  className="w-4 h-4 accent-sky-600"
                />
              </label>
              <label
                className={`flex items-center justify-between text-sm cursor-pointer ${
                  bedtimeMode
                    ? 'text-stone-200'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>{messages.story.translationToggle}</span>
                <input
                  type="checkbox"
                  checked={showTranslation}
                  onChange={(e) => setShowTranslation(e.target.checked)}
                  className="w-4 h-4 accent-sky-600"
                />
              </label>
            </div>
          </div>
        </aside>
      </div>
      )}
        </>
      )}
    </div>
  );
}

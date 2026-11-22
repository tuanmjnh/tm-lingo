'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Cloud,
  Compass,
  Download,
  Headphones,
  Infinity as InfinityIcon,
  Loader2,
  Moon,
  PlayCircle,
  Repeat,
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
import {
  prefetchSpeech,
  speakText,
  stopSpeaking,
} from '../../audio/speechPlayer';
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
import {
  getCachedStoryIds,
  getStoryOfflineStatus,
  getStoryResourceKey,
  precacheStorybookAssets,
  subscribeOfflineCacheStatus,
  verifyStoryOfflineReady,
  type OfflineCacheRecord,
} from '../../lib/swPrecache';
import { AssetImage } from '../../components/AssetImage';
import { VoiceAccentControls } from '../../components/VoiceAccentControls';
import {
  getDefaultAccentForLocale,
  loadVoiceSelection,
  pickDefaultVoiceForLocale,
  saveVoiceSelection,
  VOICE_PREF_CHANGED_EVENT,
} from '../../lib/voicePreferences';
import { AudiobookPlayer } from './AudiobookPlayer';
import { StorySourceDiscovery } from './StorySourceDiscovery';

interface StoryReaderProps {
  learner: LearnerProfile;
  ageGroups?: AgeGroupConfig[];
  languages: LocaleConfig[];
  messages: UiMessages;
  sectionMode?: 'stories' | 'audiobooks';
  storyUsedMinutes?: number;
  storyLimitMinutes?: number;
  onSwitchSection?: (tab: 'stories' | 'audiobooks') => void;
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

function isLongFormStory(item: StoryBook): boolean {
  if (item.storyFormat === 'audiobook' || item.storyFormat === 'long_story') {
    return true;
  }
  if (item.segments.length >= 6) return true;
  return item.segments.some(
    (seg) => Boolean(seg.audioUrlByLocale && Object.keys(seg.audioUrlByLocale).length > 0)
  );
}

export function StoryReader({
  learner,
  ageGroups = [],
  languages,
  messages,
  sectionMode = 'stories',
  storyUsedMinutes = 0,
  storyLimitMinutes = 15,
  onSwitchSection,
  onOpenPackage,
}: StoryReaderProps) {
  const isVi = learner.preferences.interfaceLocale === 'vi';
  const isAudiobookSection = sectionMode === 'audiobooks';
  const [stories, setStories] = useState<StoryBook[]>([]);
  const [viewTab, setViewTab] = useState<'library' | 'discover'>('library');
  const [readerStyle, setReaderStyle] = useState<'audiobook' | 'picture'>(
    isAudiobookSection ? 'audiobook' : 'picture'
  );
  const [ageFilter, setAgeFilter] = useState<string>('all');
  const [librarySearch, setLibrarySearch] = useState<string>('');
  const [activeStoryId, setActiveStoryId] = useState('');
  const [story, setStory] = useState<StoryBook | null>(null);

  // Sync reader style whenever switching between Truyện kể and Sách nói
  useEffect(() => {
    setReaderStyle(isAudiobookSection ? 'audiobook' : 'picture');
    setViewTab('library');
  }, [isAudiobookSection]);
  const [narrationLocale, setNarrationLocale] = useState(
    learner.preferences.narrationLocale
  );
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [selectedAccent, setSelectedAccent] = useState<string>(() =>
    getDefaultAccentForLocale(learner.preferences.narrationLocale)
  );
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [speed, setSpeed] = useState(learner.preferences.audioSpeed);
  const [showCaptions, setShowCaptions] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  // Feature upgrades: Read-along highlight, Interactive Word Pop, Bedtime Mode + Sleep Timer
  const [activeWordIdx, setActiveWordIdx] = useState<number>(-1);
  const [poppedWord, setPoppedWord] = useState<WordPopEntry | null>(null);
  const [bedtimeMode, setBedtimeMode] = useState(false);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<0 | 5 | 10 | 15>(0);
  const [sleepRemainingSec, setSleepRemainingSec] = useState<number>(0);
  const [bedtimeLoop, setBedtimeLoop] = useState(true);
  const [sleepFinishedNotice, setSleepFinishedNotice] = useState(false);
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<{
    nextIndex: number;
    isLoop: boolean;
  } | null>(null);
  const [storyRewardedId, setStoryRewardedId] = useState<string | null>(null);
  const [storyOfflineRecord, setStoryOfflineRecord] =
    useState<OfflineCacheRecord>({
      status: 'idle',
      cachedCount: 0,
      totalCount: 0,
    });
  const [cachedStoryIds, setCachedStoryIds] = useState<string[]>([]);
  const [offlineSaving, setOfflineSaving] = useState(false);
  const [offlineAudioProgress, setOfflineAudioProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [audioSavedKey, setAudioSavedKey] = useState<string | null>(null);

  const autoAdvanceTimerRef = useRef<number | null>(null);
  const highlightIntervalRef = useRef<number | null>(null);
  const autoAdvanceRef = useRef(autoAdvance);
  autoAdvanceRef.current = autoAdvance;
  const bedtimeLoopRef = useRef(bedtimeLoop);
  bedtimeLoopRef.current = bedtimeLoop;
  const sleepRemainingRef = useRef(sleepRemainingSec);
  sleepRemainingRef.current = sleepRemainingSec;
  const bedtimeModeRef = useRef(bedtimeMode);
  bedtimeModeRef.current = bedtimeMode;

  const clearAutoTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setAutoAdvanceCountdown(null);
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
    setSleepFinishedNotice(false);
    setSleepRemainingSec(sleepTimerMinutes * 60);
    const id = window.setInterval(() => {
      setSleepRemainingSec((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          clearAutoTimer();
          clearHighlightTimer();
          stopSpeaking();
          setIsLoadingAudio(false);
          setIsPlaying(false);
          setAutoAdvance(false);
          setSleepTimerMinutes(0);
          setSleepFinishedNotice(true);
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
  }, []);

  useEffect(() => {
    if (!activeStoryId) return;
    let cancelled = false;
    clearAutoTimer();
    clearHighlightTimer();
    setSegmentIndex(0);
    setIsPlaying(false);
    setIsLoadingAudio(false);
    setPoppedWord(null);
    const storyCacheKey = `story:${activeStoryId}`;
    apiClient
      .getStory(activeStoryId, learner.id)
      .then((res) => {
        if (cancelled) return;
        setStory(res.story);
        setReaderStyle(isLongFormStory(res.story) ? 'audiobook' : 'picture');
        void cacheContent(storyCacheKey, res.story);
        void precacheStorybookAssets(
          res.story,
          res.story.availableLocales[0] || learner.preferences.narrationLocale
        );
        if (res.story.availableLocales.length > 0) {
          setNarrationLocale((prev) =>
            res.story.availableLocales.includes(prev)
              ? prev
              : res.story.availableLocales[0]
          );
        }
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
          setReaderStyle(isLongFormStory(cached) ? 'audiobook' : 'picture');
        }
      });

    return () => {
      cancelled = true;
      clearAutoTimer();
      clearHighlightTimer();
      stopSpeaking();
    };
  }, [activeStoryId, learner.id, clearAutoTimer, clearHighlightTimer]);

  const effectiveNarrationLocale =
    story &&
    story.availableLocales.length > 0 &&
    !story.availableLocales.includes(narrationLocale)
      ? story.availableLocales[0]
      : narrationLocale;

  useEffect(() => {
    let cancelled = false;
    const saved = loadVoiceSelection(learner.id, effectiveNarrationLocale);
    setSelectedAccent(
      saved?.accent || getDefaultAccentForLocale(effectiveNarrationLocale)
    );

    apiClient
      .getVoices(effectiveNarrationLocale)
      .then((res) => {
        if (cancelled) return;
        setVoices(res.voices);
        const savedMatch = saved?.voiceId
          ? res.voices.find((v) => v.voiceId === saved.voiceId)
          : null;
        const preferred =
          savedMatch ??
          pickDefaultVoiceForLocale(res.voices, effectiveNarrationLocale);
        setSelectedVoiceId(preferred?.voiceId ?? '');
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
  }, [effectiveNarrationLocale, learner.id]);

  useEffect(() => {
    const onVoicePrefChanged = () => {
      const saved = loadVoiceSelection(learner.id, effectiveNarrationLocale);
      if (!saved) return;
      if (saved.accent) setSelectedAccent(saved.accent);
      if (saved.voiceId) setSelectedVoiceId(saved.voiceId);
    };
    window.addEventListener(VOICE_PREF_CHANGED_EVENT, onVoicePrefChanged);
    return () =>
      window.removeEventListener(VOICE_PREF_CHANGED_EVENT, onVoicePrefChanged);
  }, [learner.id, effectiveNarrationLocale]);

  const handleVoiceChange = (nextVoiceId: string) => {
    setSelectedVoiceId(nextVoiceId);
    saveVoiceSelection(learner.id, effectiveNarrationLocale, {
      voiceId: nextVoiceId,
      accent: selectedAccent,
    });
  };

  const handleAccentChange = (nextAccent: string) => {
    setSelectedAccent(nextAccent);
    saveVoiceSelection(learner.id, effectiveNarrationLocale, {
      voiceId: selectedVoiceId,
      accent: nextAccent,
    });
  };

  const sectionStories = useMemo(() => {
    return stories.filter((s) =>
      isAudiobookSection ? isLongFormStory(s) : !isLongFormStory(s)
    );
  }, [stories, isAudiobookSection]);

  // Keep activeStoryId aligned with the active section (Truyện kể vs Sách nói)
  useEffect(() => {
    const pool = sectionStories.length > 0 ? sectionStories : stories;
    if (pool.length === 0) return;
    if (!pool.some((s) => s.id === activeStoryId)) {
      setActiveStoryId(pool[0].id);
    }
  }, [sectionStories, stories, activeStoryId]);

  const filteredStories = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    const basePool = sectionStories.length > 0 ? sectionStories : stories;
    return basePool.filter((s) => {
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
  }, [sectionStories, stories, ageFilter, librarySearch]);

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
    const preferredImportedLocale =
      imported.availableLocales.length > 0 &&
      !imported.availableLocales.includes(narrationLocale)
        ? imported.availableLocales[0]
        : narrationLocale;
    void precacheStorybookAssets(imported, preferredImportedLocale);
    setStory(imported);
    setReaderStyle(isLongFormStory(imported) ? 'audiobook' : 'picture');
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
    ? (segment.textByLocale[effectiveNarrationLocale] ??
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
  const isLastPage = story ? segmentIndex + 1 >= story.segments.length : false;
  const words = useMemo(
    () => (segmentText ? segmentText.split(/\s+/).filter(Boolean) : []),
    [segmentText]
  );

  // Track Service Worker Cache API offline readiness for active story
  const currentStoryId = story?.id ?? '';
  const storyRef = useRef<StoryBook | null>(story);
  storyRef.current = story;
  const storiesRef = useRef<StoryBook[]>(stories);
  storiesRef.current = stories;

  useEffect(() => {
    if (!currentStoryId) {
      setStoryOfflineRecord({ status: 'idle', cachedCount: 0, totalCount: 0 });
      return;
    }
    const resourceKey = getStoryResourceKey(
      currentStoryId,
      effectiveNarrationLocale
    );
    const sync = () => {
      setStoryOfflineRecord(getStoryOfflineStatus(resourceKey));
    };
    sync();
    const currentStory = storyRef.current;
    if (currentStory && currentStory.id === currentStoryId) {
      void verifyStoryOfflineReady(currentStory, effectiveNarrationLocale).then(
        (rec) => {
          setStoryOfflineRecord(rec);
        }
      );
    }
    return subscribeOfflineCacheStatus(sync);
  }, [currentStoryId, effectiveNarrationLocale]);

  // Refresh offline badges across the story library shelf
  const storiesCount = stories.length;
  const offlineStatusForList = storyOfflineRecord.status;
  useEffect(() => {
    if (storiesCount === 0) return;
    let cancelled = false;
    void getCachedStoryIds(storiesRef.current).then((ids) => {
      if (!cancelled) setCachedStoryIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [storiesCount, currentStoryId, offlineStatusForList]);

  const activeStoryAudioKey = currentStoryId
    ? `${currentStoryId}:${effectiveNarrationLocale}:${selectedVoiceId || 'default'}`
    : '';

  const handleSaveStoryOffline = async () => {
    if (!story || offlineSaving) return;
    setOfflineSaving(true);
    const totalPages = story.segments.length;
    setOfflineAudioProgress({ done: 0, total: totalPages });

    try {
      await cacheContent(`story:${story.id}`, story);
      await precacheStorybookAssets(story, effectiveNarrationLocale, {
        force: true,
      });

      // Prefetch TTS audio for every page into persistent Cache API so narration works offline
      let done = 0;
      for (const seg of story.segments) {
        const text =
          seg.textByLocale[effectiveNarrationLocale] ??
          seg.textByLocale.en ??
          Object.values(seg.textByLocale)[0] ??
          '';
        if (text && !seg.audioUrlByLocale?.[effectiveNarrationLocale]) {
          try {
            await prefetchSpeech({
              text,
              locale: effectiveNarrationLocale,
              accent: selectedAccent,
              voiceProfile: activeVoice,
            });
          } catch {
            // continue caching remaining pages
          }
        }
        done += 1;
        setOfflineAudioProgress({ done, total: totalPages });
      }

      const verified = await verifyStoryOfflineReady(
        story,
        effectiveNarrationLocale
      );
      setStoryOfflineRecord(verified);
      setAudioSavedKey(activeStoryAudioKey);
      const ids = await getCachedStoryIds(storiesRef.current);
      setCachedStoryIds(ids);
      playSuccessChime();
    } finally {
      setOfflineSaving(false);
      setOfflineAudioProgress(null);
    }
  };

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

  const startReadAlongTicker = (
    text: string,
    rate: number,
    durationSec?: number
  ) => {
    clearHighlightTimer();
    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return;
    const msPerWord =
      durationSec && Number.isFinite(durationSec) && durationSec > 0.3
        ? Math.max(140, Math.round((durationSec * 1000 * 0.92) / tokens.length))
        : Math.max(220, Math.round(380 / Math.max(0.6, rate)));
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
      target.textByLocale[effectiveNarrationLocale] ??
      target.textByLocale.en ??
      Object.values(target.textByLocale)[0] ??
      '';
    if (!text.trim()) return;
    const audioUrl = target.audioUrlByLocale?.[effectiveNarrationLocale];

    // Prefetch the next page in background for seamless page turns
    const nextSeg = story.segments[idx + 1];
    if (nextSeg && !nextSeg.audioUrlByLocale?.[effectiveNarrationLocale]) {
      const nextText =
        nextSeg.textByLocale[effectiveNarrationLocale] ??
        nextSeg.textByLocale.en ??
        Object.values(nextSeg.textByLocale)[0] ??
        '';
      if (nextText.trim()) {
        prefetchSpeech({
          text: nextText,
          locale: effectiveNarrationLocale,
          accent: selectedAccent,
          voiceProfile: activeVoice,
        });
      }
    }

    speakText({
      text,
      locale: effectiveNarrationLocale,
      accent: selectedAccent,
      rate: effectiveSpeed,
      audioUrl,
      voiceProfile: activeVoice,
      onLoading: () => {
        setIsLoadingAudio(true);
      },
      onStart: (meta) => {
        setIsLoadingAudio(false);
        setIsPlaying(true);
        startReadAlongTicker(text, effectiveSpeed, meta?.durationSec);
      },
      onEnd: () => {
        setIsLoadingAudio(false);
        setIsPlaying(false);
        clearHighlightTimer();
        if (!autoAdvanceRef.current) return;
        const hasNextPage = idx + 1 < story.segments.length;
        const shouldBedtimeLoop =
          !hasNextPage &&
          bedtimeModeRef.current &&
          bedtimeLoopRef.current &&
          sleepRemainingRef.current > 0 &&
          story.segments.length > 1;

        if (hasNextPage || shouldBedtimeLoop) {
          const nextIdx = hasNextPage ? idx + 1 : 0;
          clearAutoTimer();
          setAutoAdvanceCountdown({
            nextIndex: nextIdx,
            isLoop: shouldBedtimeLoop,
          });
          autoAdvanceTimerRef.current = window.setTimeout(() => {
            setAutoAdvanceCountdown(null);
            setSegmentIndex(nextIdx);
            setPoppedWord(null);
            playPageTurn();
            void persistPosition(nextIdx, effectiveNarrationLocale);
            playSegmentAt(nextIdx);
          }, 1400);
        }
      },
    });
  };

  const handlePlayToggle = () => {
    clearAutoTimer();
    setSleepFinishedNotice(false);
    if (isPlaying || isLoadingAudio) {
      stopSpeaking();
      clearHighlightTimer();
      setIsLoadingAudio(false);
      setIsPlaying(false);
      return;
    }
    playSegmentAt(segmentIndex);
  };

  const goToSegment = (nextIndex: number) => {
    clearAutoTimer();
    clearHighlightTimer();
    stopSpeaking();
    setIsLoadingAudio(false);
    setIsPlaying(false);
    setPoppedWord(null);
    setSegmentIndex(nextIndex);
    playPageTurn();
    void persistPosition(nextIndex, effectiveNarrationLocale);
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
    recordWordReplay(
      learner.id,
      `story-word:${normalized}`,
      entry.word,
      effectiveNarrationLocale
    );
    playSuccessChime();
    speakText({
      text: entry.word,
      locale: effectiveNarrationLocale,
      accent: selectedAccent,
      rate: 0.82,
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
      if (next) {
        if (speed > 0.85) setSpeed(0.8);
        setAutoAdvance(true);
        setSleepFinishedNotice(false);
      } else {
        setSleepTimerMinutes(0);
        setSleepFinishedNotice(false);
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
      {/* Section Header & Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-slate-800">
        <div className="space-y-1.5">
          <div
            className={`flex flex-wrap items-center gap-2 text-xs font-medium tabular-nums ${
              bedtimeMode
                ? 'text-stone-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <span>
              {isAudiobookSection
                ? isVi
                  ? 'Sách nói & Truyện dài nhiều chương'
                  : 'Multi-Chapter Audiobooks & Long Stories'
                : isVi
                  ? 'Truyện kể tranh tương tác'
                  : 'Interactive Picture Stories'}
            </span>
            <span aria-hidden="true">·</span>
            {isAudiobookSection ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
                <InfinityIcon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isVi ? 'Không giới hạn thời gian' : 'Unlimited listening'}</span>
              </span>
            ) : (
              <span className="font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                <span>
                  {isVi
                    ? `Hôm nay: ${storyUsedMinutes}/${storyLimitMinutes} phút`
                    : `Today: ${storyUsedMinutes}/${storyLimitMinutes} min`}
                </span>
              </span>
            )}
          </div>
          <h1
            className={`text-2xl sm:text-3xl font-bold tracking-tight ${
              bedtimeMode
                ? 'text-[#F5EFE6]'
                : 'text-slate-900 dark:text-slate-50'
            }`}
          >
            {isAudiobookSection
              ? isVi
                ? 'Thư viện Sách nói & Truyện dài'
                : 'Audiobooks & Long Stories'
              : isVi
                ? 'Thư viện Truyện kể song ngữ'
                : 'Bilingual Picture Stories'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className={`inline-flex rounded-xl border p-1 gap-1 ${
              bedtimeMode
                ? 'border-stone-700 bg-stone-900'
                : 'border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900'
            }`}
            role="tablist"
            aria-label={isVi ? 'Chế độ thư viện' : 'Library view mode'}
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewTab === 'library'}
              onClick={() => setViewTab('library')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                viewTab === 'library'
                  ? bedtimeMode
                    ? 'bg-stone-800 text-amber-200 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : bedtimeMode
                    ? 'text-stone-400 hover:text-stone-200'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {isAudiobookSection ? (
                <Headphones className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span className="tabular-nums">
                {isAudiobookSection
                  ? isVi
                    ? `Kệ sách nói (${sectionStories.length})`
                    : `Audiobooks (${sectionStories.length})`
                  : isVi
                    ? `Kệ truyện (${sectionStories.length})`
                    : `Stories (${sectionStories.length})`}
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
                setIsLoadingAudio(false);
                setIsPlaying(false);
                setViewTab('discover');
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                viewTab === 'discover'
                  ? bedtimeMode
                    ? 'bg-stone-800 text-amber-200 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-accent shadow-xs'
                  : bedtimeMode
                    ? 'text-stone-400 hover:text-stone-200'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Compass className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {isVi ? 'Khám phá nguồn mở' : 'Browse Sources'}
              </span>
            </button>
          </div>

          {onSwitchSection && (
            <button
              type="button"
              onClick={() =>
                onSwitchSection(isAudiobookSection ? 'stories' : 'audiobooks')
              }
              className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[36px] rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                bedtimeMode
                  ? 'border-stone-700 bg-stone-900 text-stone-200 hover:bg-stone-800'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {isAudiobookSection ? (
                <BookOpen className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
              ) : (
                <Headphones className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              )}
              <span>
                {isAudiobookSection
                  ? isVi
                    ? 'Sang Truyện kể tranh'
                    : 'Switch to Stories'
                  : isVi
                    ? 'Sách nói (Không giới hạn)'
                    : 'Audiobooks (Unlimited)'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleBedtimeMode}
            aria-pressed={bedtimeMode}
            className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[36px] rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
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
                  ? 'Tắt chế độ ngủ'
                  : 'Exit Bedtime'
                : isVi
                  ? 'Chế độ ngủ'
                  : 'Bedtime'}
            </span>
          </button>
        </div>
      </div>

      {viewTab === 'discover' ? (
        <StorySourceDiscovery
          interfaceLocale={learner.preferences.interfaceLocale}
          ageGroups={ageGroups}
          initialAgeBand={learner.ageBand}
          defaultFormat={isAudiobookSection ? 'audiobook' : 'picture_book'}
          bedtimeMode={bedtimeMode}
          onStoryImported={handleStoryImported}
          onOpenExistingStory={handleOpenExistingFromDiscovery}
        />
      ) : (
        <>
          {/* Visual Story Bookshelf */}
          {stories.length > 0 && (
            <section
              aria-label={
                isAudiobookSection
                  ? isVi
                    ? 'Kệ sách nói và truyện dài'
                    : 'Audiobooks bookshelf'
                  : isVi
                    ? 'Kệ truyện kể tranh'
                    : 'Picture story bookshelf'
              }
              className="space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    className={`text-sm font-bold inline-flex items-center gap-2 ${
                      bedtimeMode
                        ? 'text-[#F5EFE6]'
                        : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {isAudiobookSection ? (
                      <Headphones
                        className={`w-4 h-4 ${
                          bedtimeMode ? 'text-amber-300' : 'text-accent'
                        }`}
                        aria-hidden="true"
                      />
                    ) : (
                      <BookOpen
                        className={`w-4 h-4 ${
                          bedtimeMode ? 'text-amber-300' : 'text-accent'
                        }`}
                        aria-hidden="true"
                      />
                    )}
                    <span>
                      {isAudiobookSection
                        ? isVi
                          ? 'Danh sách Sách nói & Truyện dài'
                          : 'Audiobooks & Long Stories Shelf'
                        : isVi
                          ? 'Danh sách Truyện kể tranh'
                          : 'Picture Stories Shelf'}
                    </span>
                  </h2>
                </div>

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
                    <span>{isVi ? 'Tải thêm sách nói & truyện' : 'Browse Sources'}</span>
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
                      <div className="flex items-center gap-1.5 shrink-0">
                        {cachedStoryIds.includes(item.id) && (
                          <span
                            title={
                              isVi
                                ? 'Đã lưu sẵn để đọc ngoại tuyến'
                                : 'Cached for offline reading'
                            }
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                              bedtimeMode
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70'
                            }`}
                          >
                            <Cloud className="w-3 h-3" aria-hidden="true" />
                            <span>Offline</span>
                          </span>
                        )}
                        {selected && (
                          <Check
                            className={`w-4 h-4 shrink-0 ${
                              bedtimeMode ? 'text-amber-300' : 'text-accent'
                            }`}
                            aria-hidden="true"
                          />
                        )}
                      </div>
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
                        className={`text-[11px] font-medium tabular-nums pt-0.5 truncate flex items-center gap-1.5 ${
                          bedtimeMode
                            ? 'text-stone-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {isLongFormStory(item) ? (
                          <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-bold shrink-0">
                            <Headphones className="w-3 h-3" aria-hidden="true" />
                            <span>
                              {item.storyFormat === 'audiobook'
                                ? isVi
                                  ? 'Sách nói MP3'
                                  : 'MP3 Audiobook'
                                : isVi
                                  ? 'Truyện dài'
                                  : 'Long Story'}
                            </span>
                          </span>
                        ) : (
                          <span className="shrink-0">
                            {isVi ? 'Truyện tranh' : 'Picture'}
                          </span>
                        )}
                        <span>
                          · {item.segments.length}{' '}
                          {isLongFormStory(item)
                            ? isVi
                              ? 'chương'
                              : 'ch.'
                            : isVi
                              ? 'trang'
                              : 'pages'}
                        </span>
                        {item.sourceName ? ` · ${item.sourceName}` : ''}
                      </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {story && segment && readerStyle === 'audiobook' ? (
        <AudiobookPlayer
          story={story}
          chapterIndex={segmentIndex}
          narrationLocale={effectiveNarrationLocale}
          explanationLocale={explanationLocale}
          interfaceLocale={learner.preferences.interfaceLocale}
          languages={languages}
          voices={voices}
          selectedVoiceId={selectedVoiceId}
          selectedAccent={selectedAccent}
          bedtimeMode={bedtimeMode}
          savedNotice={savedNotice}
          offlineRecord={storyOfflineRecord}
          offlineSaving={offlineSaving}
          offlineAudioProgress={offlineAudioProgress}
          audioSavedForCurrent={audioSavedKey === activeStoryAudioKey}
          onSelectChapter={(idx) => {
            setSegmentIndex(idx);
            void persistPosition(idx, effectiveNarrationLocale);
          }}
          onChangeNarrationLocale={(nextLocale) => {
            setNarrationLocale(nextLocale);
            void persistPosition(segmentIndex, nextLocale);
          }}
          onVoiceChange={handleVoiceChange}
          onAccentChange={handleAccentChange}
          onSaveOffline={() => void handleSaveStoryOffline()}
          onSwitchToPictureMode={() => {
            stopSpeaking();
            setReaderStyle('picture');
          }}
        />
      ) : story && segment ? (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left/Primary Zone: Picture Book Stage */}
        <section
          className={`lg:col-span-8 rounded-2xl border overflow-hidden ${
            bedtimeMode
              ? 'border-stone-700 bg-[#26221F]'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
          }`}
        >
          {/* Reading Progress Track */}
          <div
            className={`h-1.5 w-full ${
              bedtimeMode
                ? 'bg-stone-800'
                : 'bg-slate-100 dark:bg-slate-800'
            }`}
            role="progressbar"
            aria-label={isVi ? 'Tiến độ đọc truyện' : 'Story reading progress'}
            aria-valuenow={segmentIndex + 1}
            aria-valuemin={1}
            aria-valuemax={story.segments.length}
          >
            <div
              className={`h-full transition-all duration-500 ${
                bedtimeMode
                  ? 'bg-gradient-to-r from-amber-500 to-amber-300'
                  : 'bg-gradient-to-r from-sky-500 to-emerald-500'
              }`}
              style={{
                width: `${Math.round(
                  ((segmentIndex + 1) / Math.max(1, story.segments.length)) *
                    100
                )}%`,
              }}
            />
          </div>

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
              <div className="flex flex-wrap items-center gap-2.5">
                {offlineSaving && offlineAudioProgress ? (
                  <span
                    role="status"
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold tabular-nums ${
                      bedtimeMode
                        ? 'border-amber-400/40 bg-stone-800 text-amber-200'
                        : 'border-sky-200 dark:border-sky-800/70 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300'
                    }`}
                  >
                    <Loader2
                      className="w-3.5 h-3.5 animate-spin"
                      aria-hidden="true"
                    />
                    <span>
                      {isVi
                        ? `Đang lưu ngoại tuyến (${offlineAudioProgress.done}/${offlineAudioProgress.total} trang)...`
                        : `Saving offline (${offlineAudioProgress.done}/${offlineAudioProgress.total} pages)...`}
                    </span>
                  </span>
                ) : storyOfflineRecord.status === 'ready' ? (
                  <div className="inline-flex items-center gap-1.5">
                    <span
                      role="status"
                      title={
                        isVi
                          ? 'Tất cả tranh minh họa và nội dung truyện đã sẵn sàng khi không có mạng'
                          : 'All story pages and illustrations are cached for offline reading'
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${
                        bedtimeMode
                          ? 'border-emerald-700/70 bg-emerald-950/70 text-emerald-300'
                          : 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      <Cloud className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <Check className="w-3 h-3 -ml-1 shrink-0" aria-hidden="true" />
                      <span>
                        {audioSavedKey === activeStoryAudioKey
                          ? isVi
                            ? 'Sẵn sàng ngoại tuyến (ảnh + giọng)'
                            : 'Ready for Offline (Full Audio)'
                          : isVi
                            ? 'Sẵn sàng ngoại tuyến'
                            : 'Ready for Offline'}
                      </span>
                    </span>
                    {audioSavedKey !== activeStoryAudioKey && (
                      <button
                        type="button"
                        onClick={() => void handleSaveStoryOffline()}
                        title={
                          isVi
                            ? 'Tải sẵn toàn bộ giọng đọc các trang để nghe khi mất mạng'
                            : 'Pre-download narration audio for all pages offline'
                        }
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                          bedtimeMode
                            ? 'border-stone-600 bg-stone-800 text-amber-200 hover:bg-stone-700'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-accent hover:text-accent'
                        }`}
                      >
                        <Download className="w-3 h-3" aria-hidden="true" />
                        <span>{isVi ? 'Lưu giọng đọc' : 'Save audio'}</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSaveStoryOffline()}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                      bedtimeMode
                        ? 'border-amber-400/40 bg-stone-800 text-amber-200 hover:bg-stone-700'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-accent hover:text-accent'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      {isVi ? 'Lưu truyện ngoại tuyến' : 'Save for Offline'}
                    </span>
                  </button>
                )}

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
                        locale: effectiveNarrationLocale,
                        accent: selectedAccent,
                        rate: 0.78,
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

            {autoAdvanceCountdown && (
              <div
                role="status"
                className={`rounded-xl border px-3.5 py-2.5 space-y-2 ${
                  bedtimeMode
                    ? 'border-amber-500/40 bg-stone-900/90 text-amber-200'
                    : 'border-sky-200 dark:border-sky-800/70 bg-sky-50/80 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200'
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-xs font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    {autoAdvanceCountdown.isLoop ? (
                      <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    <span>
                      {autoAdvanceCountdown.isLoop
                        ? isVi
                          ? 'Đang quay lại trang 1 để kể tiếp cho bé ngủ ngon...'
                          : 'Gently looping back to page 1 for bedtime...'
                        : isVi
                          ? `Đang tự động chuyển sang trang ${autoAdvanceCountdown.nextIndex + 1}...`
                          : `Turning automatically to page ${autoAdvanceCountdown.nextIndex + 1}...`}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={clearAutoTimer}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer ${
                      bedtimeMode
                        ? 'bg-stone-800 text-amber-200 hover:bg-stone-700'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    {isVi ? 'Dừng lật' : 'Cancel'}
                  </button>
                </div>
                <div
                  className={`h-1.5 w-full rounded-full overflow-hidden ${
                    bedtimeMode
                      ? 'bg-stone-800'
                      : 'bg-sky-200/70 dark:bg-slate-800'
                  }`}
                >
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.35, ease: 'linear' }}
                    className={`h-full rounded-full ${
                      bedtimeMode ? 'bg-amber-400' : 'bg-sky-500'
                    }`}
                  />
                </div>
              </div>
            )}

            {sleepFinishedNotice && (
              <div
                role="status"
                className="rounded-xl border border-amber-400/40 bg-stone-900/90 text-amber-100 px-4 py-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Moon
                    className="w-4 h-4 text-amber-300 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {isVi
                      ? 'Chúc bé ngủ ngon! Đã tự động dừng kể chuyện theo đồng hồ hẹn giờ.'
                      : 'Sweet dreams! Narration paused automatically as scheduled.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSleepFinishedNotice(false)}
                  aria-label={isVi ? 'Đóng thông báo' : 'Dismiss notice'}
                  className="p-1 rounded-lg text-stone-400 hover:text-amber-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
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
                disabled={!segmentText.trim()}
                onClick={handlePlayToggle}
                className={`inline-flex items-center gap-2 px-6 py-3 min-h-[48px] rounded-xl text-white font-semibold disabled:opacity-40 transition-colors cursor-pointer ${
                  bedtimeMode ? 'bg-amber-600 hover:bg-amber-700' : 'btn-accent'
                }`}
              >
                {isLoadingAudio ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : isPlaying ? (
                  <Square className="w-4 h-4 fill-current" aria-hidden="true" />
                ) : (
                  <Volume2 className="w-5 h-5" aria-hidden="true" />
                )}
                <span className="whitespace-nowrap">
                  {isLoadingAudio
                    ? isVi
                      ? 'Đang chuẩn bị giọng đọc...'
                      : 'Preparing voice...'
                    : isPlaying
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
                  {onOpenPackage && story.learningPackageId && (
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
            <div className="flex items-start justify-between gap-2">
              <h2
                className={`text-lg font-bold ${
                  bedtimeMode
                    ? 'text-[#F5EFE6]'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {messages.story.heading}
              </h2>
              <button
                type="button"
                onClick={() => {
                  clearAutoTimer();
                  clearHighlightTimer();
                  stopSpeaking();
                  setIsPlaying(false);
                  setReaderStyle('audiobook');
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold shrink-0 cursor-pointer transition-colors ${
                  bedtimeMode
                    ? 'border-amber-400/50 bg-stone-800 text-amber-200 hover:bg-stone-700'
                    : 'border-accent bg-accent-soft hover:opacity-90'
                }`}
              >
                <Headphones className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isVi ? 'Chế độ Sách nói' : 'Audiobook Mode'}</span>
              </button>
            </div>
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
                value={effectiveNarrationLocale}
                onChange={(e) => {
                  const nextLocale = e.target.value;
                  clearAutoTimer();
                  clearHighlightTimer();
                  stopSpeaking();
                  setIsLoadingAudio(false);
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

            <VoiceAccentControls
              locale={effectiveNarrationLocale}
              interfaceLocale={learner.preferences.interfaceLocale}
              voices={voices}
              selectedVoiceId={selectedVoiceId}
              selectedAccent={selectedAccent}
              onVoiceChange={handleVoiceChange}
              onAccentChange={handleAccentChange}
              rate={effectiveSpeed}
              bedtimeMode={bedtimeMode}
              voiceLabel={messages.story.voiceSelect}
              emptyNotice={messages.story.noVoiceAvailable}
            />

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
              <div className="rounded-xl border border-stone-700 bg-stone-900/70 p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-amber-200 inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      {isVi
                        ? 'Hẹn giờ tự động tắt kể chuyện'
                        : 'Bedtime sleep timer'}
                    </span>
                  </span>
                  {sleepRemainingSec > 0 && (
                    <span className="text-xs font-extrabold text-amber-300 tabular-nums">
                      {formatTimer(sleepRemainingSec)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {([0, 5, 10, 15] as const).map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        setSleepTimerMinutes(mins);
                        if (mins > 0) {
                          setAutoAdvance(true);
                          setSleepFinishedNotice(false);
                        }
                      }}
                      className={`py-1.5 px-1 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                        sleepTimerMinutes === mins
                          ? 'bg-amber-600 text-white'
                          : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                      }`}
                    >
                      {mins === 0
                        ? isVi
                          ? 'Tắt'
                          : 'Off'
                        : `${mins}${isVi ? 'p' : 'm'}`}
                    </button>
                  ))}
                </div>

                {sleepTimerMinutes > 0 && sleepRemainingSec > 0 && (
                  <div className="space-y-2">
                    <div className="h-1.5 w-full rounded-full bg-stone-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-1000"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (sleepRemainingSec / (sleepTimerMinutes * 60)) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                    <label className="flex items-center justify-between gap-2 text-xs text-stone-300 cursor-pointer">
                      <span className="inline-flex items-center gap-1.5">
                        <Repeat className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                        <span>
                          {isVi
                            ? 'Lặp lại nhẹ nhàng đến khi hết giờ'
                            : 'Gently loop story until timer ends'}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={bedtimeLoop}
                        onChange={(e) => setBedtimeLoop(e.target.checked)}
                        className="w-4 h-4 accent-amber-500"
                      />
                    </label>
                  </div>
                )}
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
      ) : null}
        </>
      )}
    </div>
  );
}

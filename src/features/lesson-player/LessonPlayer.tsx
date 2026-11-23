'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Cloud,
  Eye,
  EyeOff,
  Gamepad2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  ActivityAnswerResponse,
  AgeGroupConfig,
  ExperienceMode,
  LearnerProfile,
  LearningPackageSummary,
  ResolvedLessonPayload,
  VoiceProfile,
} from '../../../packages/contracts/types';
import type { UiMessages } from '../../i18n/messages';
import { apiClient } from '../../shared/apiClient';
import { saveFirestoreProgress } from '../../shared/firestoreService';
import { speakText, stopSpeaking } from '../../audio/speechPlayer';
import { VoiceAccentControls } from '../../components/VoiceAccentControls';
import {
  getDefaultAccentForLocale,
  loadVoiceSelection,
  pickDefaultVoiceForLocale,
  saveVoiceSelection,
  VOICE_PREF_CHANGED_EVENT,
} from '../../lib/voicePreferences';
import {
  isSoundEffectsMuted,
  playCelebrationFanfare,
  playGentleTryAgain,
  playSuccessChime,
  setSoundEffectsMuted,
} from '../../audio/soundEffects';
import {
  recordLearnerActivity,
  recordWordReplay,
  type StickerDefinition,
} from '../../lib/learnerRewards';
import {
  cacheContent,
  enqueueOfflineMutation,
  getCachedContent,
} from '../../lib/offlineQueue';
import {
  getLessonOfflineStatus,
  getLessonResourceKey,
  precacheActiveLessonAssets,
  subscribeOfflineCacheStatus,
  verifyLessonOfflineReady,
  type OfflineCacheRecord,
} from '../../lib/swPrecache';
import { RENDERER_REGISTRY } from '../../experiences/renderers/ActivityRenderers';
import {
  MemoryMatchActivity,
  type MemoryPairItem,
} from '../../experiences/renderers/MemoryMatchActivity';
import {
  MascotCompanion,
  type MascotMood,
} from '../../components/MascotCompanion';
import { PronunciationPracticeBar } from '../../components/PronunciationPracticeBar';

interface LessonPlayerProps {
  learner: LearnerProfile;
  activeAgeGroup?: AgeGroupConfig;
  packages: LearningPackageSummary[];
  activePackageId: string;
  onSelectPackage: (packageId: string) => void;
  mode: ExperienceMode;
  messages: UiMessages;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
  onOpenStickerBook?: () => void;
  onModeChange: (mode: ExperienceMode) => void;
  onOpenStory: () => void;
  onProgressUpdated: () => void;
  accountUid?: string | null;
}

const PLAYABLE_MODES: ExperienceMode[] = [
  'guided',
  'flashcards',
  'listening',
  'game',
  'explore',
];

export function LessonPlayer({
  learner,
  activeAgeGroup,
  packages,
  activePackageId,
  onSelectPackage,
  mode,
  messages,
  focusMode = false,
  onToggleFocusMode,
  onOpenStickerBook,
  onModeChange,
  onOpenStory,
  onProgressUpdated,
  accountUid = null,
}: LessonPlayerProps) {
  const isVi = learner.preferences.interfaceLocale === 'vi';
  const [lesson, setLesson] = useState<ResolvedLessonPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<ActivityAnswerResponse | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showExplanation, setShowExplanation] = useState(true);
  const [checkpointSavedAt, setCheckpointSavedAt] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  // Feature upgrades state: Memory Match, Sound Effects mute, Sticker unlock, Hold-to-exit Focus Mode
  const [miniGameOpen, setMiniGameOpen] = useState(false);
  const [sfxMuted, setSfxMuted] = useState(false);
  const [unlockedSticker, setUnlockedSticker] = useState<StickerDefinition | null>(
    null
  );
  const [exitHoldProgress, setExitHoldProgress] = useState(0);
  const exitHoldRef = useRef<number | null>(null);

  // Voice & regional accent selector state for LessonPlayer
  const activeLearningLocale =
    lesson?.learningLocale || learner.preferences.learningLocale || 'en';
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [selectedAccent, setSelectedAccent] = useState<string>(() =>
    getDefaultAccentForLocale(learner.preferences.learningLocale || 'en')
  );
  const [offlineCacheRecord, setOfflineCacheRecord] =
    useState<OfflineCacheRecord>({
      status: 'idle',
      cachedCount: 0,
      totalCount: 0,
    });

  useEffect(() => {
    setSfxMuted(isSoundEffectsMuted());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const saved = loadVoiceSelection(learner.id, activeLearningLocale);
    setSelectedAccent(
      saved?.accent || getDefaultAccentForLocale(activeLearningLocale)
    );
    apiClient
      .getVoices(activeLearningLocale)
      .then((res) => {
        if (cancelled) return;
        setVoices(res.voices);
        const savedMatch = saved?.voiceId
          ? res.voices.find((v) => v.voiceId === saved.voiceId)
          : null;
        const preferred =
          savedMatch ?? pickDefaultVoiceForLocale(res.voices, activeLearningLocale);
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
  }, [activeLearningLocale, learner.id]);

  useEffect(() => {
    const onVoicePrefChanged = () => {
      const saved = loadVoiceSelection(learner.id, activeLearningLocale);
      if (!saved) return;
      if (saved.accent) setSelectedAccent(saved.accent);
      if (saved.voiceId) setSelectedVoiceId(saved.voiceId);
    };
    window.addEventListener(VOICE_PREF_CHANGED_EVENT, onVoicePrefChanged);
    return () =>
      window.removeEventListener(VOICE_PREF_CHANGED_EVENT, onVoicePrefChanged);
  }, [learner.id, activeLearningLocale]);

  const activeVoice =
    voices.find((v) => v.voiceId === selectedVoiceId) ?? voices[0] ?? null;

  const handleVoiceChange = (nextVoiceId: string) => {
    setSelectedVoiceId(nextVoiceId);
    saveVoiceSelection(learner.id, activeLearningLocale, {
      voiceId: nextVoiceId,
      accent: selectedAccent,
    });
  };

  const handleAccentChange = (nextAccent: string) => {
    setSelectedAccent(nextAccent);
    saveVoiceSelection(learner.id, activeLearningLocale, {
      voiceId: selectedVoiceId,
      accent: nextAccent,
    });
  };

  const stopExitHold = () => {
    if (exitHoldRef.current !== null) {
      window.clearInterval(exitHoldRef.current);
      exitHoldRef.current = null;
    }
    setExitHoldProgress(0);
  };

  useEffect(() => () => stopExitHold(), []);

  const startExitHold = () => {
    stopExitHold();
    const startedAt = Date.now();
    exitHoldRef.current = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - startedAt) / 1500) * 100);
      setExitHoldProgress(pct);
      if (pct >= 100) {
        stopExitHold();
        onToggleFocusMode?.();
      }
    }, 40);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCurrentIndex(0);
    setCompletedIds([]);
    setFeedback(null);
    setFinished(false);
    setMiniGameOpen(false);
    setUnlockedSticker(null);
    stopSpeaking();

    const lessonId = activePackageId || 'lp-fruits-a1';
    const cacheKey = `lesson:${lessonId}:${mode}:${learner.preferences.learningLocale}:${learner.preferences.explanationLocale}`;

    apiClient
      .getLesson({
        lessonId,
        mode,
        learningLocale: learner.preferences.learningLocale,
        explanationLocale: learner.preferences.explanationLocale,
      })
      .then((res) => {
        if (cancelled) return;
        setLesson(res.lesson);
        setShowExplanation(res.lesson.preset.showCaptions);
        void cacheContent(cacheKey, res.lesson);
        const activePkg =
          packages.find((p) => p.id === res.lesson.lessonId) ?? null;
        void precacheActiveLessonAssets(res.lesson, activePkg);
      })
      .catch(async (err: Error) => {
        const cached = await getCachedContent<ResolvedLessonPayload>(cacheKey);
        if (cancelled) return;
        if (cached) {
          setLesson(cached);
          setShowExplanation(cached.preset.showCaptions);
          const activePkg =
            packages.find((p) => p.id === cached.lessonId) ?? null;
          void verifyLessonOfflineReady(cached, activePkg);
        } else {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      stopSpeaking();
    };
  }, [
    activePackageId,
    mode,
    learner.id,
    learner.preferences.learningLocale,
    learner.preferences.explanationLocale,
    reloadNonce,
  ]);

  const activeLessonKey = lesson ? getLessonResourceKey(lesson) : '';

  useEffect(() => {
    if (!activeLessonKey) {
      setOfflineCacheRecord({ status: 'idle', cachedCount: 0, totalCount: 0 });
      return;
    }
    const refresh = () => {
      setOfflineCacheRecord(getLessonOfflineStatus(activeLessonKey));
    };
    refresh();
    return subscribeOfflineCacheStatus(refresh);
  }, [activeLessonKey]);

  const activeActivity = lesson?.activities[currentIndex] ?? null;

  // Build dynamic vocabulary pairs for the Memory Match mini-game
  const memoryItems = useMemo<MemoryPairItem[]>(() => {
    if (!lesson) return [];
    const map = new Map<string, MemoryPairItem>();
    for (const act of lesson.activities) {
      if (act.options) {
        for (const opt of act.options) {
          const itemId = opt.conceptId || opt.id;
          if (!map.has(itemId)) {
            map.set(itemId, {
              id: itemId,
              term: opt.label,
              translation: opt.explanationLabel,
              assetRef: opt.assetRef,
              audioUrl:
                act.conceptId && act.conceptId === opt.conceptId
                  ? act.spokenAudioUrl
                  : undefined,
            });
          }
        }
      }
      if (act.pairs) {
        for (const pair of act.pairs) {
          const itemId = pair.conceptId || pair.id;
          if (!map.has(itemId)) {
            map.set(itemId, {
              id: itemId,
              term: pair.term,
              assetRef: pair.assetRef,
            });
          }
        }
      }
    }
    return Array.from(map.values()).slice(0, 6);
  }, [lesson]);

  const persistCheckpoint = async (
    nextCompletedIds: string[],
    nextIndex: number,
    isDone: boolean
  ) => {
    if (!lesson) return;
    const payload = {
      learnerId: learner.id,
      learningLocale: lesson.learningLocale,
      mode: lesson.mode,
      completedActivityIds: nextCompletedIds,
      totalActivities: lesson.activities.length,
      lastActivityIndex: nextIndex,
      completed: isDone,
    };
    try {
      if (accountUid) {
        await saveFirestoreProgress(accountUid, {
          lessonId: lesson.lessonId,
          ...payload,
        });
      } else {
        await apiClient.saveProgress(lesson.lessonId, payload);
      }
      setCheckpointSavedAt(new Date().toLocaleTimeString());
      onProgressUpdated();
    } catch {
      await enqueueOfflineMutation({
        kind: 'lesson_progress',
        lessonId: lesson.lessonId,
        payload,
      });
      setCheckpointSavedAt(isVi ? 'Đã lưu tạm offline' : 'Saved offline');
    }
  };

  const handleToggleSfx = () => {
    const next = !sfxMuted;
    setSfxMuted(next);
    setSoundEffectsMuted(next);
    if (!next) playSuccessChime();
  };

  const handleSpeak = (text: string, locale: string) => {
    if (activeActivity) {
      recordWordReplay(
        learner.id,
        activeActivity.conceptId ?? activeActivity.id,
        text,
        locale
      );
    }
    const useLessonVoice =
      locale.toLowerCase().split(/[-_]/)[0] ===
      activeLearningLocale.toLowerCase().split(/[-_]/)[0];
    speakText({
      text,
      locale,
      accent: useLessonVoice ? selectedAccent : undefined,
      rate: learner.preferences.audioSpeed,
      audioUrl: activeActivity?.spokenAudioUrl,
      voiceProfile: useLessonVoice ? activeVoice : null,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
    });
  };

  const handleSubmitChoice = async (selectedId: string) => {
    if (!lesson || !activeActivity) return;
    try {
      const result = await apiClient.submitAnswer(activeActivity.id, {
        learnerId: learner.id,
        lessonId: lesson.lessonId,
        learningLocale: lesson.learningLocale,
        explanationLocale: lesson.explanationLocale,
        selectedId,
      });
      setFeedback(result);
      if (result.correct) {
        playSuccessChime();
        const nextIds = completedIds.includes(activeActivity.id)
          ? completedIds
          : [...completedIds, activeActivity.id];
        setCompletedIds(nextIds);
        await persistCheckpoint(
          nextIds,
          currentIndex,
          nextIds.length === lesson.activities.length
        );
      } else {
        playGentleTryAgain();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check answer');
    }
  };

  const handleSubmitMatch = async (
    matchedPairs: Array<{ wordId: string; imageId: string }>
  ) => {
    if (!lesson || !activeActivity) return;
    try {
      const result = await apiClient.submitAnswer(activeActivity.id, {
        learnerId: learner.id,
        lessonId: lesson.lessonId,
        learningLocale: lesson.learningLocale,
        explanationLocale: lesson.explanationLocale,
        matchedPairs,
      });
      setFeedback(result);
      if (result.correct) {
        playSuccessChime();
        const nextIds = completedIds.includes(activeActivity.id)
          ? completedIds
          : [...completedIds, activeActivity.id];
        setCompletedIds(nextIds);
        await persistCheckpoint(
          nextIds,
          currentIndex,
          nextIds.length === lesson.activities.length
        );
      } else {
        playGentleTryAgain();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check match');
    }
  };

  const handleNext = () => {
    if (!lesson) return;
    stopSpeaking();
    setFeedback(null);
    if (currentIndex + 1 < lesson.activities.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setFinished(true);
      playCelebrationFanfare();
      const rewardResult = recordLearnerActivity(learner.id, {
        kind: 'lesson',
        sourceId: lesson.lessonId,
        wordsCount: Math.max(3, memoryItems.length),
      });
      if (rewardResult.newlyUnlocked) {
        setUnlockedSticker(rewardResult.newlyUnlocked);
      }
      void persistCheckpoint(completedIds, currentIndex, true);
    }
  };

  const handlePrev = () => {
    if (currentIndex === 0) return;
    stopSpeaking();
    setFeedback(null);
    setCurrentIndex(currentIndex - 1);
  };

  const handleRestart = () => {
    stopSpeaking();
    setCurrentIndex(0);
    setCompletedIds([]);
    setFeedback(null);
    setFinished(false);
    setUnlockedSticker(null);
  };

  const modeLabels: Record<ExperienceMode, string> = {
    guided: messages.modes.guided,
    flashcards: messages.modes.flashcards,
    listening: messages.modes.listening,
    game: messages.modes.game,
    explore: messages.modes.explore,
    story: messages.modes.story,
  };

  // Mascot mood & message derived from active state
  const showMascot = activeAgeGroup
    ? activeAgeGroup.uiProfile.gamificationStyle !== 'progress-metrics'
    : true;
  const mascotState: { mood: MascotMood; message: string } = finished
    ? {
        mood: 'celebrating',
        message: isVi
          ? `Xuất sắc quá ${learner.nickname} ơi! Con đã hoàn thành trọn vẹn bài học hôm nay.`
          : `Wonderful job, ${learner.nickname}! You completed the entire lesson.`,
      }
    : feedback?.correct
      ? {
          mood: 'happy',
          message: isVi
            ? 'Đúng rồi! Con nghe kỹ và trả lời rất chính xác.'
            : 'Spot on! Great listening and careful choice.',
        }
      : feedback && !feedback.correct
        ? {
            mood: 'encouraging',
            message: isVi
              ? 'Chưa đúng một chút thôi, con bấm loa nghe lại rồi chọn tiếp nhé!'
              : 'Almost there — tap Listen once more and try again!',
          }
        : miniGameOpen
          ? {
              mood: 'idle',
              message: isVi
                ? 'Hãy lật hai thẻ giống nhau để ghép hình và từ vựng nhé!'
                : 'Flip two cards to match each picture with its word!',
            }
          : {
              mood: 'idle',
              message: isVi
                ? `Mình cùng khám phá bước ${currentIndex + 1} nào! Con có thể bấm nghe nhiều lần.`
                : `Let us explore step ${currentIndex + 1} together! Tap Listen anytime.`,
            };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 space-y-5 animate-pulse">
          <div className="h-4 w-48 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800/70" />
          <div className="h-64 w-full max-w-sm mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
          <div className="h-8 w-40 mx-auto rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 animate-pulse">
          <div className="h-5 w-44 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800/70" />
            <div className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800/70" />
            <div className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800/70" />
            <div className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800/70" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-8 space-y-4 text-amber-900 dark:text-amber-200">
        <p className="font-semibold">{error ?? 'Lesson unavailable'}</p>
        <button
          type="button"
          onClick={() => setReloadNonce((n) => n + 1)}
          className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          <span>{isVi ? 'Thử tải lại' : 'Retry'}</span>
        </button>
      </div>
    );
  }

  const RendererComponent = activeActivity
    ? RENDERER_REGISTRY[activeActivity.type]
    : null;

  return (
    <div
      className={
        focusMode
          ? 'max-w-4xl mx-auto space-y-5'
          : 'grid grid-cols-1 lg:grid-cols-12 gap-8 items-start'
      }
    >
      {/* Left/Primary Zone: Interactive Learning Stage */}
      <section
        className={`${
          focusMode ? 'w-full' : 'lg:col-span-8'
        } rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
              {lesson.title} · {lesson.learningLocale.toUpperCase()} /{' '}
              {lesson.explanationLocale.toUpperCase()} · {messages.player.stepOf}{' '}
              {Math.min(currentIndex + 1, lesson.activities.length)}/
              {lesson.activities.length}
              {activeAgeGroup
                ? ` · ${isVi ? activeAgeGroup.shortLabels.vi : activeAgeGroup.shortLabels.en}`
                : ''}
            </p>
            {offlineCacheRecord.status === 'ready' && (
              <span
                role="status"
                title={
                  isVi
                    ? `Đã lưu đủ ${offlineCacheRecord.cachedCount} tài nguyên bài học trên máy — bé có thể học tiếp ngay cả khi mất mạng.`
                    : `All ${offlineCacheRecord.cachedCount} lesson assets are cached locally — you can keep learning without internet.`
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/90 dark:bg-emerald-950/50 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200"
              >
                <span className="relative inline-flex items-center justify-center">
                  <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <CheckCircle2
                    className="w-2.5 h-2.5 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 rounded-full -ml-1.5 mt-1.5"
                    aria-hidden="true"
                  />
                </span>
                <span className="whitespace-nowrap">
                  {isVi ? 'Sẵn sàng ngoại tuyến' : 'Ready for Offline'}
                </span>
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {memoryItems.length >= 2 && (
              <button
                type="button"
                onClick={() => {
                  stopSpeaking();
                  setMiniGameOpen((v) => !v);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                  miniGameOpen
                    ? 'border-accent bg-accent-soft'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {miniGameOpen
                    ? isVi
                      ? 'Quay lại bài học'
                      : 'Back to lesson'
                    : isVi
                      ? 'Lật thẻ ghi nhớ'
                      : 'Memory Match'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowExplanation((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              {showExplanation ? (
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span className="whitespace-nowrap">
                {showExplanation
                  ? messages.player.hideExplanation
                  : messages.player.showExplanation}
              </span>
            </button>

            <button
              type="button"
              onClick={handleToggleSfx}
              title={
                sfxMuted
                  ? isVi
                    ? 'Bật âm thanh phản hồi'
                    : 'Unmute sound effects'
                  : isVi
                    ? 'Tắt âm thanh phản hồi'
                    : 'Mute sound effects'
              }
              aria-label={sfxMuted ? 'Unmute sound effects' : 'Mute sound effects'}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              {sfxMuted ? (
                <VolumeX className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Volume2 className="w-4 h-4 text-accent" aria-hidden="true" />
              )}
            </button>

            {onToggleFocusMode && !focusMode && (
              <button
                type="button"
                onClick={onToggleFocusMode}
                title={isVi ? 'Chế độ tập trung' : 'Focus Mode'}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">
                  {isVi ? 'Tập trung' : 'Focus'}
                </span>
              </button>
            )}

            {onToggleFocusMode && focusMode && (
              <button
                type="button"
                onPointerDown={startExitHold}
                onPointerUp={stopExitHold}
                onPointerLeave={stopExitHold}
                onPointerCancel={stopExitHold}
                className="relative overflow-hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent bg-accent-soft text-xs font-semibold cursor-pointer select-none"
              >
                <span
                  className="absolute inset-y-0 left-0 bg-sky-200/50 dark:bg-sky-400/30 transition-all duration-75"
                  style={{ width: `${exitHoldProgress}%` }}
                />
                <Minimize2 className="relative w-3.5 h-3.5" aria-hidden="true" />
                <span className="relative">
                  {isVi ? 'Giữ 1.5s để thoát' : 'Hold 1.5s to exit'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Stepping-Stone Visual Progress */}
        {!miniGameOpen && (
          <div
            className="flex items-center gap-2 overflow-x-auto pb-1"
            role="progressbar"
            aria-valuenow={completedIds.length}
            aria-valuemin={0}
            aria-valuemax={lesson.activities.length}
          >
            {lesson.activities.map((act, idx) => {
              const isDone = finished || completedIds.includes(act.id);
              const isCurrent = !finished && idx === currentIndex;
              return (
                <div key={act.id} className="flex items-center gap-2 flex-1 min-w-[36px]">
                  <button
                    type="button"
                    onClick={() => {
                      stopSpeaking();
                      setFeedback(null);
                      setFinished(false);
                      setCurrentIndex(idx);
                    }}
                    aria-label={`${messages.player.stepOf} ${idx + 1}`}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold tabular-nums shrink-0 transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-sky-600 text-white ring-4 ring-sky-100'
                        : isDone
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {isDone && !isCurrent ? (
                      <Check className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      idx + 1
                    )}
                  </button>
                  {idx < lesson.activities.length - 1 && (
                    <div
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        isDone || idx < currentIndex
                          ? 'bg-emerald-400'
                          : 'bg-slate-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Milo Mascot Companion (shown for age groups with mascot enabled) */}
        {showMascot && (
          <MascotCompanion
            mood={mascotState.mood}
            message={mascotState.message}
            learnerName={learner.nickname}
            isVi={isVi}
            compact
          />
        )}

        {miniGameOpen ? (
          <MemoryMatchActivity
            items={memoryItems}
            learningLocale={lesson.learningLocale}
            isVi={isVi}
            audioSpeed={learner.preferences.audioSpeed}
            voiceProfile={activeVoice}
            accent={selectedAccent}
            preschoolAssist={(learner.ageYears ?? 4) <= 6}
            onComplete={() => {
              const res = recordLearnerActivity(learner.id, {
                kind: 'memory',
                sourceId: lesson.lessonId,
                wordsCount: memoryItems.length,
              });
              if (res.newlyUnlocked) {
                setUnlockedSticker(res.newlyUnlocked);
              }
            }}
          />
        ) : finished ? (
          <div className="py-8 text-center space-y-5 max-w-lg mx-auto">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
            </div>
            <h3 className="text-3xl font-bold text-slate-900">
              {messages.player.lessonCompleteTitle}
            </h3>
            <p className="text-base text-slate-600 leading-relaxed">
              {messages.player.lessonCompleteBody}
            </p>

            {unlockedSticker && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 flex flex-wrap items-center justify-between gap-3 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-amber-800">
                      {isVi ? 'Nhãn dán mới vừa mở khóa!' : 'New Sticker Unlocked!'}
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      {isVi ? unlockedSticker.labelVi : unlockedSticker.labelEn}
                    </p>
                  </div>
                </div>
                {onOpenStickerBook && (
                  <button
                    type="button"
                    onClick={onOpenStickerBook}
                    className="px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 cursor-pointer"
                  >
                    {isVi ? 'Dán vào sổ Sticker' : 'Open Sticker Book'}
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleRestart}
                className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold hover:bg-slate-50 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span className="whitespace-nowrap">
                  {messages.player.restartButton}
                </span>
              </button>
              {memoryItems.length >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    setFinished(false);
                    setMiniGameOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-xl border border-sky-200 bg-sky-50 text-sky-900 font-semibold hover:bg-sky-100 cursor-pointer"
                >
                  <Gamepad2 className="w-4 h-4" aria-hidden="true" />
                  <span className="whitespace-nowrap">
                    {isVi ? 'Chơi lật thẻ ôn tập' : 'Play Memory Match'}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={onOpenStory}
                className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-xl bg-sky-600 text-white font-semibold hover:bg-sky-700 cursor-pointer"
              >
                <BookOpen className="w-4 h-4" aria-hidden="true" />
                <span className="whitespace-nowrap">
                  {messages.hero.openStoryButton}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeActivity && RendererComponent && (
              <RendererComponent
                key={activeActivity.id}
                activity={activeActivity}
                messages={messages}
                showExplanation={showExplanation}
                isSpeaking={isSpeaking}
                feedback={feedback}
                onSpeak={handleSpeak}
                onSubmitChoice={handleSubmitChoice}
                onSubmitMatch={handleSubmitMatch}
              />
            )}

            {activeActivity?.spokenText && (
              <PronunciationPracticeBar
                key={`pronounce-${activeActivity.id}`}
                targetText={activeActivity.spokenText}
                spokenLocale={
                  activeActivity.spokenLocale || activeLearningLocale
                }
                accent={selectedAccent}
                isVi={isVi}
                onPlayModel={() =>
                  handleSpeak(
                    activeActivity.spokenText,
                    activeActivity.spokenLocale || activeLearningLocale
                  )
                }
              />
            )}

            {feedback && (
              <div
                className={`rounded-xl border px-4 py-3 text-sm flex flex-col gap-1 ${
                  feedback.correct
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}
                role="status"
              >
                <span className="font-semibold">
                  {feedback.correct
                    ? messages.player.greatJob
                    : messages.player.tryAgain}
                </span>
                {feedback.revealedConcept && (
                  <span className="text-emerald-800">
                    {feedback.revealedConcept.term} —{' '}
                    {feedback.revealedConcept.example} (
                    {feedback.revealedConcept.explanation})
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={handlePrev}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-default"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span className="whitespace-nowrap">
                  {messages.player.previousButton}
                </span>
              </button>

              {checkpointSavedAt && (
                <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums hidden sm:inline">
                  {messages.player.checkpointSaved} · {checkpointSavedAt}
                </span>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-white cursor-pointer"
              >
                <span className="whitespace-nowrap">
                  {currentIndex + 1 === lesson.activities.length
                    ? messages.player.finishButton
                    : messages.player.nextButton}
                </span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </section>

      {/* Right/Secondary Zone: Hybrid Experience Deck (hidden in Focus Mode) */}
      {!focusMode && (
        <aside className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {messages.modes.heading}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {messages.modes.description}
              </p>
            </div>

            <div
              className="grid grid-cols-2 gap-2"
              role="tablist"
              aria-label="Experience modes"
            >
              {PLAYABLE_MODES.map((m, idx) => {
                const active = !miniGameOpen && mode === m;
                const isSpanFull =
                  PLAYABLE_MODES.length % 2 === 1 &&
                  idx === PLAYABLE_MODES.length - 1;
                return (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setMiniGameOpen(false);
                      onModeChange(m);
                    }}
                    className={`px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      isSpanFull ? 'col-span-2' : ''
                    } ${
                      active
                        ? 'btn-accent'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {modeLabels[m]}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-2">
              {memoryItems.length >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    stopSpeaking();
                    setMiniGameOpen((v) => !v);
                  }}
                  className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${
                    miniGameOpen
                      ? 'border-accent bg-accent-soft'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Gamepad2
                    className="w-4 h-4 text-accent"
                    aria-hidden="true"
                  />
                  <span className="whitespace-nowrap">
                    {isVi ? 'Mini-game lật thẻ ghi nhớ' : 'Memory Match Game'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenStory}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-accent" aria-hidden="true" />
                <span className="whitespace-nowrap">{messages.modes.story}</span>
              </button>

              {onOpenStickerBook && (
                <button
                  type="button"
                  onClick={onOpenStickerBook}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/40 text-sm font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-100/70 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
                >
                  <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  <span className="whitespace-nowrap">
                    {isVi ? 'Sổ sưu tập Sticker' : 'My Sticker Book'}
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {isVi
                  ? 'Giọng đọc & Vùng miền'
                  : 'Voice & Regional Accent'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isVi
                  ? 'Phụ huynh có thể đổi giọng đọc và ngữ điệu (Mỹ, Anh, Úc...) cho bài học.'
                  : 'Switch narrator voices and regional accents (US, UK, AU) for this lesson.'}
              </p>
            </div>
            <VoiceAccentControls
              locale={lesson.learningLocale}
              interfaceLocale={learner.preferences.interfaceLocale}
              voices={voices}
              selectedVoiceId={selectedVoiceId}
              selectedAccent={selectedAccent}
              onVoiceChange={handleVoiceChange}
              onAccentChange={handleAccentChange}
              rate={learner.preferences.audioSpeed}
              compact
            />
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
            {packages.length > 1 && (
              <label className="block space-y-1.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {isVi ? 'Chọn gói bài học' : 'Select learning package'}
                </span>
                <select
                  value={activePackageId}
                  onChange={(e) => onSelectPackage(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.titles[learner.preferences.interfaceLocale] ||
                        pkg.titles.en ||
                        Object.values(pkg.titles)[0] ||
                        pkg.id}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {lesson.title}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {lesson.explanationSummary}
            </p>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              <div>
                {messages.hero.learningMeta}:{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {lesson.learningLocale.toUpperCase()}
                </span>{' '}
                · {messages.hero.explanationMeta}:{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {lesson.explanationLocale.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

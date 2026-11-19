import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  RotateCcw,
} from 'lucide-react';
import type {
  ActivityAnswerResponse,
  ExperienceMode,
  LearnerProfile,
  ResolvedLessonPayload,
} from '../../../packages/contracts/types';
import type { UiMessages } from '../../i18n/messages';
import { apiClient } from '../../shared/apiClient';
import { saveFirestoreProgress } from '../../shared/firestoreService';
import { speakText, stopSpeaking } from '../../audio/speechPlayer';
import { RENDERER_REGISTRY } from '../../experiences/renderers/ActivityRenderers';

interface LessonPlayerProps {
  parentUid: string | null;
  learner: LearnerProfile;
  mode: ExperienceMode;
  messages: UiMessages;
  onModeChange: (mode: ExperienceMode) => void;
  onOpenStory: () => void;
  onProgressUpdated: () => void;
}

const PLAYABLE_MODES: ExperienceMode[] = [
  'guided',
  'flashcards',
  'listening',
  'game',
];

export function LessonPlayer({
  parentUid,
  learner,
  mode,
  messages,
  onModeChange,
  onOpenStory,
  onProgressUpdated,
}: LessonPlayerProps) {
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCurrentIndex(0);
    setCompletedIds([]);
    setFeedback(null);
    setFinished(false);
    stopSpeaking();

    apiClient
      .getLesson({
        lessonId: 'lesson-fruits-01',
        mode,
        learningLocale: learner.preferences.learningLocale,
        explanationLocale: learner.preferences.explanationLocale,
      })
      .then((res) => {
        if (cancelled) return;
        setLesson(res.lesson);
        setShowExplanation(res.lesson.preset.showCaptions);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      stopSpeaking();
    };
  }, [
    mode,
    learner.id,
    learner.preferences.learningLocale,
    learner.preferences.explanationLocale,
  ]);

  const activeActivity = lesson?.activities[currentIndex] ?? null;

  const persistCheckpoint = async (
    nextCompletedIds: string[],
    nextIndex: number,
    isDone: boolean
  ) => {
    if (!lesson) return;
    try {
      if (parentUid) {
        await saveFirestoreProgress(parentUid, {
          learnerId: learner.id,
          lessonId: lesson.lessonId,
          learningLocale: lesson.learningLocale,
          mode: lesson.mode,
          completedActivityIds: nextCompletedIds,
          totalActivities: lesson.activities.length,
          lastActivityIndex: nextIndex,
          completed: isDone,
        });
      } else {
        await apiClient.saveProgress(lesson.lessonId, {
          learnerId: learner.id,
          learningLocale: lesson.learningLocale,
          mode: lesson.mode,
          completedActivityIds: nextCompletedIds,
          totalActivities: lesson.activities.length,
          lastActivityIndex: nextIndex,
          completed: isDone,
        });
      }
      setCheckpointSavedAt(new Date().toLocaleTimeString());
      onProgressUpdated();
    } catch {
      // Non-blocking checkpoint error
    }
  };

  const handleSpeak = (text: string, locale: string) => {
    speakText({
      text,
      locale,
      rate: learner.preferences.audioSpeed,
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
        const nextIds = completedIds.includes(activeActivity.id)
          ? completedIds
          : [...completedIds, activeActivity.id];
        setCompletedIds(nextIds);
        await persistCheckpoint(
          nextIds,
          currentIndex,
          nextIds.length === lesson.activities.length
        );
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
        const nextIds = completedIds.includes(activeActivity.id)
          ? completedIds
          : [...completedIds, activeActivity.id];
        setCompletedIds(nextIds);
        await persistCheckpoint(
          nextIds,
          currentIndex,
          nextIds.length === lesson.activities.length
        );
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
  };

  const modeLabels: Record<ExperienceMode, string> = {
    guided: messages.modes.guided,
    flashcards: messages.modes.flashcards,
    listening: messages.modes.listening,
    game: messages.modes.game,
    story: messages.modes.story,
    explore: messages.modes.guided,
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
        Loading lesson...
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-amber-900">
        {error ?? 'Lesson unavailable'}
      </div>
    );
  }

  const RendererComponent = activeActivity
    ? RENDERER_REGISTRY[activeActivity.type]
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left/Primary Zone: Interactive Learning Stage */}
      <section className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <p className="text-xs font-medium text-slate-500 tabular-nums">
              {lesson.title} · {lesson.learningLocale.toUpperCase()} /{' '}
              {lesson.explanationLocale.toUpperCase()} · {messages.player.stepOf}{' '}
              {Math.min(currentIndex + 1, lesson.activities.length)}/
              {lesson.activities.length}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowExplanation((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              {showExplanation ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
              <span className="whitespace-nowrap">
                {showExplanation
                  ? messages.player.hideExplanation
                  : messages.player.showExplanation}
              </span>
            </button>
          </div>
        </div>

        {/* Gentle progress bar */}
        <div
          className="h-2 w-full rounded-full bg-slate-100 overflow-hidden"
          role="progressbar"
          aria-valuenow={completedIds.length}
          aria-valuemin={0}
          aria-valuemax={lesson.activities.length}
        >
          <div
            className="h-full bg-sky-600 transition-all duration-200"
            style={{
              width: `${Math.round(
                ((finished ? lesson.activities.length : currentIndex + 1) /
                  lesson.activities.length) *
                  100
              )}%`,
            }}
          />
        </div>

        {finished ? (
          <div className="py-10 text-center space-y-5 max-w-lg mx-auto">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
            </div>
            <h3 className="text-3xl font-bold text-slate-900">
              {messages.player.lessonCompleteTitle}
            </h3>
            <p className="text-base text-slate-600 leading-relaxed">
              {messages.player.lessonCompleteBody}
            </p>
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
                    {feedback.revealedConcept.term} — {feedback.revealedConcept.example}{' '}
                    ({feedback.revealedConcept.explanation})
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={handlePrev}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-default"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span className="whitespace-nowrap">
                  {messages.player.previousButton}
                </span>
              </button>

              {checkpointSavedAt && (
                <span className="text-xs text-slate-400 tabular-nums hidden sm:inline">
                  {messages.player.checkpointSaved} · {checkpointSavedAt}
                </span>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
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

      {/* Right/Secondary Zone: Hybrid Experience Deck */}
      <aside className="lg:col-span-4 space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-slate-900">
              {messages.modes.heading}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {messages.modes.description}
            </p>
          </div>

          <div
            className="grid grid-cols-2 gap-2"
            role="tablist"
            aria-label="Experience modes"
          >
            {PLAYABLE_MODES.map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onModeChange(m)}
                  className={`px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {modeLabels[m]}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onOpenStory}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-sky-600" aria-hidden="true" />
            <span className="whitespace-nowrap">{messages.modes.story}</span>
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
          <h3 className="text-base font-bold text-slate-900">{lesson.title}</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            {lesson.explanationSummary}
          </p>
          <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1">
            <div>
              {messages.hero.learningMeta}:{' '}
              <span className="font-semibold text-slate-700">
                {lesson.learningLocale.toUpperCase()}
              </span>{' '}
              · {messages.hero.explanationMeta}:{' '}
              <span className="font-semibold text-slate-700">
                {lesson.explanationLocale.toUpperCase()}
              </span>
            </div>
            <div>
              Preset:{' '}
              <span className="font-medium text-slate-700">
                {lesson.preset.mode} / {lesson.preset.interactionPacing}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

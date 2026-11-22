'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Brain,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  X,
} from 'lucide-react';
import { speakText, stopSpeaking } from '../audio/speechPlayer';
import {
  playCelebrationFanfare,
  playSuccessChime,
} from '../audio/soundEffects';
import {
  getMasteredWordsList,
  getTrickyWordsForReview,
  markTrickyWordMastered,
  recordTrickyWordPractice,
  restoreTrickyWordForReview,
  type TrickyWordItem,
} from '../lib/learnerRewards';
import {
  getDefaultAccentForLocale,
  loadVoiceSelection,
} from '../lib/voicePreferences';
import { PronunciationPracticeBar } from './PronunciationPracticeBar';

interface SmartWordReviewModalProps {
  open: boolean;
  learnerId: string;
  learnerName: string;
  defaultLearningLocale: string;
  audioSpeed: number;
  isVi: boolean;
  reducedMotion?: boolean;
  onClose: () => void;
  onReviewChanged?: () => void;
}

export function SmartWordReviewModal({
  open,
  learnerId,
  learnerName,
  defaultLearningLocale,
  audioSpeed,
  isVi,
  reducedMotion = false,
  onClose,
  onReviewChanged,
}: SmartWordReviewModalProps) {
  const [tab, setTab] = useState<'review' | 'mastered'>('review');
  const [queue, setQueue] = useState<TrickyWordItem[]>([]);
  const [mastered, setMastered] = useState<TrickyWordItem[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [sessionMasteredCount, setSessionMasteredCount] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const refreshDecks = (targetLearnerId: string) => {
    setQueue(getTrickyWordsForReview(targetLearnerId));
    setMastered(getMasteredWordsList(targetLearnerId));
  };

  useEffect(() => {
    if (!open || !learnerId) return;
    refreshDecks(learnerId);
    setCardIndex(0);
    setSessionMasteredCount(0);
    setTab('review');
  }, [open, learnerId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopSpeaking();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      stopSpeaking();
    };
  }, [open]);

  const activeWord = queue[cardIndex] ?? queue[0] ?? null;
  const activeWordLocale = activeWord?.locale || defaultLearningLocale || 'en';
  const savedVoicePref = learnerId
    ? loadVoiceSelection(learnerId, activeWordLocale)
    : null;
  const activeAccent =
    savedVoicePref?.accent || getDefaultAccentForLocale(activeWordLocale);

  const handlePlayWord = (word: TrickyWordItem, rateOverride?: number) => {
    const loc = word.locale || defaultLearningLocale || 'en';
    const pref = loadVoiceSelection(learnerId, loc);
    speakText({
      text: word.term,
      locale: loc,
      accent: pref?.accent || getDefaultAccentForLocale(loc),
      rate: rateOverride ?? audioSpeed,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
    });
  };

  const handleMarkMastered = (word: TrickyWordItem) => {
    stopSpeaking();
    markTrickyWordMastered(learnerId, word.key);
    const nextQueue = getTrickyWordsForReview(learnerId);
    const nextMastered = getMasteredWordsList(learnerId);
    setQueue(nextQueue);
    setMastered(nextMastered);
    setSessionMasteredCount((c) => c + 1);
    onReviewChanged?.();

    if (nextQueue.length === 0) {
      playCelebrationFanfare();
      setCardIndex(0);
    } else {
      playSuccessChime();
      setCardIndex((prev) => (prev >= nextQueue.length ? 0 : prev));
    }
  };

  const handlePracticeLater = (word: TrickyWordItem) => {
    stopSpeaking();
    recordTrickyWordPractice(learnerId, word.key);
    onReviewChanged?.();
    if (queue.length > 1) {
      setCardIndex((prev) => (prev + 1) % queue.length);
    }
  };

  const handleRestoreWord = (word: TrickyWordItem) => {
    restoreTrickyWordForReview(learnerId, word.key);
    refreshDecks(learnerId);
    onReviewChanged?.();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="smart-word-review-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.08 : 0.18 }}
          onClick={() => {
            stopSpeaking();
            onClose();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto"
        >
          <motion.div
            initial={
              reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.94, y: 14 }
            }
            animate={
              reducedMotion
                ? { opacity: 1 }
                : { opacity: 1, scale: 1, y: 0 }
            }
            exit={
              reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.95, y: 10 }
            }
            transition={{ duration: reducedMotion ? 0.08 : 0.22 }}
            onClick={(e) => e.stopPropagation()}
            className="relative my-auto w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <Brain className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="smart-word-review-title"
                    className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50 truncate"
                  >
                    {isVi ? 'Ôn tập từ khó thông minh' : 'Smart Word Review'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {isVi
                      ? `Các từ ${learnerName} hay bấm nghe lại`
                      : `Words ${learnerName} replayed during practice`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  stopSpeaking();
                  onClose();
                }}
                aria-label={isVi ? 'Đóng ôn tập từ' : 'Close word review'}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Mode Tabs */}
            <div className="px-6 pt-4 flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                <button
                  type="button"
                  onClick={() => setTab('review')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                    tab === 'review'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {isVi ? 'Cần ôn' : 'To Review'} ({queue.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTab('mastered')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                    tab === 'mastered'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {isVi ? 'Đã thuộc' : 'Mastered'} ({mastered.length})
                </button>
              </div>

              {tab === 'review' && queue.length > 0 && (
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                  {Math.min(cardIndex + 1, queue.length)} / {queue.length}
                </span>
              )}
            </div>

            {/* Body */}
            <div className="p-6">
              {tab === 'review' ? (
                activeWord ? (
                  <div className="space-y-4">
                    {/* Flashcard Stage */}
                    <div className="rounded-2xl border border-sky-200/80 dark:border-sky-800/60 bg-gradient-to-b from-sky-50/80 to-white dark:from-sky-950/40 dark:to-slate-900 p-6 text-center space-y-4">
                      <div className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>
                          {isVi
                            ? `Đã nghe lại ${activeWord.replays} lần`
                            : `Replayed ${activeWord.replays} ${activeWord.replays === 1 ? 'time' : 'times'}`}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{activeWordLocale.toUpperCase()}</span>
                      </div>

                      <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-50 leading-snug [text-wrap:balance]">
                        {activeWord.term}
                      </p>

                      <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handlePlayWord(activeWord)}
                          className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                            isSpeaking
                              ? 'bg-emerald-600 text-white'
                              : 'btn-accent'
                          }`}
                        >
                          <Volume2
                            className={`w-4 h-4 ${isSpeaking ? 'animate-pulse' : ''}`}
                            aria-hidden="true"
                          />
                          <span>
                            {isVi ? 'Nghe phát âm' : 'Listen normally'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePlayWord(activeWord, 0.7)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                          <span>{isVi ? 'Nghe chậm' : 'Slow (0.7×)'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Pronunciation Check */}
                    <PronunciationPracticeBar
                      key={`review-pronounce-${activeWord.key}`}
                      targetText={activeWord.term}
                      spokenLocale={activeWordLocale}
                      accent={activeAccent}
                      isVi={isVi}
                      onPlayModel={() => handlePlayWord(activeWord)}
                    />

                    {/* Card Decision Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handlePracticeLater(activeWord)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" aria-hidden="true" />
                        <span>
                          {queue.length > 1
                            ? isVi
                              ? 'Ôn lại sau (Từ kế)'
                              : 'Review again later'
                            : isVi
                              ? 'Giữ lại để ôn thêm'
                              : 'Keep practicing'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMarkMastered(activeWord)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                        <span>{isVi ? 'Bé đã thuộc!' : 'Mark as Mastered!'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center space-y-4">
                    <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Trophy className="w-7 h-7" aria-hidden="true" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-50">
                        {sessionMasteredCount > 0
                          ? isVi
                            ? `Xuất sắc! ${learnerName} đã chinh phục hết từ khó!`
                            : `Amazing! ${learnerName} mastered every tricky word!`
                          : isVi
                            ? 'Chưa có từ khó nào cần ôn'
                            : 'No tricky words waiting right now'}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300 max-w-sm mx-auto">
                        {sessionMasteredCount > 0
                          ? isVi
                            ? `Bé vừa đánh dấu thuộc thêm ${sessionMasteredCount} từ trong phiên ôn tập này.`
                            : `You mastered ${sessionMasteredCount} ${sessionMasteredCount === 1 ? 'word' : 'words'} in this quick review session.`
                          : isVi
                            ? 'Khi bé bấm nghe lại từ vựng trong bài học hoặc truyện kể, từ đó sẽ tự động xuất hiện ở đây để cùng ôn tập.'
                            : 'Whenever your child replays a word in lessons or stories, it will appear here automatically for quick flashcard review.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        stopSpeaking();
                        onClose();
                      }}
                      className="inline-flex items-center justify-center px-5 py-2.5 min-h-[42px] rounded-xl btn-accent text-sm font-semibold cursor-pointer"
                    >
                      {isVi ? 'Quay lại học bài' : 'Back to learning'}
                    </button>
                  </div>
                )
              ) : mastered.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {isVi
                      ? 'Chưa có từ nào được đánh dấu "Đã thuộc".'
                      : 'No mastered words yet.'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isVi
                      ? 'Hãy sang thẻ "Cần ôn" và bấm "Bé đã thuộc!" sau khi ôn cùng con nhé.'
                      : 'Switch to "To Review" and tap "Mark as Mastered!" as your child masters each word.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {mastered.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/30 px-3.5 py-2.5 flex items-center justify-between gap-3"
                    >
                      <button
                        type="button"
                        onClick={() => handlePlayWord(item)}
                        className="flex items-center gap-2 min-w-0 text-left cursor-pointer group"
                      >
                        <Volume2
                          className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                          {item.term}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRestoreWord(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shrink-0 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" aria-hidden="true" />
                        <span>{isVi ? 'Ôn lại' : 'Review again'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

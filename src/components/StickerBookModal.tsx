'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Award,
  BookOpen,
  Brain,
  Check,
  Crown,
  Flame,
  Lock,
  Rocket,
  RotateCcw,
  Sparkles,
  Star,
  Trophy,
  X,
} from 'lucide-react';
import {
  STICKER_CATALOG,
  computeLearnerAchievements,
  loadLearnerRewards,
  saveLearnerRewards,
  type AchievementBadge,
  type AchievementIconKey,
  type PlacedSticker,
} from '../lib/learnerRewards';
import { playCardFlip, playSuccessChime } from '../audio/soundEffects';
import { AssetImage } from './AssetImage';

interface StickerBookModalProps {
  learnerId: string;
  learnerName: string;
  isVi: boolean;
  onClose: () => void;
}

const BADGE_TONE_STYLES: Record<
  AchievementBadge['tone'],
  {
    unlockedCard: string;
    unlockedIcon: string;
    bar: string;
  }
> = {
  sky: {
    unlockedCard:
      'border-sky-200 dark:border-sky-800/70 bg-sky-50/70 dark:bg-sky-950/35',
    unlockedIcon:
      'bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-300',
    bar: 'bg-sky-500',
  },
  orange: {
    unlockedCard:
      'border-orange-200 dark:border-orange-800/70 bg-orange-50/70 dark:bg-orange-950/35',
    unlockedIcon:
      'bg-orange-100 dark:bg-orange-900/60 text-orange-600 dark:text-orange-300',
    bar: 'bg-orange-500',
  },
  amber: {
    unlockedCard:
      'border-amber-200 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/35',
    unlockedIcon:
      'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300',
    bar: 'bg-amber-500',
  },
  emerald: {
    unlockedCard:
      'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/35',
    unlockedIcon:
      'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300',
    bar: 'bg-emerald-500',
  },
  violet: {
    unlockedCard:
      'border-violet-200 dark:border-violet-800/70 bg-violet-50/70 dark:bg-violet-950/35',
    unlockedIcon:
      'bg-violet-100 dark:bg-violet-900/60 text-violet-600 dark:text-violet-300',
    bar: 'bg-violet-500',
  },
  rose: {
    unlockedCard:
      'border-rose-200 dark:border-rose-800/70 bg-rose-50/70 dark:bg-rose-950/35',
    unlockedIcon:
      'bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300',
    bar: 'bg-rose-500',
  },
};

function renderBadgeIcon(icon: AchievementIconKey) {
  switch (icon) {
    case 'starter':
      return <Rocket className="w-5 h-5" aria-hidden="true" />;
    case 'streak3':
      return <Flame className="w-5 h-5" aria-hidden="true" />;
    case 'streak7':
      return <Crown className="w-5 h-5" aria-hidden="true" />;
    case 'bookworm':
      return <BookOpen className="w-5 h-5" aria-hidden="true" />;
    case 'wordMaster':
      return <Brain className="w-5 h-5" aria-hidden="true" />;
    case 'vocab30':
      return <Sparkles className="w-5 h-5" aria-hidden="true" />;
    case 'collector':
      return <Award className="w-5 h-5" aria-hidden="true" />;
    case 'lessons5':
    default:
      return <Star className="w-5 h-5" aria-hidden="true" />;
  }
}

export function StickerBookModal({
  learnerId,
  learnerName,
  isVi,
  onClose,
}: StickerBookModalProps) {
  const [activeTab, setActiveTab] = useState<'stickers' | 'achievements'>(
    'stickers'
  );
  const [rewardState, setRewardState] = useState(() =>
    loadLearnerRewards(learnerId)
  );
  const [selectedStickerId, setSelectedStickerId] = useState<string>(
    () => loadLearnerRewards(learnerId).unlockedStickerIds[0] ?? 'sticker-apple'
  );

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const unlockedSet = new Set(rewardState.unlockedStickerIds);
  const achievementSummary = computeLearnerAchievements(learnerId);
  const achievementPercent = Math.round(
    (achievementSummary.unlockedCount /
      Math.max(1, achievementSummary.totalCount)) *
      100
  );

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!unlockedSet.has(selectedStickerId)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = Math.max(
      10,
      Math.min(90, ((e.clientX - rect.left) / rect.width) * 100)
    );
    const yPercent = Math.max(
      14,
      Math.min(86, ((e.clientY - rect.top) / rect.height) * 100)
    );

    const placed: PlacedSticker = {
      instanceId: `ps-${Date.now().toString(36)}`,
      stickerId: selectedStickerId,
      xPercent,
      yPercent,
    };

    const next = {
      ...rewardState,
      placedStickers: [...rewardState.placedStickers.slice(-15), placed],
    };
    setRewardState(next);
    saveLearnerRewards(learnerId, next);
    playSuccessChime();
  };

  const handleRemovePlaced = (instanceId: string) => {
    const next = {
      ...rewardState,
      placedStickers: rewardState.placedStickers.filter(
        (p) => p.instanceId !== instanceId
      ),
    };
    setRewardState(next);
    saveLearnerRewards(learnerId, next);
    playCardFlip();
  };

  const handleClearCanvas = () => {
    const next = { ...rewardState, placedStickers: [] };
    setRewardState(next);
    saveLearnerRewards(learnerId, next);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isVi ? 'Sổ sưu tập Sticker & Thành tích' : 'Sticker Book & Achievements'}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 inline-flex items-center gap-1.5 tabular-nums">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {isVi ? 'Sổ Sticker & Thành tích' : 'Sticker Book & Badges'} ·{' '}
                {unlockedSet.size}/{STICKER_CATALOG.length}{' '}
                {isVi ? 'nhãn dán' : 'stickers'} ·{' '}
                {achievementSummary.unlockedCount}/{achievementSummary.totalCount}{' '}
                {isVi ? 'huy hiệu' : 'badges'}
              </span>
            </p>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
              {isVi
                ? `Góc phần thưởng của ${learnerName}`
                : `${learnerName}'s Reward Book`}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('stickers')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === 'stickers'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                <span>{isVi ? 'Bảng Sticker' : 'Stickers'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('achievements')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                  activeTab === 'achievements'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Trophy className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
                <span>
                  {isVi ? 'Thành tích' : 'Badges'} (
                  {achievementSummary.unlockedCount}/{achievementSummary.totalCount})
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label={isVi ? 'Đóng' : 'Close'}
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'stickers' ? (
            <>
              {/* Interactive Scenic Sticker Canvas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {isVi
                      ? 'Chọn một nhãn dán đã mở khóa bên dưới rồi chạm vào khu vườn để dán nhé!'
                      : 'Pick an unlocked sticker below, then tap anywhere on the meadow to place it!'}
                  </p>
                  {rewardState.placedStickers.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearCanvas}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{isVi ? 'Dán lại từ đầu' : 'Clear board'}</span>
                    </button>
                  )}
                </div>

                <div
                  onClick={handleCanvasClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      const placed: PlacedSticker = {
                        instanceId: `ps-${Date.now().toString(36)}`,
                        stickerId: selectedStickerId,
                        xPercent:
                          25 + ((rewardState.placedStickers.length * 17) % 55),
                        yPercent:
                          30 + ((rewardState.placedStickers.length * 19) % 45),
                      };
                      const next = {
                        ...rewardState,
                        placedStickers: [
                          ...rewardState.placedStickers.slice(-15),
                          placed,
                        ],
                      };
                      setRewardState(next);
                      saveLearnerRewards(learnerId, next);
                      playSuccessChime();
                    }
                  }}
                  className="relative h-60 sm:h-72 rounded-2xl border border-sky-200 dark:border-sky-800/70 bg-gradient-to-b from-sky-100 via-sky-50 to-emerald-100 dark:from-sky-950/60 dark:via-slate-900 dark:to-emerald-950/50 overflow-hidden cursor-crosshair select-none"
                >
                  {/* Soft horizon hills */}
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-emerald-200/70 dark:bg-emerald-900/40 rounded-t-[100%]" />
                  <div className="absolute right-8 top-6 w-12 h-12 rounded-full bg-amber-200/90 dark:bg-amber-400/30" />

                  {rewardState.placedStickers.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-6 text-center">
                      <p className="text-sm font-medium text-sky-900/70 dark:text-sky-200/70">
                        {isVi
                          ? 'Chạm vào đây để dán nhãn dán đầu tiên của bé'
                          : 'Tap anywhere here to place your first sticker'}
                      </p>
                    </div>
                  )}

                  {rewardState.placedStickers.map((item) => {
                    const def = STICKER_CATALOG.find(
                      (s) => s.id === item.stickerId
                    );
                    if (!def) return null;
                    return (
                      <motion.button
                        key={item.instanceId}
                        type="button"
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                          type: 'spring',
                          stiffness: 320,
                          damping: 20,
                        }}
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                          handleRemovePlaced(item.instanceId);
                        }}
                        title={
                          isVi
                            ? 'Chạm để gỡ nhãn dán này'
                            : 'Tap to remove this sticker'
                        }
                        style={{
                          left: `${item.xPercent}%`,
                          top: `${item.yPercent}%`,
                        }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-2xl border-2 border-white dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md overflow-hidden hover:scale-105 transition-transform cursor-pointer"
                      >
                        <AssetImage
                          assetRef={def.assetRef}
                          altOverride={isVi ? def.labelVi : def.labelEn}
                          className="w-full h-full object-cover"
                        />
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Sticker Tray */}
              <div className="space-y-2.5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {isVi ? 'Bộ sưu tập theo chủ đề' : 'Themed Sticker Tray'}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {STICKER_CATALOG.map((sticker) => {
                    const isUnlocked = unlockedSet.has(sticker.id);
                    const isSelected =
                      selectedStickerId === sticker.id && isUnlocked;
                    return (
                      <button
                        key={sticker.id}
                        type="button"
                        disabled={!isUnlocked}
                        onClick={() => {
                          setSelectedStickerId(sticker.id);
                          playCardFlip();
                        }}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
                          isSelected
                            ? 'border-sky-600 bg-sky-50/70 dark:bg-sky-950/50'
                            : isUnlocked
                              ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:border-sky-300 dark:hover:border-sky-700 cursor-pointer'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
                          <AssetImage
                            assetRef={sticker.assetRef}
                            altOverride={
                              isVi ? sticker.labelVi : sticker.labelEn
                            }
                            className={`w-full h-full object-cover ${
                              isUnlocked ? '' : 'grayscale opacity-40'
                            }`}
                          />
                          {!isUnlocked && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/20">
                              <Lock className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {isVi ? sticker.labelVi : sticker.labelEn}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {isUnlocked
                              ? isVi
                                ? 'Đã mở khóa'
                                : 'Unlocked'
                              : isVi
                                ? 'Hoàn thành thêm bài để mở'
                                : 'Complete a lesson to unlock'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            /* Achievements & Milestones Tab */
            <div className="space-y-5">
              {/* Milestone Progress Banner */}
              <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 bg-gradient-to-r from-emerald-50/80 via-white to-amber-50/70 dark:from-emerald-950/35 dark:via-slate-900 dark:to-amber-950/25 p-4 sm:p-5 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <Trophy className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                        {isVi
                          ? `Hành trình thành tích của ${learnerName}`
                          : `${learnerName}'s Milestone Journey`}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                        {isVi
                          ? `Đã mở khóa ${achievementSummary.unlockedCount}/${achievementSummary.totalCount} huy hiệu (${achievementPercent}%)`
                          : `Unlocked ${achievementSummary.unlockedCount} of ${achievementSummary.totalCount} badges (${achievementPercent}%)`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tabular-nums">
                    <span className="px-2.5 py-1 rounded-lg bg-white/90 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                      {achievementSummary.totalLessons}{' '}
                      {isVi ? 'bài học' : 'lessons'}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-white/90 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                      {achievementSummary.totalStories}{' '}
                      {isVi ? 'truyện' : 'stories'}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-white/90 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-orange-700 dark:text-orange-300">
                      {achievementSummary.longestStreak}{' '}
                      {isVi ? 'ngày kỷ lục' : 'd best streak'}
                    </span>
                  </div>
                </div>

                <div
                  className="h-2.5 w-full rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={achievementSummary.unlockedCount}
                  aria-valuemin={0}
                  aria-valuemax={achievementSummary.totalCount}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-300"
                    style={{ width: `${achievementPercent}%` }}
                  />
                </div>
              </div>

              {/* Badges Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {achievementSummary.achievements.map((badge) => {
                  const tone = BADGE_TONE_STYLES[badge.tone];
                  const pct = Math.min(
                    100,
                    Math.round((badge.current / Math.max(1, badge.target)) * 100)
                  );
                  return (
                    <motion.button
                      key={badge.id}
                      type="button"
                      whileTap={badge.unlocked ? { scale: 0.98 } : undefined}
                      onClick={() => {
                        if (badge.unlocked) playSuccessChime();
                      }}
                      className={`text-left rounded-2xl border p-4 space-y-3 transition-colors ${
                        badge.unlocked
                          ? `${tone.unlockedCard} cursor-pointer`
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 cursor-default'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                              badge.unlocked
                                ? tone.unlockedIcon
                                : 'bg-slate-200/80 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {renderBadgeIcon(badge.icon)}
                          </div>
                          <div className="min-w-0">
                            <p
                              className={`text-sm font-bold truncate ${
                                badge.unlocked
                                  ? 'text-slate-900 dark:text-slate-50'
                                  : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {isVi ? badge.titleVi : badge.titleEn}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                              {isVi ? badge.descriptionVi : badge.descriptionEn}
                            </p>
                          </div>
                        </div>

                        {badge.unlocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold shrink-0">
                            <Check className="w-3 h-3" aria-hidden="true" />
                            <span>{isVi ? 'Đã đạt' : 'Earned'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-semibold tabular-nums shrink-0">
                            <Lock className="w-2.5 h-2.5" aria-hidden="true" />
                            <span>
                              {badge.current}/{badge.target}
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="h-1.5 w-full rounded-full bg-slate-200/90 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              badge.unlocked ? tone.bar : 'bg-slate-400 dark:bg-slate-600'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

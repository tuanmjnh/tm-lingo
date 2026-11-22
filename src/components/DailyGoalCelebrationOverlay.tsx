'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Award,
  Check,
  Clock,
  Flame,
  Sparkles,
  Star,
  Trophy,
  X,
} from 'lucide-react';
import type { GoalStreakDay } from '../lib/learnerRewards';

interface DailyGoalCelebrationOverlayProps {
  open: boolean;
  learnerName: string;
  dailyUsedMinutes: number;
  dailyLimitMinutes: number;
  stickerCount: number;
  streakDays?: number;
  longestStreakDays?: number;
  streakLast7Days?: GoalStreakDay[];
  nextStreakMilestone?: number;
  isVi: boolean;
  minutesUnit: string;
  reducedMotion?: boolean;
  onClose: () => void;
  onOpenStickerBook: () => void;
  onExtendFiveMinutes: () => void;
}

const CONFETTI_PARTICLES = [
  { x: '-42%', y: '-34%', color: 'text-amber-400', delay: 0.05, size: 'w-5 h-5' },
  { x: '44%', y: '-30%', color: 'text-emerald-400', delay: 0.1, size: 'w-4 h-4' },
  { x: '-36%', y: '26%', color: 'text-sky-400', delay: 0.14, size: 'w-4 h-4' },
  { x: '38%', y: '24%', color: 'text-rose-400', delay: 0.18, size: 'w-5 h-5' },
  { x: '-18%', y: '-44%', color: 'text-violet-400', delay: 0.08, size: 'w-4 h-4' },
  { x: '22%', y: '-42%', color: 'text-amber-500', delay: 0.12, size: 'w-4 h-4' },
  { x: '-48%', y: '-4%', color: 'text-emerald-500', delay: 0.2, size: 'w-4 h-4' },
  { x: '48%', y: '-2%', color: 'text-sky-500', delay: 0.16, size: 'w-4 h-4' },
];

export function DailyGoalCelebrationOverlay({
  open,
  learnerName,
  dailyUsedMinutes,
  dailyLimitMinutes,
  stickerCount,
  streakDays = 1,
  longestStreakDays = 1,
  streakLast7Days = [],
  nextStreakMilestone = 3,
  isVi,
  minutesUnit,
  reducedMotion = false,
  onClose,
  onOpenStickerBook,
  onExtendFiveMinutes,
}: DailyGoalCelebrationOverlayProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const effectiveStreak = Math.max(1, streakDays);
  const effectiveBest = Math.max(effectiveStreak, longestStreakDays);
  const daysRemaining = Math.max(1, nextStreakMilestone - effectiveStreak);

  const streakEncouragement =
    effectiveStreak === 1
      ? isVi
        ? 'Khởi đầu tuyệt vời! Hãy quay lại học vào ngày mai để nối dài chuỗi 2 ngày liên tiếp nhé.'
        : 'Awesome start! Come back tomorrow to keep your streak alive and reach Day 2.'
      : effectiveStreak >= 7
        ? isVi
          ? `Không gì cản nổi! Con đã giữ vững thói quen ${effectiveStreak} ngày liên tiếp — tiếp tục phát huy vào ngày mai nhé!`
          : `Unstoppable habit! You’ve hit your goal ${effectiveStreak} days in a row—keep the flame burning tomorrow!`
        : isVi
          ? `Con đang giữ phong độ rất tốt! Chỉ còn ${daysRemaining} ngày nữa để chạm mốc chuỗi ${nextStreakMilestone} ngày liên tiếp.`
          : `You’re on fire! Just ${daysRemaining} more ${daysRemaining === 1 ? 'day' : 'days'} to hit a ${nextStreakMilestone}-day streak!`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-goal-celebration-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.1 : 0.22 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
        >
          <motion.div
            initial={
              reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.88, y: 18 }
            }
            animate={
              reducedMotion
                ? { opacity: 1 }
                : { opacity: 1, scale: 1, y: 0 }
            }
            exit={
              reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.92, y: 12 }
            }
            transition={{
              type: 'spring',
              stiffness: 320,
              damping: 24,
            }}
            onClick={(e) => e.stopPropagation()}
            className="relative my-auto w-full max-w-md rounded-3xl border border-emerald-200/80 dark:border-emerald-800/70 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-2xl overflow-hidden text-center"
          >
            {/* Subtle warm celebratory halo */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-gradient-to-b from-amber-200/40 via-emerald-200/30 to-transparent dark:from-amber-500/15 dark:via-emerald-500/15 blur-2xl"
            />

            <button
              type="button"
              onClick={onClose}
              aria-label={isVi ? 'Đóng chúc mừng' : 'Close celebration'}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>

            {/* Animated Badge Centerpiece + Star Burst */}
            <div className="relative mx-auto w-24 h-24 flex items-center justify-center mb-3.5">
              {!reducedMotion &&
                CONFETTI_PARTICLES.map((p, idx) => (
                  <motion.div
                    key={idx}
                    aria-hidden="true"
                    initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                    animate={{
                      opacity: [0, 1, 1, 0.7],
                      scale: [0, 1.15, 0.95, 1],
                      x: p.x,
                      y: p.y,
                      rotate: idx % 2 === 0 ? 22 : -22,
                    }}
                    transition={{
                      duration: 0.9,
                      delay: p.delay,
                      ease: 'easeOut',
                    }}
                    className={`pointer-events-none absolute ${p.color}`}
                  >
                    {idx % 2 === 0 ? (
                      <Star className={`${p.size} fill-current`} />
                    ) : (
                      <Sparkles className={p.size} />
                    )}
                  </motion.div>
                ))}

              <motion.div
                initial={reducedMotion ? false : { scale: 0.6, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 280,
                  damping: 16,
                  delay: 0.05,
                }}
                className="relative w-22 h-22 rounded-full bg-gradient-to-br from-emerald-500 via-teal-500 to-amber-400 p-[3px] shadow-lg"
              >
                <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-0.5">
                  <Trophy
                    className="w-8 h-8 text-amber-500"
                    aria-hidden="true"
                  />
                  <span className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums">
                    100%
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Badge Label */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300 text-xs font-bold mb-2.5">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {isVi
                  ? 'Huy hiệu Hoàn thành Mục tiêu Ngày'
                  : 'Daily Goal Champion Badge'}
              </span>
            </div>

            <h2
              id="daily-goal-celebration-title"
              className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50"
            >
              {isVi
                ? `Xuất sắc quá, ${learnerName}!`
                : `You did it, ${learnerName}!`}
            </h2>

            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {isVi
                ? `Con đã hoàn thành trọn vẹn 100% mục tiêu ${dailyLimitMinutes} ${minutesUnit} học hôm nay.`
                : `You completed 100% of your ${dailyLimitMinutes}-${minutesUnit} daily learning goal today.`}
            </p>

            {/* Consecutive-Day Streak Spotlight Card */}
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reducedMotion ? 0 : 0.14, duration: 0.28 }}
              aria-label={
                isVi
                  ? `Chuỗi ${effectiveStreak} ngày hoàn thành mục tiêu liên tiếp`
                  : `${effectiveStreak}-day goal completion streak`
              }
              className="mt-4 rounded-2xl border border-orange-200/90 dark:border-orange-800/60 bg-gradient-to-br from-orange-50 via-amber-50/70 to-white dark:from-orange-950/45 dark:via-amber-950/25 dark:to-slate-900 p-4 text-left space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <motion.div
                    animate={
                      reducedMotion
                        ? undefined
                        : { scale: [1, 1.1, 1] }
                    }
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-xs shrink-0"
                  >
                    <Flame className="w-5 h-5 fill-current" aria-hidden="true" />
                  </motion.div>
                  <div className="min-w-0">
                    <p className="text-base font-extrabold text-orange-950 dark:text-orange-100 leading-tight tabular-nums">
                      {isVi
                        ? `Chuỗi ${effectiveStreak} ngày liên tiếp!`
                        : `${effectiveStreak}-${effectiveStreak === 1 ? 'Day' : 'Day'} Goal Streak!`}
                    </p>
                    <p className="text-[11px] font-semibold text-orange-700/90 dark:text-orange-300">
                      {isVi
                        ? `Mục tiêu tiếp theo: ${nextStreakMilestone} ngày`
                        : `Next milestone: ${nextStreakMilestone} days`}
                    </p>
                  </div>
                </div>

                {effectiveBest > 1 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-orange-200/80 dark:border-orange-800/70 text-[11px] font-bold text-orange-800 dark:text-orange-200 tabular-nums shrink-0">
                    <Trophy className="w-3 h-3 text-amber-500" aria-hidden="true" />
                    <span>
                      {isVi ? `Kỷ lục: ${effectiveBest}n` : `Best: ${effectiveBest}d`}
                    </span>
                  </span>
                )}
              </div>

              {/* 7-Day Visual Streak Strip */}
              {streakLast7Days.length > 0 && (
                <div className="grid grid-cols-7 gap-1.5 pt-0.5">
                  {streakLast7Days.map((day) => (
                    <div
                      key={day.dateKey}
                      className="flex flex-col items-center gap-1"
                    >
                      <span
                        className={`text-[10px] font-semibold ${
                          day.isToday
                            ? 'text-orange-700 dark:text-orange-300'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {isVi ? day.shortLabelVi : day.shortLabelEn}
                      </span>
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                          day.met
                            ? day.isToday
                              ? 'bg-orange-500 text-white ring-2 ring-orange-300 dark:ring-orange-700'
                              : 'bg-emerald-500 text-white'
                            : 'bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600'
                        }`}
                        title={day.dateKey}
                      >
                        {day.met ? (
                          day.isToday ? (
                            <Flame
                              className="w-3.5 h-3.5 fill-current"
                              aria-hidden="true"
                            />
                          ) : (
                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          )
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-orange-900/90 dark:text-orange-100/90 leading-relaxed">
                {streakEncouragement}
              </p>
            </motion.div>

            {/* Quick Reward Summary */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-2.5">
                <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {Math.max(dailyUsedMinutes, dailyLimitMinutes)}/{dailyLimitMinutes}
                </p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {minutesUnit}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-2.5">
                <p className="text-base font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                  {stickerCount}
                </p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {isVi ? 'Nhãn dán' : 'Stickers'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-2.5">
                <p className="text-base font-extrabold text-orange-600 dark:text-orange-400 tabular-nums">
                  {effectiveStreak}
                </p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {isVi ? 'Ngày liên tiếp' : 'Day streak'}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenStickerBook();
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl btn-accent text-sm font-semibold cursor-pointer"
              >
                <Award className="w-4 h-4" aria-hidden="true" />
                <span>{isVi ? 'Xem Sổ Sticker' : 'Open Sticker Book'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onExtendFiveMinutes();
                  onClose();
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
              >
                <Clock className="w-4 h-4 text-accent" aria-hidden="true" />
                <span>{isVi ? 'Thêm 5 phút' : '+5 more min'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              {isVi ? 'Tuyệt vời, đóng lại' : 'Awesome, close'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

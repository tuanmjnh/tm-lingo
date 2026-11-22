'use client';

import { motion } from 'motion/react';
import { Check, Sparkles } from 'lucide-react';

interface DailyGoalProgressRingProps {
  dailyUsedMinutes: number;
  dailyLimitMinutes: number;
  isVi: boolean;
  minutesUnit: string;
  onCelebrationClick?: () => void;
}

export function DailyGoalProgressRing({
  dailyUsedMinutes,
  dailyLimitMinutes,
  isVi,
  minutesUnit,
  onCelebrationClick,
}: DailyGoalProgressRingProps) {
  const safeLimit = Math.max(1, dailyLimitMinutes);
  const clampedUsed = Math.max(0, dailyUsedMinutes);
  const rawPct = (clampedUsed / safeLimit) * 100;
  const percent = Math.min(100, Math.max(0, Math.round(rawPct)));
  const isComplete = clampedUsed >= safeLimit;

  // Dynamic reward ring color: sky -> warm amber -> celebratory emerald at 100%
  const ringColor = isComplete
    ? '#10B981'
    : percent >= 50
      ? '#F59E0B'
      : '#0284C7';

  const trackColor = 'rgba(148, 163, 184, 0.24)';
  const sweepDeg = Math.min(360, Math.max(0, (percent / 100) * 360));

  const ariaLabel = isVi
    ? `Tiến độ mục tiêu học hôm nay: ${clampedUsed} trên ${safeLimit} ${minutesUnit} (${percent}%)`
    : `Daily learning goal progress: ${clampedUsed} of ${safeLimit} ${minutesUnit} (${percent}%)`;

  const interactive = isComplete && Boolean(onCelebrationClick);

  return (
    <motion.div
      role={interactive ? 'button' : 'progressbar'}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onCelebrationClick : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onCelebrationClick?.();
              }
            }
          : undefined
      }
      aria-label={ariaLabel}
      aria-valuenow={interactive ? undefined : percent}
      aria-valuemin={interactive ? undefined : 0}
      aria-valuemax={interactive ? undefined : 100}
      title={
        interactive
          ? isVi
            ? 'Chạm để xem huy hiệu hoàn thành mục tiêu!'
            : 'Tap to view your Daily Goal Champion badge!'
          : ariaLabel
      }
      initial={false}
      animate={isComplete ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={{ duration: 0.4 }}
      className={`inline-flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-xl border transition-colors ${
        isComplete
          ? `border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/80 dark:bg-emerald-950/40 ${
              interactive
                ? 'cursor-pointer hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50'
                : ''
            }`
          : 'border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/60'
      }`}
    >
      {/* Pure CSS conic-gradient circular progress ring */}
      <div
        className="relative w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-500"
        style={{
          background: `conic-gradient(${ringColor} ${sweepDeg}deg, ${trackColor} ${sweepDeg}deg 360deg)`,
        }}
      >
        <div
          className={`w-[28px] h-[28px] rounded-full flex items-center justify-center ${
            isComplete
              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
              : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100'
          }`}
        >
          {isComplete ? (
            <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
          ) : (
            <span className="text-[10px] font-bold tabular-nums leading-none">
              {percent}%
            </span>
          )}
        </div>
      </div>

      <div className="leading-tight">
        <div className="flex items-center gap-1">
          <span
            className={`text-xs font-bold tabular-nums ${
              isComplete
                ? 'text-emerald-800 dark:text-emerald-200'
                : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {clampedUsed}/{safeLimit} {minutesUnit}
          </span>
          {isComplete && (
            <Sparkles
              className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0"
              aria-hidden="true"
            />
          )}
        </div>
        <p
          className={`text-[10px] font-semibold ${
            isComplete
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {isComplete
            ? isVi
              ? 'Hoàn thành mục tiêu!'
              : 'Daily goal reached!'
            : isVi
              ? 'Mục tiêu hôm nay'
              : 'Daily goal'}
        </p>
      </div>
    </motion.div>
  );
}

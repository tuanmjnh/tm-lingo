'use client';

import { motion } from 'motion/react';
import { Award, Heart, Smile, Sparkles } from 'lucide-react';

export type MascotMood = 'idle' | 'happy' | 'encouraging' | 'celebrating';

interface MascotCompanionProps {
  mood: MascotMood;
  message: string;
  learnerName: string;
  isVi: boolean;
  compact?: boolean;
}

const MOOD_STYLES: Record<
  MascotMood,
  { ring: string; surface: string; iconColor: string; labelVi: string; labelEn: string }
> = {
  idle: {
    ring: 'border-sky-200 bg-sky-50/70',
    surface: 'bg-sky-100 text-sky-700',
    iconColor: 'text-sky-600',
    labelVi: 'Bạn đồng hành Milo',
    labelEn: 'Milo Companion',
  },
  happy: {
    ring: 'border-emerald-200 bg-emerald-50/70',
    surface: 'bg-emerald-100 text-emerald-700',
    iconColor: 'text-emerald-600',
    labelVi: 'Tuyệt vời lắm!',
    labelEn: 'Well done!',
  },
  encouraging: {
    ring: 'border-amber-200 bg-amber-50/70',
    surface: 'bg-amber-100 text-amber-700',
    iconColor: 'text-amber-600',
    labelVi: 'Thử lại nhẹ nhàng nhé',
    labelEn: 'Let us try again',
  },
  celebrating: {
    ring: 'border-emerald-300 bg-emerald-50',
    surface: 'bg-emerald-600 text-white',
    iconColor: 'text-white',
    labelVi: 'Hoàn thành xuất sắc!',
    labelEn: 'Amazing finish!',
  },
};

export function MascotCompanion({
  mood,
  message,
  learnerName,
  isVi,
  compact = false,
}: MascotCompanionProps) {
  const style = MOOD_STYLES[mood];

  return (
    <motion.div
      key={`${mood}-${message}`}
      initial={{ opacity: 0.7, y: 4 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: mood === 'happy' || mood === 'celebrating' ? [1, 1.02, 1] : 1,
      }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-2xl border ${style.ring} ${
        compact ? 'px-3.5 py-2.5' : 'p-4'
      } flex items-center gap-3.5`}
      aria-live="polite"
    >
      <motion.div
        animate={
          mood === 'celebrating'
            ? { rotate: [0, -8, 8, -4, 0] }
            : mood === 'happy'
              ? { y: [0, -4, 0] }
              : { y: 0 }
        }
        transition={{ duration: 0.45 }}
        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${style.surface}`}
        aria-hidden="true"
      >
        {mood === 'celebrating' ? (
          <Award className="w-6 h-6" />
        ) : mood === 'happy' ? (
          <Sparkles className="w-5 h-5" />
        ) : mood === 'encouraging' ? (
          <Heart className="w-5 h-5" />
        ) : (
          <Smile className="w-5 h-5" />
        )}
      </motion.div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-600">
          {isVi ? style.labelVi : style.labelEn} · {learnerName}
        </p>
        <p className="text-sm font-medium text-slate-900 leading-snug mt-0.5">
          {message}
        </p>
      </div>
    </motion.div>
  );
}

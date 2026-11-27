'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BRAND_ICON_SRC } from './BrandLogo';

interface AppLoadingScreenProps {
  variant?: 'splash' | 'page' | 'inline';
  phase?: 'bundle' | 'workspace';
  label?: string;
  subtitle?: string;
  locale?: string;
  compact?: boolean;
}

const FLOATING_GLYPHS = [
  { char: 'A', x: -34, delay: 0, duration: 2.6, color: 'text-sky-500 dark:text-sky-400' },
  { char: 'あ', x: 28, delay: 0.45, duration: 2.8, color: 'text-indigo-500 dark:text-indigo-400' },
  { char: '文', x: -12, delay: 0.9, duration: 2.5, color: 'text-amber-500 dark:text-amber-400' },
  { char: '★', x: 16, delay: 1.35, duration: 2.7, color: 'text-emerald-500 dark:text-emerald-400' },
  { char: '♪', x: -24, delay: 1.8, duration: 2.9, color: 'text-rose-500 dark:text-rose-400' },
];

const SPLASH_STEPS_VI = [
  'Đang mở trang sách TM-Lingo...',
  'Đang chuẩn bị từ vựng & truyện kể...',
  'Sẵn sàng cùng bé khám phá ngôn ngữ...',
];

const SPLASH_STEPS_EN = [
  'Opening your TM-Lingo storybook...',
  'Preparing vocabulary & interactive tales...',
  'Ready to explore new languages...',
];

function StorybookAnimation({ size = 'lg' }: { size?: 'md' | 'lg' }) {
  const isLarge = size === 'lg';

  return (
    <div
      aria-hidden="true"
      className={`relative flex items-center justify-center ${
        isLarge ? 'w-44 h-32' : 'w-36 h-26'
      }`}
    >
      {/* Warm ambient glow behind the book */}
      <motion.div
        animate={{ scale: [0.96, 1.06, 0.96], opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-x-6 bottom-2 top-6 rounded-full bg-sky-400/25 dark:bg-sky-500/20 blur-2xl"
      />

      {/* Floating Multilingual Letters rising from the pages */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {FLOATING_GLYPHS.map((glyph, idx) => (
          <motion.span
            key={idx}
            initial={{ opacity: 0, y: 6, x: glyph.x, scale: 0.65 }}
            animate={{
              opacity: [0, 0.95, 0.85, 0],
              y: [8, -18, -38, -54],
              x: [glyph.x, glyph.x + (idx % 2 === 0 ? 6 : -6), glyph.x],
              rotate: [0, idx % 2 === 0 ? 10 : -10, idx % 2 === 0 ? -4 : 4],
              scale: [0.65, 1.05, 0.95, 0.75],
            }}
            transition={{
              duration: glyph.duration,
              delay: glyph.delay,
              repeat: Infinity,
              ease: 'easeOut',
            }}
            className={`absolute font-display font-bold select-none ${
              isLarge ? 'text-base' : 'text-sm'
            } ${glyph.color}`}
          >
            {glyph.char}
          </motion.span>
        ))}
      </div>

      {/* 3D Open Storybook */}
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ perspective: 900 }}
        className={`relative mt-4 flex items-center justify-center ${
          isLarge ? 'w-32 h-20' : 'w-24 h-16'
        }`}
      >
        {/* Book Cover Base */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-sky-600 to-indigo-600 dark:from-sky-500 dark:to-indigo-600 shadow-lg shadow-sky-900/20 dark:shadow-black/50 p-1">
          {/* Spine shadow */}
          <div className="relative flex h-full w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
            {/* Left Static Page */}
            <div className="relative w-1/2 h-full bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-700/80 p-2 flex flex-col justify-center gap-1.5">
              <span className="h-1 w-3/4 rounded-full bg-sky-200 dark:bg-sky-800/80" />
              <span className="h-1 w-full rounded-full bg-slate-200 dark:bg-slate-700" />
              <span className="h-1 w-2/3 rounded-full bg-slate-200 dark:bg-slate-700" />
              <span className="h-1 w-4/5 rounded-full bg-amber-200/90 dark:bg-amber-700/60" />
            </div>

            {/* Right Static Page */}
            <div className="relative w-1/2 h-full bg-[#FAFBFD] dark:bg-slate-900/95 p-2 flex flex-col justify-center gap-1.5">
              <span className="h-1 w-4/5 rounded-full bg-indigo-200 dark:bg-indigo-800/80" />
              <span className="h-1 w-full rounded-full bg-slate-200 dark:bg-slate-700" />
              <span className="h-1 w-3/4 rounded-full bg-slate-200 dark:bg-slate-700" />
              <span className="h-1 w-1/2 rounded-full bg-emerald-200/90 dark:bg-emerald-700/60" />
            </div>

            {/* Center Book Spine Crease */}
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-2 -translate-x-1/2 bg-gradient-to-r from-slate-300/40 via-slate-400/30 to-slate-300/40 dark:from-black/40 dark:via-black/20 dark:to-black/40" />
          </div>
        </div>

        {/* Continuous 3D Flipping Page 1 */}
        <motion.div
          style={{
            transformOrigin: 'left center',
            transformStyle: 'preserve-3d',
          }}
          animate={{ rotateY: [0, -180] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: [0.45, 0.05, 0.55, 0.95],
          }}
          className="absolute right-1 top-1 bottom-1 w-[calc(50%-4px)] rounded-r-lg bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-sm p-2 flex flex-col justify-center gap-1.5"
        >
          <span className="h-1 w-3/4 rounded-full bg-sky-300/80 dark:bg-sky-500/50" />
          <span className="h-1 w-full rounded-full bg-slate-200 dark:bg-slate-600" />
          <span className="h-1 w-2/3 rounded-full bg-slate-200 dark:bg-slate-600" />
        </motion.div>

        {/* Continuous 3D Flipping Page 2 (staggered) */}
        <motion.div
          style={{
            transformOrigin: 'left center',
            transformStyle: 'preserve-3d',
          }}
          animate={{ rotateY: [0, -180] }}
          transition={{
            duration: 1.5,
            delay: 0.75,
            repeat: Infinity,
            ease: [0.45, 0.05, 0.55, 0.95],
          }}
          className="absolute right-1 top-1 bottom-1 w-[calc(50%-4px)] rounded-r-lg bg-[#F8FAFC] dark:bg-slate-800/95 border border-slate-200/80 dark:border-slate-700 shadow-sm p-2 flex flex-col justify-center gap-1.5"
        >
          <span className="h-1 w-2/3 rounded-full bg-amber-300/80 dark:bg-amber-500/50" />
          <span className="h-1 w-full rounded-full bg-slate-200 dark:bg-slate-600" />
          <span className="h-1 w-4/5 rounded-full bg-slate-200 dark:bg-slate-600" />
        </motion.div>

        {/* Bookmark Ribbon */}
        <motion.div
          animate={{ y: [0, 2, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-2.5 h-3.5 bg-amber-500 dark:bg-amber-400 rounded-b-sm shadow-xs"
        />
      </motion.div>
    </div>
  );
}

export function AppLoadingScreen({
  variant,
  phase = 'bundle',
  label = 'TM-Lingo',
  subtitle,
  locale = 'vi',
  compact = false,
}: AppLoadingScreenProps) {
  const resolvedVariant = variant ?? (compact ? 'page' : 'splash');
  const isVi = locale.startsWith('vi');
  const steps = isVi ? SPLASH_STEPS_VI : SPLASH_STEPS_EN;
  const [stepIndex, setStepIndex] = useState(phase === 'bundle' ? 0 : 1);

  useEffect(() => {
    if (resolvedVariant !== 'splash') return;
    const timer = window.setInterval(() => {
      setStepIndex((prev) => (prev + 1) % steps.length);
    }, 1050);
    return () => window.clearInterval(timer);
  }, [resolvedVariant, steps.length]);

  if (resolvedVariant === 'inline') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center justify-center gap-2.5 py-8 px-4 text-center"
      >
        <StorybookAnimation size="md" />
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {subtitle ?? (isVi ? 'Đang mở trang...' : 'Turning pages...')}
        </p>
      </div>
    );
  }

  if (resolvedVariant === 'page') {
    return (
      <motion.div
        role="status"
        aria-live="polite"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="min-h-[60vh] w-full flex flex-col items-center justify-center py-12 px-6 text-slate-900 dark:text-slate-100"
      >
        <div className="flex flex-col items-center text-center max-w-xs w-full">
          <StorybookAnimation size="md" />

          <h2 className="mt-3 font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {label}
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            {subtitle ??
              (isVi ? 'Đang lật trang bài học...' : 'Turning to your lesson...')}
          </p>

          {/* Soft bookmark progress rail */}
          <div className="mt-5 w-40 h-1.5 rounded-full bg-slate-200/90 dark:bg-slate-800 overflow-hidden">
            <motion.div
              aria-hidden="true"
              initial={{ x: '-100%' }}
              animate={{ x: '220%' }}
              transition={{
                duration: 1.3,
                repeat: Infinity,
                ease: [0.4, 0, 0.2, 1],
              }}
              className="w-1/2 h-full rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-amber-400"
            />
          </div>
        </div>
      </motion.div>
    );
  }

  // Fullscreen PWA Splash Screen (Storybook Flip + Floating Letters)
  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.018 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#F6F8FB] dark:bg-[#090E1A] text-[#0F172A] dark:text-[#F1F5F9] px-6"
    >
      {/* Soft warm storybook backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-75 dark:opacity-50"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 42%, rgba(14, 165, 233, 0.14), transparent 52%), radial-gradient(circle at 60% 56%, rgba(245, 158, 11, 0.08), transparent 45%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex w-full max-w-sm flex-col items-center text-center"
      >
        {/* Compact Brand Crest Badge */}
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200/90 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 px-3 py-1 shadow-xs backdrop-blur-sm">
          <img
            src={BRAND_ICON_SRC}
            alt="TM-Lingo"
            referrerPolicy="no-referrer"
            className="w-5 h-5 rounded-md object-cover"
          />
          <span className="font-display text-xs font-bold tracking-tight text-slate-800 dark:text-slate-100">
            {label}
          </span>
        </div>

        {/* 3D Flipping Storybook + Floating Multilingual Glyphs */}
        <StorybookAnimation size="lg" />

        {/* Tagline */}
        <p className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
          {isVi
            ? 'Nền tảng học đa ngôn ngữ & đọc truyện gia đình'
            : 'Multilingual learning & interactive family stories'}
        </p>

        {/* Smooth Progress Rail + Cycling Status */}
        <div className="mt-5 w-full max-w-[240px]">
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <motion.div
              aria-hidden="true"
              className="h-full w-2/5 rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-amber-400"
              animate={{ x: ['-100%', '260%'] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>

          <div className="mt-3 flex min-h-[18px] items-center justify-center text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <AnimatePresence mode="wait">
              <motion.span
                key={subtitle ? 'custom' : stepIndex}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                {subtitle || steps[stepIndex]}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

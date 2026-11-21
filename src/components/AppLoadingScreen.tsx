'use client';

import { motion } from 'motion/react';
import { BRAND_ICON_SRC } from './BrandLogo';

interface AppLoadingScreenProps {
  label?: string;
  subtitle?: string;
  compact?: boolean;
}

export function AppLoadingScreen({
  label = 'TM-Lingo',
  subtitle = 'Đang chuẩn bị không gian học tập...',
  compact = false,
}: AppLoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`${
        compact ? 'min-h-[60vh] py-12' : 'min-h-screen'
      } w-full flex flex-col items-center justify-center px-6 bg-[#F8FAFC] dark:bg-[#0B1120] text-[#0F172A] dark:text-[#F1F5F9] transition-colors`}
    >
      <div className="flex flex-col items-center text-center max-w-xs w-full">
        {/* Shared Brand Icon with gentle breathing glow */}
        <div className="relative flex items-center justify-center">
          <motion.span
            aria-hidden="true"
            animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.12, 0.35] }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute inset-0 rounded-[26px] bg-sky-500/30 dark:bg-sky-400/25 blur-md"
          />
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-20 h-20 rounded-[22px] shadow-lg shadow-sky-900/15 dark:shadow-black/40 overflow-hidden"
          >
            <img
              src={BRAND_ICON_SRC}
              alt="TM-Lingo"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </motion.div>
        </div>

        {/* Brand Name */}
        <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {label}
        </h1>
        <p className="mt-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>

        {/* Smooth indeterminate progress bar */}
        <div className="mt-6 w-40 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <motion.div
            aria-hidden="true"
            initial={{ x: '-100%' }}
            animate={{ x: '220%' }}
            transition={{
              duration: 1.35,
              repeat: Infinity,
              ease: [0.4, 0, 0.2, 1],
            }}
            className="w-1/2 h-full rounded-full bg-sky-600 dark:bg-sky-400"
          />
        </div>
      </div>
    </div>
  );
}

'use client';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: { box: 'w-7 h-7 rounded-lg', text: 'text-base' },
  md: { box: 'w-8 h-8 rounded-[9px]', text: 'text-xl' },
  lg: { box: 'w-11 h-11 rounded-xl', text: 'text-2xl' },
  xl: { box: 'w-16 h-16 rounded-2xl', text: 'text-3xl' },
} as const;

export const BRAND_ICON_SRC = '/pwa-192x192.png';

export function BrandLogo({
  size = 'md',
  showWordmark = true,
  className = '',
}: BrandLogoProps) {
  const styles = SIZE_MAP[size];

  return (
    <span
      className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none ${className}`}
    >
      <img
        src={BRAND_ICON_SRC}
        alt="TM-Lingo"
        referrerPolicy="no-referrer"
        className={`${styles.box} object-cover shadow-xs shrink-0`}
      />
      {showWordmark && (
        <span
          className={`font-display ${styles.text} font-bold tracking-tight text-slate-900 dark:text-slate-50`}
        >
          TM-Lingo
        </span>
      )}
    </span>
  );
}

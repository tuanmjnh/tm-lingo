import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { resolveVisualAsset } from '../shared/assetRegistry';

interface AssetImageProps {
  assetRef: string;
  altOverride?: string;
  className?: string;
}

export function AssetImage({
  assetRef,
  altOverride,
  className = 'w-full h-full object-cover',
}: AssetImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const entry = resolveVisualAsset(assetRef);
  const hasFailed = !entry.src || failedSrc === entry.src;

  if (hasFailed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 ${entry.fallbackBg} text-slate-600 ${className}`}
        role="img"
        aria-label={altOverride ?? entry.alt}
      >
        <ImageOff className="w-7 h-7 text-slate-400" aria-hidden="true" />
        <span className="text-sm font-medium">{entry.fallbackText}</span>
      </div>
    );
  }

  return (
    <img
      src={entry.src}
      alt={altOverride ?? entry.alt}
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(entry.src)}
      className={className}
    />
  );
}

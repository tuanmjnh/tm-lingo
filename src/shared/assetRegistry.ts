export interface VisualAssetEntry {
  src: string;
  alt: string;
  fallbackBg: string;
  fallbackText: string;
}

export const ASSET_REGISTRY: Record<string, VisualAssetEntry> = {
  'img-apple': {
    src: '/src/assets/images/fruit_apple_1795077740271.jpg',
    alt: 'Red apple illustration',
    fallbackBg: 'bg-rose-50',
    fallbackText: 'Apple',
  },
  'img-banana': {
    src: '/src/assets/images/fruit_banana_1795077740387.jpg',
    alt: 'Yellow banana illustration',
    fallbackBg: 'bg-amber-50',
    fallbackText: 'Banana',
  },
  'img-orange': {
    src: '/src/assets/images/fruit_orange_1795077740170.jpg',
    alt: 'Round orange fruit illustration',
    fallbackBg: 'bg-orange-50',
    fallbackText: 'Orange',
  },
  'img-story-fruit-market': {
    src: '/src/assets/images/story_fruit_market_1795077740922.jpg',
    alt: 'Sunny morning fruit market stall illustration',
    fallbackBg: 'bg-sky-50',
    fallbackText: 'Fruit Market',
  },
};

export function resolveVisualAsset(assetRef: string): VisualAssetEntry {
  return (
    ASSET_REGISTRY[assetRef] ?? {
      src: '',
      alt: 'Learning illustration',
      fallbackBg: 'bg-slate-100',
      fallbackText: assetRef,
    }
  );
}

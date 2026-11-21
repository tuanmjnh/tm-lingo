export interface VisualAssetEntry {
  src: string;
  alt: string;
  fallbackBg: string;
  fallbackText: string;
}

export const ASSET_REGISTRY: Record<string, VisualAssetEntry> = {
  'img-apple': {
    src: '/images/fruit_apple_1795077740271.jpg',
    alt: 'Red apple illustration',
    fallbackBg: 'bg-rose-50',
    fallbackText: 'Apple',
  },
  'img-banana': {
    src: '/images/fruit_banana_1795077740387.jpg',
    alt: 'Yellow banana illustration',
    fallbackBg: 'bg-amber-50',
    fallbackText: 'Banana',
  },
  'img-orange': {
    src: '/images/fruit_orange_1795077740170.jpg',
    alt: 'Round orange fruit illustration',
    fallbackBg: 'bg-orange-50',
    fallbackText: 'Orange',
  },
  'img-story-fruit-market': {
    src: '/images/story_fruit_market_1795077740922.jpg',
    alt: 'Sunny morning fruit market stall illustration',
    fallbackBg: 'bg-sky-50',
    fallbackText: 'Fruit Market',
  },
  'img-cat': {
    src: '/images/animal_cat.jpg',
    alt: 'Cute orange tabby kitten illustration',
    fallbackBg: 'bg-amber-50',
    fallbackText: 'Cat',
  },
  'img-dog': {
    src: '/images/animal_dog.jpg',
    alt: 'Friendly golden puppy illustration',
    fallbackBg: 'bg-orange-50',
    fallbackText: 'Dog',
  },
  'img-duck': {
    src: '/images/animal_duck.jpg',
    alt: 'Cheerful yellow duckling illustration',
    fallbackBg: 'bg-yellow-50',
    fallbackText: 'Duck',
  },
  'img-story-sunny-farm': {
    src: '/images/story_sunny_farm.jpg',
    alt: 'Sunny morning meadow farm with kitten, puppy, and duckling',
    fallbackBg: 'bg-emerald-50',
    fallbackText: 'Sunny Farm',
  },
};

export function resolveVisualAsset(assetRef: string): VisualAssetEntry {
  const raw = (assetRef || '').trim();
  const trimmed = raw.startsWith('/src/assets/images/')
    ? raw.replace('/src/assets/images/', '/images/')
    : raw;

  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('data:image/')
  ) {
    return {
      src: trimmed,
      alt: 'Learning illustration',
      fallbackBg: 'bg-sky-50',
      fallbackText: 'Illustration',
    };
  }
  return (
    ASSET_REGISTRY[trimmed] ?? {
      src: '',
      alt: 'Learning illustration',
      fallbackBg: 'bg-slate-100',
      fallbackText: trimmed || 'Illustration',
    }
  );
}

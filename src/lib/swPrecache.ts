'use client';

import type {
  LearningPackageSummary,
  ResolvedLessonPayload,
  StoryBook,
} from '../../packages/contracts/types';
import { resolveVisualAsset } from '../shared/assetRegistry';

const CACHE_LESSON = 'tm-lingo-lesson-assets-v1';
const CACHE_STORY = 'tm-lingo-story-assets-v1';

export type OfflineCacheStatus = 'idle' | 'caching' | 'ready';

export interface OfflineCacheRecord {
  status: OfflineCacheStatus;
  cachedCount: number;
  totalCount: number;
}

const DEFAULT_RECORD: OfflineCacheRecord = {
  status: 'idle',
  cachedCount: 0,
  totalCount: 0,
};

const lastPrecachedByBucket: Record<'lesson' | 'story', string> = {
  lesson: '',
  story: '',
};

const statusMap = new Map<string, OfflineCacheRecord>();
const listeners = new Set<() => void>();
let swMessageListenerBound = false;

function notifyListeners(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore
    }
  });
}

function setStatusRecord(key: string, record: OfflineCacheRecord): void {
  statusMap.set(key, record);
  notifyListeners();
}

function ensureSwMessageListener(): void {
  if (
    swMessageListenerBound ||
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return;
  }
  swMessageListenerBound = true;
  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as
      | {
          type?: string;
          bucket?: 'lesson' | 'story';
          resourceId?: string;
          cachedCount?: number;
          totalCount?: number;
          fullyCached?: boolean;
        }
      | undefined;

    if (!data || data.type !== 'PRECACHE_COMPLETE' || !data.resourceId) {
      return;
    }

    const totalCount = Number(data.totalCount) || 0;
    const cachedCount = Number(data.cachedCount) || 0;
    const isFullyCached =
      Boolean(data.fullyCached) || (totalCount > 0 && cachedCount >= totalCount);

    const statusKey = `${data.bucket || 'lesson'}:${data.resourceId}`;
    setStatusRecord(statusKey, {
      status: isFullyCached ? 'ready' : 'idle',
      cachedCount,
      totalCount,
    });
  });
}

export function getLessonResourceKey(lesson: ResolvedLessonPayload): string {
  return `${lesson.lessonId}:${lesson.mode}:${lesson.learningLocale}`;
}

export function getLessonOfflineStatus(resourceKey: string): OfflineCacheRecord {
  return statusMap.get(`lesson:${resourceKey}`) ?? DEFAULT_RECORD;
}

export function getStoryResourceKey(
  storyId: string,
  narrationLocale: string
): string {
  return `${storyId}:${narrationLocale}`;
}

export function getStoryOfflineStatus(resourceKey: string): OfflineCacheRecord {
  return statusMap.get(`story:${resourceKey}`) ?? DEFAULT_RECORD;
}

export function subscribeOfflineCacheStatus(listener: () => void): () => void {
  ensureSwMessageListener();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function addIfValidAssetUrl(set: Set<string>, raw?: string | null): void {
  if (!raw || typeof raw !== 'string') return;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('data:')) return;
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://')
  ) {
    set.add(trimmed);
  }
}

function addResolvedAssetRef(set: Set<string>, assetRef?: string | null): void {
  if (!assetRef) return;
  const resolved = resolveVisualAsset(assetRef);
  addIfValidAssetUrl(set, resolved.src);
}

function getPackageCoverRef(pkgId: string, topicId?: string): string {
  if (pkgId === 'lp-farm-a1' || topicId?.includes('farm')) {
    return 'img-story-sunny-farm';
  }
  if (pkgId === 'lp-fruits-a1' || topicId?.includes('fruit')) {
    return 'img-story-fruit-market';
  }
  if (pkgId.includes('primary') || pkgId.includes('6-8')) {
    return 'img-story-sunny-farm';
  }
  if (pkgId.includes('science') || pkgId.includes('9-11')) {
    return 'img-story-fruit-market';
  }
  return 'img-apple';
}

function collectLessonAssetUrls(
  lesson: ResolvedLessonPayload,
  pkg?: LearningPackageSummary | null
): string[] {
  const urls = new Set<string>();

  const lessonQuery = new URLSearchParams({
    mode: lesson.mode,
    learningLocale: lesson.learningLocale,
    explanationLocale: lesson.explanationLocale,
  });
  urls.add(
    `/api/v1/lessons/${encodeURIComponent(lesson.lessonId)}?${lessonQuery.toString()}`
  );
  urls.add('/api/v1/packages');
  urls.add(`/api/v1/voices?locale=${encodeURIComponent(lesson.learningLocale)}`);

  addResolvedAssetRef(urls, getPackageCoverRef(lesson.lessonId, pkg?.topicId));

  for (const act of lesson.activities) {
    addIfValidAssetUrl(urls, act.spokenAudioUrl);
    if (act.options) {
      for (const opt of act.options) {
        addResolvedAssetRef(urls, opt.assetRef);
      }
    }
    if (act.pairs) {
      for (const pair of act.pairs) {
        addResolvedAssetRef(urls, pair.assetRef);
      }
    }
  }

  return Array.from(urls).slice(0, 60);
}

async function checkUrlsInCache(
  cacheName: string,
  urls: string[]
): Promise<{ cachedCount: number; totalCount: number }> {
  if (typeof window === 'undefined' || !('caches' in window) || urls.length === 0) {
    return { cachedCount: 0, totalCount: urls.length };
  }
  try {
    const cache = await window.caches.open(cacheName);
    const normalized = urls.map((u) =>
      new URL(u, window.location.origin).toString()
    );
    const checks = await Promise.all(
      normalized.map(async (url) => {
        const hit = (await cache.match(url)) || (await window.caches.match(url));
        return Boolean(hit);
      })
    );
    return {
      cachedCount: checks.filter(Boolean).length,
      totalCount: normalized.length,
    };
  } catch {
    return { cachedCount: 0, totalCount: urls.length };
  }
}

async function directCacheFallback(
  bucket: 'lesson' | 'story',
  urls: string[]
): Promise<{ cachedCount: number; totalCount: number }> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { cachedCount: 0, totalCount: urls.length };
  }
  const cacheName = bucket === 'story' ? CACHE_STORY : CACHE_LESSON;
  try {
    const cache = await window.caches.open(cacheName);
    const normalized = Array.from(
      new Set(
        urls
          .slice(0, 60)
          .map((u) => new URL(u, window.location.origin).toString())
      )
    );
    const keepSet = new Set(normalized);
    const existingKeys = await cache.keys();
    await Promise.all(
      existingKeys
        .filter((req) => !keepSet.has(req.url))
        .map((req) => cache.delete(req))
    );

    let cachedCount = 0;
    const batchSize = 5;
    for (let i = 0; i < normalized.length; i += batchSize) {
      const batch = normalized.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (url) => {
          const parsed = new URL(url);
          const sameOrigin = parsed.origin === window.location.origin;
          const isApi = sameOrigin && parsed.pathname.startsWith('/api/');
          if (!isApi) {
            const hit = await cache.match(url);
            if (hit) return true;
          }
          try {
            const res = await fetch(url, {
              method: 'GET',
              mode: sameOrigin ? 'same-origin' : 'cors',
              credentials: sameOrigin ? 'same-origin' : 'omit',
            });
            if (res.ok) {
              await cache.put(url, res.clone());
              return true;
            }
          } catch {
            if (!sameOrigin) {
              try {
                const opaque = await fetch(url, {
                  method: 'GET',
                  mode: 'no-cors',
                  credentials: 'omit',
                });
                if (opaque.type === 'opaque') {
                  await cache.put(url, opaque.clone());
                  return true;
                }
              } catch {
                return false;
              }
            }
          }
          return false;
        })
      );
      cachedCount += results.filter(Boolean).length;
    }

    return { cachedCount, totalCount: normalized.length };
  } catch {
    return { cachedCount: 0, totalCount: urls.length };
  }
}

async function dispatchPrecache(
  bucket: 'lesson' | 'story',
  resourceId: string,
  urls: string[],
  options: { force?: boolean } = {}
): Promise<void> {
  if (typeof window === 'undefined') return;
  ensureSwMessageListener();

  const deduped = Array.from(new Set(urls)).slice(0, 60);
  if (deduped.length === 0) return;

  const statusKey = `${bucket}:${resourceId}`;
  const cacheName = bucket === 'story' ? CACHE_STORY : CACHE_LESSON;

  // Check if already fully cached (important after reload or when offline)
  const existingStats = await checkUrlsInCache(cacheName, deduped);
  if (
    existingStats.totalCount > 0 &&
    existingStats.cachedCount >= existingStats.totalCount
  ) {
    setStatusRecord(statusKey, {
      status: 'ready',
      cachedCount: existingStats.cachedCount,
      totalCount: existingStats.totalCount,
    });
    if (
      !options.force ||
      (typeof navigator !== 'undefined' && !navigator.onLine)
    ) {
      return;
    }
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const signature = `${resourceId}:${deduped.length}`;
  if (
    !options.force &&
    lastPrecachedByBucket[bucket] === signature &&
    statusMap.get(statusKey)?.status === 'ready'
  ) {
    return;
  }
  lastPrecachedByBucket[bucket] = signature;

  if (statusMap.get(statusKey)?.status !== 'ready') {
    setStatusRecord(statusKey, {
      status: 'caching',
      cachedCount: existingStats.cachedCount,
      totalCount: deduped.length,
    });
  }

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const worker = reg.active || navigator.serviceWorker.controller;
      if (worker) {
        worker.postMessage({
          type: 'PRECACHE_ASSETS',
          bucket,
          resourceId,
          urls: deduped,
        });
        return;
      }
    } catch {
      // fall through to direct window.caches fallback
    }
  }

  const stats = await directCacheFallback(bucket, deduped);
  setStatusRecord(statusKey, {
    status:
      stats.totalCount > 0 && stats.cachedCount >= stats.totalCount
        ? 'ready'
        : 'idle',
    cachedCount: stats.cachedCount,
    totalCount: stats.totalCount,
  });
}

/**
 * Verifies Cache API status for a lesson package (works offline too).
 */
export async function verifyLessonOfflineReady(
  lesson: ResolvedLessonPayload,
  pkg?: LearningPackageSummary | null
): Promise<OfflineCacheRecord> {
  const resourceId = getLessonResourceKey(lesson);
  const urls = collectLessonAssetUrls(lesson, pkg);
  const stats = await checkUrlsInCache(CACHE_LESSON, urls);
  const record: OfflineCacheRecord = {
    status:
      stats.totalCount > 0 && stats.cachedCount >= stats.totalCount
        ? 'ready'
        : getLessonOfflineStatus(resourceId).status,
    cachedCount: stats.cachedCount,
    totalCount: stats.totalCount,
  };
  setStatusRecord(`lesson:${resourceId}`, record);
  return record;
}

/**
 * Pre-caches the active lesson package's API payload, cover art, activity options,
 * match pairs, and pre-recorded audio into the Service Worker Cache API.
 */
export async function precacheActiveLessonAssets(
  lesson: ResolvedLessonPayload,
  pkg?: LearningPackageSummary | null
): Promise<void> {
  const urls = collectLessonAssetUrls(lesson, pkg);
  await dispatchPrecache('lesson', getLessonResourceKey(lesson), urls);
}

function collectStoryAssetUrls(
  story: StoryBook,
  narrationLocale: string
): string[] {
  const urls = new Set<string>();

  urls.add(`/api/v1/stories/${encodeURIComponent(story.id)}`);
  urls.add('/api/v1/stories');
  urls.add(`/api/v1/voices?locale=${encodeURIComponent(narrationLocale)}`);

  addResolvedAssetRef(urls, story.coverAssetRef);

  for (const seg of story.segments) {
    addResolvedAssetRef(urls, seg.assetRef);
    if (seg.audioUrlByLocale) {
      for (const audioUrl of Object.values(seg.audioUrlByLocale)) {
        addIfValidAssetUrl(urls, audioUrl);
      }
    }
  }

  return Array.from(urls).slice(0, 60);
}

/**
 * Verifies Cache API status for a storybook (works offline too).
 */
export async function verifyStoryOfflineReady(
  story: StoryBook,
  narrationLocale: string
): Promise<OfflineCacheRecord> {
  const resourceId = getStoryResourceKey(story.id, narrationLocale);
  const urls = collectStoryAssetUrls(story, narrationLocale);
  const stats = await checkUrlsInCache(CACHE_STORY, urls);
  const record: OfflineCacheRecord = {
    status:
      stats.totalCount > 0 && stats.cachedCount >= stats.totalCount
        ? 'ready'
        : getStoryOfflineStatus(resourceId).status,
    cachedCount: stats.cachedCount,
    totalCount: stats.totalCount,
  };
  setStatusRecord(`story:${resourceId}`, record);
  return record;
}

/**
 * Checks which stories in a library list have their core story payload cached offline.
 */
export async function getCachedStoryIds(stories: StoryBook[]): Promise<string[]> {
  if (
    typeof window === 'undefined' ||
    !('caches' in window) ||
    stories.length === 0
  ) {
    return [];
  }
  try {
    const cache = await window.caches.open(CACHE_STORY);
    const checks = await Promise.all(
      stories.map(async (s) => {
        const storyUrl = new URL(
          `/api/v1/stories/${encodeURIComponent(s.id)}`,
          window.location.origin
        ).toString();
        const hit =
          (await cache.match(storyUrl)) || (await window.caches.match(storyUrl));
        return hit ? s.id : null;
      })
    );
    return checks.filter((id): id is string => Boolean(id));
  } catch {
    return [];
  }
}

/**
 * Pre-caches the most recently accessed storybook's API payload, cover image,
 * all page illustrations, and narration audio URLs into the Service Worker Cache API.
 */
export async function precacheStorybookAssets(
  story: StoryBook,
  narrationLocale: string,
  options: { force?: boolean } = {}
): Promise<void> {
  const urls = collectStoryAssetUrls(story, narrationLocale);
  await dispatchPrecache(
    'story',
    getStoryResourceKey(story.id, narrationLocale),
    urls,
    options
  );
}

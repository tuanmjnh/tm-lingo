'use client';

import type { ExperienceMode } from '../../packages/contracts/types';

export type OfflineMutation =
  | {
      id: string;
      kind: 'lesson_progress';
      lessonId: string;
      payload: {
        learnerId: string;
        learningLocale: string;
        mode: ExperienceMode;
        completedActivityIds: string[];
        totalActivities: number;
        lastActivityIndex: number;
        completed: boolean;
      };
      createdAt: string;
    }
  | {
      id: string;
      kind: 'story_position';
      storyId: string;
      payload: {
        learnerId: string;
        narrationLocale: string;
        segmentIndex: number;
      };
      createdAt: string;
    };

const DB_NAME = 'tm_lingo_offline_v1';
const DB_VERSION = 1;
const STORE_QUEUE = 'sync_queue';
const STORE_CACHE = 'content_cache';

const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore
    }
  });
}

export function subscribeOfflineQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_CACHE)) {
          db.createObjectStore(STORE_CACHE, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export type OfflineMutationInput =
  | Omit<Extract<OfflineMutation, { kind: 'lesson_progress' }>, 'id' | 'createdAt'>
  | Omit<Extract<OfflineMutation, { kind: 'story_position' }>, 'id' | 'createdAt'>;

export async function enqueueOfflineMutation(
  mutation: OfflineMutationInput
): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const record = {
    ...mutation,
    id: `mut-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  } as OfflineMutation;

  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    tx.objectStore(STORE_QUEUE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  notifyListeners();
}

export async function listOfflineMutations(): Promise<OfflineMutation[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_QUEUE, 'readonly');
    const req = tx.objectStore(STORE_QUEUE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as OfflineMutation[]) ?? [];
      rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      resolve(rows);
    };
    req.onerror = () => resolve([]);
  });
}

export async function getPendingQueueCount(): Promise<number> {
  const items = await listOfflineMutations();
  return items.length;
}

async function removeOfflineMutation(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    tx.objectStore(STORE_QUEUE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function flushOfflineQueue(handlers: {
  syncProgress: (
    lessonId: string,
    payload: Extract<OfflineMutation, { kind: 'lesson_progress' }>['payload']
  ) => Promise<unknown>;
  syncStoryPosition: (
    storyId: string,
    payload: Extract<OfflineMutation, { kind: 'story_position' }>['payload']
  ) => Promise<unknown>;
}): Promise<{ synced: number; remaining: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const pending = await getPendingQueueCount();
    return { synced: 0, remaining: pending };
  }

  const items = await listOfflineMutations();
  let synced = 0;
  for (const item of items) {
    try {
      if (item.kind === 'lesson_progress') {
        await handlers.syncProgress(item.lessonId, item.payload);
      } else {
        await handlers.syncStoryPosition(item.storyId, item.payload);
      }
      await removeOfflineMutation(item.id);
      synced += 1;
    } catch {
      // Keep item in queue for next online cycle
      break;
    }
  }

  const remaining = await getPendingQueueCount();
  if (synced > 0) {
    notifyListeners();
  }
  return { synced, remaining };
}

export async function cacheContent<T>(key: string, data: T): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_CACHE, 'readwrite');
    tx.objectStore(STORE_CACHE).put({
      key,
      data,
      updatedAt: new Date().toISOString(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function getCachedContent<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_CACHE, 'readonly');
    const req = tx.objectStore(STORE_CACHE).get(key);
    req.onsuccess = () => {
      const row = req.result as { data?: T } | undefined;
      resolve(row?.data ?? null);
    };
    req.onerror = () => resolve(null);
  });
}

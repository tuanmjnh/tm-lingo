'use client';

export interface StickerDefinition {
  id: string;
  assetRef: string;
  labelVi: string;
  labelEn: string;
  unlockSource: string;
}

export interface PlacedSticker {
  instanceId: string;
  stickerId: string;
  xPercent: number;
  yPercent: number;
}

export interface DailyActivityLogEntry {
  dateKey: string; // YYYY-MM-DD
  lessonsCompleted: number;
  storiesRead: number;
  wordsPracticed: number;
}

export interface LearnerRewardState {
  unlockedStickerIds: string[];
  placedStickers: PlacedSticker[];
  dailyLog: Record<string, DailyActivityLogEntry>;
  trickyWords: Record<string, { term: string; replays: number }>;
}

export const STICKER_CATALOG: StickerDefinition[] = [
  {
    id: 'sticker-apple',
    assetRef: 'img-apple',
    labelVi: 'Táo Đỏ Chăm Chỉ',
    labelEn: 'Crisp Red Apple',
    unlockSource: 'lp-fruits-a1',
  },
  {
    id: 'sticker-banana',
    assetRef: 'img-banana',
    labelVi: 'Chuối Vàng Vui Vẻ',
    labelEn: 'Sunny Banana',
    unlockSource: 'lp-fruits-a1',
  },
  {
    id: 'sticker-orange',
    assetRef: 'img-orange',
    labelVi: 'Cam Mọng Năng Lượng',
    labelEn: 'Juicy Orange',
    unlockSource: 'story-fruit-market',
  },
  {
    id: 'sticker-cat',
    assetRef: 'img-cat',
    labelVi: 'Bạn Mèo Ngoan',
    labelEn: 'Cozy Kitten',
    unlockSource: 'lp-farm-a1',
  },
  {
    id: 'sticker-dog',
    assetRef: 'img-dog',
    labelVi: 'Cún Con Nhanh Nhẹn',
    labelEn: 'Playful Puppy',
    unlockSource: 'lp-farm-a1',
  },
  {
    id: 'sticker-duck',
    assetRef: 'img-duck',
    labelVi: 'Vịt Vàng Khám Phá',
    labelEn: 'Curious Duckling',
    unlockSource: 'story-sunny-farm',
  },
];

const REWARDS_KEY_PREFIX = 'tm-lingo-rewards-v1:';
const PARENTAL_GATE_KEY = 'tm-lingo-parental-gate-enabled';

export function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isParentalGateEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(PARENTAL_GATE_KEY) === '1';
}

export function setParentalGateEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PARENTAL_GATE_KEY, enabled ? '1' : '0');
}

function emptyState(): LearnerRewardState {
  return {
    unlockedStickerIds: ['sticker-apple'],
    placedStickers: [],
    dailyLog: {},
    trickyWords: {},
  };
}

export function loadLearnerRewards(learnerId: string): LearnerRewardState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.localStorage.getItem(`${REWARDS_KEY_PREFIX}${learnerId}`);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<LearnerRewardState>;
    return {
      unlockedStickerIds: Array.from(
        new Set(['sticker-apple', ...(parsed.unlockedStickerIds ?? [])])
      ),
      placedStickers: Array.isArray(parsed.placedStickers)
        ? parsed.placedStickers
        : [],
      dailyLog: parsed.dailyLog ?? {},
      trickyWords: parsed.trickyWords ?? {},
    };
  } catch {
    return emptyState();
  }
}

export function saveLearnerRewards(
  learnerId: string,
  state: LearnerRewardState
): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    `${REWARDS_KEY_PREFIX}${learnerId}`,
    JSON.stringify(state)
  );
}

export function recordLearnerActivity(
  learnerId: string,
  event: {
    kind: 'lesson' | 'story' | 'memory';
    sourceId: string;
    wordsCount?: number;
  }
): { state: LearnerRewardState; newlyUnlocked: StickerDefinition | null } {
  const current = loadLearnerRewards(learnerId);
  const today = getTodayDateKey();
  const existingDay = current.dailyLog[today] ?? {
    dateKey: today,
    lessonsCompleted: 0,
    storiesRead: 0,
    wordsPracticed: 0,
  };

  const updatedDay: DailyActivityLogEntry = {
    dateKey: today,
    lessonsCompleted:
      existingDay.lessonsCompleted + (event.kind === 'story' ? 0 : 1),
    storiesRead: existingDay.storiesRead + (event.kind === 'story' ? 1 : 0),
    wordsPracticed: existingDay.wordsPracticed + (event.wordsCount ?? 3),
  };

  // Unlock matching sticker or next locked sticker in catalog
  const matching = STICKER_CATALOG.find(
    (s) =>
      s.unlockSource === event.sourceId &&
      !current.unlockedStickerIds.includes(s.id)
  );
  const nextLocked =
    matching ??
    STICKER_CATALOG.find((s) => !current.unlockedStickerIds.includes(s.id)) ??
    null;

  const unlockedStickerIds = nextLocked
    ? Array.from(new Set([...current.unlockedStickerIds, nextLocked.id]))
    : current.unlockedStickerIds;

  const nextState: LearnerRewardState = {
    ...current,
    unlockedStickerIds,
    dailyLog: {
      ...current.dailyLog,
      [today]: updatedDay,
    },
  };
  saveLearnerRewards(learnerId, nextState);
  return { state: nextState, newlyUnlocked: nextLocked };
}

export function recordWordReplay(
  learnerId: string,
  wordKey: string,
  term: string
): void {
  if (!wordKey || !term) return;
  const current = loadLearnerRewards(learnerId);
  const prev = current.trickyWords[wordKey];
  const nextState: LearnerRewardState = {
    ...current,
    trickyWords: {
      ...current.trickyWords,
      [wordKey]: {
        term,
        replays: (prev?.replays ?? 0) + 1,
      },
    },
  };
  saveLearnerRewards(learnerId, nextState);
}

export function computeLast7Days(
  learnerId: string,
  progressDates: string[] = []
): {
  days: Array<{
    dateKey: string;
    shortDay: string;
    active: boolean;
    lessons: number;
    stories: number;
    words: number;
  }>;
  streakDays: number;
  totalWords7d: number;
  activeDaysCount: number;
} {
  const rewards = loadLearnerRewards(learnerId);
  const progressDateSet = new Set(
    progressDates.map((iso) => iso.slice(0, 10)).filter(Boolean)
  );

  const days: Array<{
    dateKey: string;
    shortDay: string;
    active: boolean;
    lessons: number;
    stories: number;
    words: number;
  }> = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateKey = `${y}-${m}-${day}`;
    const log = rewards.dailyLog[dateKey];
    const hasProgress = progressDateSet.has(dateKey);
    const lessons = log?.lessonsCompleted ?? (hasProgress ? 1 : 0);
    const stories = log?.storiesRead ?? 0;
    const words = log?.wordsPracticed ?? (hasProgress ? 3 : 0);
    const active = lessons > 0 || stories > 0;
    const weekdayIdx = d.getDay();
    const shortLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    days.push({
      dateKey,
      shortDay: shortLabels[weekdayIdx] ?? '',
      active,
      lessons,
      stories,
      words,
    });
  }

  let streakDays = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    if (days[i].active) {
      streakDays += 1;
    } else if (i === days.length - 1) {
      // Today hasn't finished yet; keep checking yesterday
      continue;
    } else {
      break;
    }
  }

  return {
    days,
    streakDays,
    totalWords7d: days.reduce((sum, d) => sum + d.words, 0),
    activeDaysCount: days.filter((d) => d.active).length,
  };
}

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

export interface TrickyWordEntry {
  term: string;
  replays: number;
  locale?: string;
  masteredAt?: string | null;
  lastReviewedAt?: string | null;
}

export interface LearnerRewardState {
  unlockedStickerIds: string[];
  placedStickers: PlacedSticker[];
  dailyLog: Record<string, DailyActivityLogEntry>;
  trickyWords: Record<string, TrickyWordEntry>;
  goalMetDates?: string[]; // Sorted YYYY-MM-DD dates when 100% daily goal was achieved
  longestGoalStreak?: number;
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

export function formatLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayDateKey(): string {
  return formatLocalDateKey(new Date());
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
    goalMetDates: [],
    longestGoalStreak: 0,
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
      goalMetDates: Array.isArray(parsed.goalMetDates)
        ? Array.from(
            new Set(
              parsed.goalMetDates.filter(
                (d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
              )
            )
          ).sort()
        : [],
      longestGoalStreak:
        typeof parsed.longestGoalStreak === 'number' &&
        Number.isFinite(parsed.longestGoalStreak)
          ? Math.max(0, Math.floor(parsed.longestGoalStreak))
          : 0,
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
  term: string,
  locale?: string
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
        locale: locale ?? prev?.locale,
        masteredAt: null,
        lastReviewedAt: prev?.lastReviewedAt ?? null,
      },
    },
  };
  saveLearnerRewards(learnerId, nextState);
}

export interface TrickyWordItem extends TrickyWordEntry {
  key: string;
}

export function getTrickyWordsForReview(learnerId: string): TrickyWordItem[] {
  const state = loadLearnerRewards(learnerId);
  return Object.entries(state.trickyWords)
    .filter(([, entry]) => !entry.masteredAt && Boolean(entry.term?.trim()))
    .map(([key, entry]) => ({ key, ...entry }))
    .sort((a, b) => b.replays - a.replays);
}

export function getMasteredWordsList(learnerId: string): TrickyWordItem[] {
  const state = loadLearnerRewards(learnerId);
  return Object.entries(state.trickyWords)
    .filter(([, entry]) => Boolean(entry.masteredAt) && Boolean(entry.term?.trim()))
    .map(([key, entry]) => ({ key, ...entry }))
    .sort((a, b) =>
      String(b.masteredAt ?? '').localeCompare(String(a.masteredAt ?? ''))
    );
}

export function markTrickyWordMastered(
  learnerId: string,
  wordKey: string
): LearnerRewardState {
  const current = loadLearnerRewards(learnerId);
  const prev = current.trickyWords[wordKey];
  if (!prev) return current;
  const nowIso = new Date().toISOString();
  const today = getTodayDateKey();
  const existingDay = current.dailyLog[today] ?? {
    dateKey: today,
    lessonsCompleted: 0,
    storiesRead: 0,
    wordsPracticed: 0,
  };
  const nextState: LearnerRewardState = {
    ...current,
    trickyWords: {
      ...current.trickyWords,
      [wordKey]: {
        ...prev,
        masteredAt: nowIso,
        lastReviewedAt: nowIso,
      },
    },
    dailyLog: {
      ...current.dailyLog,
      [today]: {
        ...existingDay,
        wordsPracticed: existingDay.wordsPracticed + 1,
      },
    },
  };
  saveLearnerRewards(learnerId, nextState);
  return nextState;
}

export function restoreTrickyWordForReview(
  learnerId: string,
  wordKey: string
): LearnerRewardState {
  const current = loadLearnerRewards(learnerId);
  const prev = current.trickyWords[wordKey];
  if (!prev) return current;
  const nextState: LearnerRewardState = {
    ...current,
    trickyWords: {
      ...current.trickyWords,
      [wordKey]: {
        ...prev,
        masteredAt: null,
      },
    },
  };
  saveLearnerRewards(learnerId, nextState);
  return nextState;
}

export function recordTrickyWordPractice(
  learnerId: string,
  wordKey: string
): LearnerRewardState {
  const current = loadLearnerRewards(learnerId);
  const prev = current.trickyWords[wordKey];
  if (!prev) return current;
  const today = getTodayDateKey();
  const existingDay = current.dailyLog[today] ?? {
    dateKey: today,
    lessonsCompleted: 0,
    storiesRead: 0,
    wordsPracticed: 0,
  };
  const nextState: LearnerRewardState = {
    ...current,
    trickyWords: {
      ...current.trickyWords,
      [wordKey]: {
        ...prev,
        lastReviewedAt: new Date().toISOString(),
      },
    },
    dailyLog: {
      ...current.dailyLog,
      [today]: {
        ...existingDay,
        wordsPracticed: existingDay.wordsPracticed + 1,
      },
    },
  };
  saveLearnerRewards(learnerId, nextState);
  return nextState;
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

export interface GoalStreakDay {
  dateKey: string;
  shortLabelVi: string;
  shortLabelEn: string;
  met: boolean;
  isToday: boolean;
}

export interface GoalStreakSummary {
  currentStreak: number;
  longestStreak: number;
  last7Days: GoalStreakDay[];
  nextMilestone: number;
  daysToMilestone: number;
}

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
const SHORT_DAY_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const SHORT_DAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseDateKeyToUtcDays(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return NaN;
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function computeLongestConsecutiveRun(dateKeys: string[]): number {
  if (dateKeys.length === 0) return 0;
  const uniqueDays = Array.from(
    new Set(dateKeys.map(parseDateKeyToUtcDays).filter((n) => Number.isFinite(n)))
  ).sort((a, b) => a - b);

  let best = 0;
  let run = 0;
  let prev = -Infinity;
  for (const dayNum of uniqueDays) {
    if (dayNum === prev + 1) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = dayNum;
  }
  return best;
}

function buildEffectiveGoalMetDateSet(
  state: LearnerRewardState,
  includeToday: boolean
): Set<string> {
  const set = new Set<string>(state.goalMetDates ?? []);
  // Backfill historical active days from dailyLog so existing learners retain continuity
  for (const [dateKey, entry] of Object.entries(state.dailyLog ?? {})) {
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(dateKey) &&
      (entry.lessonsCompleted > 0 || entry.storiesRead > 0)
    ) {
      set.add(dateKey);
    }
  }
  if (includeToday) {
    set.add(getTodayDateKey());
  }
  return set;
}

export function recordDailyGoalMet(
  learnerId: string,
  dateKey: string = getTodayDateKey()
): LearnerRewardState {
  const current = loadLearnerRewards(learnerId);
  const updatedDates = Array.from(
    new Set([...(current.goalMetDates ?? []), dateKey])
  ).sort();

  const mergedSet = buildEffectiveGoalMetDateSet(
    { ...current, goalMetDates: updatedDates },
    false
  );
  const longest = Math.max(
    current.longestGoalStreak ?? 0,
    computeLongestConsecutiveRun(Array.from(mergedSet))
  );

  const nextState: LearnerRewardState = {
    ...current,
    goalMetDates: updatedDates,
    longestGoalStreak: longest,
  };
  saveLearnerRewards(learnerId, nextState);
  return nextState;
}

export function computeGoalStreak(
  learnerId: string,
  options: { includeToday?: boolean } = {}
): GoalStreakSummary {
  const state = loadLearnerRewards(learnerId);
  const includeToday = Boolean(options.includeToday);
  const metSet = buildEffectiveGoalMetDateSet(state, includeToday);

  const now = new Date();
  const todayKey = formatLocalDateKey(now);

  // Count consecutive days ending today (or ending yesterday if today isn't met yet)
  let currentStreak = 0;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (metSet.has(todayKey)) {
    while (metSet.has(formatLocalDateKey(cursor))) {
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  } else {
    cursor.setDate(cursor.getDate() - 1);
    while (metSet.has(formatLocalDateKey(cursor))) {
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  const longestStreak = Math.max(
    state.longestGoalStreak ?? 0,
    currentStreak,
    computeLongestConsecutiveRun(Array.from(metSet))
  );

  const last7Days: GoalStreakDay[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const key = formatLocalDateKey(d);
    const weekday = d.getDay();
    last7Days.push({
      dateKey: key,
      shortLabelVi: SHORT_DAY_VI[weekday] ?? '',
      shortLabelEn: SHORT_DAY_EN[weekday] ?? '',
      met: metSet.has(key),
      isToday: offset === 0,
    });
  }

  const nextMilestone =
    STREAK_MILESTONES.find((m) => m > currentStreak) ??
    Math.ceil((currentStreak + 1) / 50) * 50;
  const daysToMilestone = Math.max(0, nextMilestone - currentStreak);

  return {
    currentStreak,
    longestStreak,
    last7Days,
    nextMilestone,
    daysToMilestone,
  };
}

export type AchievementIconKey =
  | 'starter'
  | 'streak3'
  | 'streak7'
  | 'bookworm'
  | 'wordMaster'
  | 'vocab30'
  | 'collector'
  | 'lessons5';

export interface AchievementBadge {
  id: string;
  icon: AchievementIconKey;
  tone: 'sky' | 'orange' | 'amber' | 'emerald' | 'violet' | 'rose';
  titleVi: string;
  titleEn: string;
  descriptionVi: string;
  descriptionEn: string;
  current: number;
  target: number;
  unlocked: boolean;
}

export interface LearnerAchievementsSummary {
  achievements: AchievementBadge[];
  unlockedCount: number;
  totalCount: number;
  totalLessons: number;
  totalStories: number;
  totalWords: number;
  masteredWords: number;
  longestStreak: number;
}

export function computeLearnerAchievements(
  learnerId: string
): LearnerAchievementsSummary {
  const state = loadLearnerRewards(learnerId);
  const streakSummary = computeGoalStreak(learnerId);
  const logs = Object.values(state.dailyLog ?? {});

  const totalLessons = logs.reduce(
    (sum, entry) => sum + (entry.lessonsCompleted ?? 0),
    0
  );
  const totalStories = logs.reduce(
    (sum, entry) => sum + (entry.storiesRead ?? 0),
    0
  );
  const totalWords = logs.reduce(
    (sum, entry) => sum + (entry.wordsPracticed ?? 0),
    0
  );
  const masteredWords = Object.values(state.trickyWords ?? {}).filter((w) =>
    Boolean(w.masteredAt)
  ).length;
  const unlockedStickers = state.unlockedStickerIds.length;
  const longestStreak = Math.max(
    streakSummary.longestStreak,
    streakSummary.currentStreak
  );

  const raw: Array<Omit<AchievementBadge, 'unlocked'>> = [
    {
      id: 'badge-first-lesson',
      icon: 'starter',
      tone: 'sky',
      titleVi: 'Khởi đầu rực rỡ',
      titleEn: 'Bright Starter',
      descriptionVi: 'Hoàn thành bài học đầu tiên trên TM-Lingo',
      descriptionEn: 'Complete your very first learning session',
      current: Math.min(1, totalLessons),
      target: 1,
    },
    {
      id: 'badge-streak-3',
      icon: 'streak3',
      tone: 'orange',
      titleVi: 'Chuỗi 3 ngày chăm chỉ',
      titleEn: '3-Day Goal Streak',
      descriptionVi: 'Đạt mục tiêu học tập 3 ngày liên tiếp',
      descriptionEn: 'Meet your daily learning goal 3 days in a row',
      current: Math.min(3, longestStreak),
      target: 3,
    },
    {
      id: 'badge-bookworm',
      icon: 'bookworm',
      tone: 'emerald',
      titleVi: 'Mọt sách nhí',
      titleEn: 'Little Bookworm',
      descriptionVi: 'Đọc trọn vẹn 3 câu chuyện song ngữ',
      descriptionEn: 'Finish reading 3 bilingual storybooks',
      current: Math.min(3, totalStories),
      target: 3,
    },
    {
      id: 'badge-word-master',
      icon: 'wordMaster',
      tone: 'violet',
      titleVi: 'Chiến binh ôn từ',
      titleEn: 'Word Champion',
      descriptionVi: 'Đánh dấu thuộc 5 từ trong Ôn tập từ khó',
      descriptionEn: 'Master 5 tricky words in Smart Word Review',
      current: Math.min(5, masteredWords),
      target: 5,
    },
    {
      id: 'badge-vocab-30',
      icon: 'vocab30',
      tone: 'amber',
      titleVi: 'Kho báu từ vựng',
      titleEn: 'Vocabulary Explorer',
      descriptionVi: 'Luyện tập tích lũy 30 lượt từ vựng',
      descriptionEn: 'Practice 30 vocabulary terms across lessons & stories',
      current: Math.min(30, totalWords),
      target: 30,
    },
    {
      id: 'badge-lessons-5',
      icon: 'lessons5',
      tone: 'sky',
      titleVi: 'Ngôi sao siêng năng',
      titleEn: 'Steady Study Star',
      descriptionVi: 'Hoàn thành 5 bài học từ vựng hoặc trò chơi',
      descriptionEn: 'Complete 5 vocabulary lessons or mini-games',
      current: Math.min(5, totalLessons),
      target: 5,
    },
    {
      id: 'badge-collector',
      icon: 'collector',
      tone: 'rose',
      titleVi: 'Nhà sưu tập Sticker',
      titleEn: 'Sticker Collector',
      descriptionVi: 'Mở khóa 4 nhãn dán khác nhau trong bộ sưu tập',
      descriptionEn: 'Unlock 4 different stickers in your collection',
      current: Math.min(4, unlockedStickers),
      target: 4,
    },
    {
      id: 'badge-streak-7',
      icon: 'streak7',
      tone: 'orange',
      titleVi: 'Ngọn lửa 7 ngày',
      titleEn: '7-Day Unstoppable',
      descriptionVi: 'Duy trì chuỗi học tập 7 ngày liên tiếp',
      descriptionEn: 'Keep your learning streak alive for 7 days straight',
      current: Math.min(7, longestStreak),
      target: 7,
    },
  ];

  const achievements: AchievementBadge[] = raw.map((item) => ({
    ...item,
    unlocked: item.current >= item.target,
  }));

  return {
    achievements,
    unlockedCount: achievements.filter((a) => a.unlocked).length,
    totalCount: achievements.length,
    totalLessons,
    totalStories,
    totalWords,
    masteredWords,
    longestStreak,
  };
}



'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  Clock,
  Compass,
  Crown,
  Flame,
  Globe,
  GraduationCap,
  Headphones,
  Infinity as InfinityIcon,
  Layers,
  LayoutGrid,
  ListChecks,
  Lock,
  Medal,
  Play,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trophy,
  UserPlus,
  Volume2,
} from 'lucide-react';
import type {
  AccountType,
  AgeGroupConfig,
  AuthUserProfile,
  LearnerProfile,
  LearningPackageSummary,
  LessonProgressRecord,
  LocaleConfig,
} from '../../../packages/contracts/types';
import type { UiMessages } from '../../i18n/messages';
import { apiClient } from '../../shared/apiClient';
import { listAllFirestoreProgress } from '../../shared/firestoreService';
import { speakText } from '../../audio/speechPlayer';
import { LearningTipOfTheDay } from '../../components/LearningTipOfTheDay';
import {
  computeGoalStreak,
  computeLast7Days,
  computeLearnerAchievements,
  getMasteredWordsList,
  getTodayDateKey,
  getTrickyWordsForReview,
  loadLearnerRewards,
  type AchievementBadge,
  type AchievementIconKey,
} from '../../lib/learnerRewards';

export type WorkspaceDestination =
  | 'home'
  | 'learn'
  | 'stories'
  | 'audiobooks'
  | 'parents';

interface FamilyHomeDashboardProps {
  parentUser: AuthUserProfile;
  accountType?: AccountType;
  learners: LearnerProfile[];
  activeLearner: LearnerProfile;
  ageGroups: AgeGroupConfig[];
  languages: LocaleConfig[];
  packages: LearningPackageSummary[];
  activeLearnerProgress: LessonProgressRecord[];
  dailyUsedMinutesMap: Record<string, number>;
  storyUsedMinutesMap: Record<string, number>;
  interfaceLocale: string;
  quickInterfaceLocales: Array<{
    locale: string;
    nativeName: string;
    displayName: string;
  }>;
  messages: UiMessages;
  reducedMotion: boolean;
  onSelectLearner: (learnerId: string) => void;
  onNavigateTab: (tab: WorkspaceDestination) => void;
  onChangeInterfaceLocale: (locale: string) => void;
  onOpenStickerBook: () => void;
  onOpenWordReview: () => void;
}

interface LearnerRank {
  level: number;
  titleVi: string;
  titleEn: string;
  nextTitleVi: string | null;
  nextTitleEn: string | null;
  minBadges: number;
  nextMinBadges: number | null;
  toneClass: string;
}

function computeLearnerRank(
  unlockedBadges: number,
  totalLessons: number,
  totalStories: number
): LearnerRank {
  const score = unlockedBadges * 2 + totalLessons + totalStories;
  if (unlockedBadges >= 7 || score >= 26) {
    return {
      level: 5,
      titleVi: 'Bậc Thầy Ngôn Ngữ',
      titleEn: 'Language Master',
      nextTitleVi: null,
      nextTitleEn: null,
      minBadges: 7,
      nextMinBadges: null,
      toneClass: 'text-amber-600 dark:text-amber-400',
    };
  }
  if (unlockedBadges >= 5 || score >= 16) {
    return {
      level: 4,
      titleVi: 'Học Giả Song Ngữ',
      titleEn: 'Bilingual Scholar',
      nextTitleVi: 'Bậc Thầy Ngôn Ngữ',
      nextTitleEn: 'Language Master',
      minBadges: 5,
      nextMinBadges: 7,
      toneClass: 'text-violet-600 dark:text-violet-400',
    };
  }
  if (unlockedBadges >= 3 || score >= 8) {
    return {
      level: 3,
      titleVi: 'Ngôi Sao Chăm Chỉ',
      titleEn: 'Steady Study Star',
      nextTitleVi: 'Học Giả Song Ngữ',
      nextTitleEn: 'Bilingual Scholar',
      minBadges: 3,
      nextMinBadges: 5,
      toneClass: 'text-emerald-600 dark:text-emerald-400',
    };
  }
  if (unlockedBadges >= 1 || score >= 2) {
    return {
      level: 2,
      titleVi: 'Nhà Thám Hiểm Nhí',
      titleEn: 'Young Explorer',
      nextTitleVi: 'Ngôi Sao Chăm Chỉ',
      nextTitleEn: 'Steady Study Star',
      minBadges: 1,
      nextMinBadges: 3,
      toneClass: 'text-sky-600 dark:text-sky-400',
    };
  }
  return {
    level: 1,
    titleVi: 'Người Mở Đường',
    titleEn: 'Bright Beginner',
    nextTitleVi: 'Nhà Thám Hiểm Nhí',
    nextTitleEn: 'Young Explorer',
    minBadges: 0,
    nextMinBadges: 1,
    toneClass: 'text-slate-700 dark:text-slate-300',
  };
}

const AVATAR_MONOGRAM_STYLES: Record<LearnerProfile['avatarTone'], string> = {
  sky: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/80',
  amber:
    'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/80',
  emerald:
    'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80',
  rose: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/80',
};

function renderBadgeIcon(icon: AchievementIconKey, className = 'w-4 h-4') {
  switch (icon) {
    case 'starter':
      return <Sparkles className={className} aria-hidden="true" />;
    case 'streak3':
    case 'streak7':
      return <Flame className={className} aria-hidden="true" />;
    case 'bookworm':
      return <BookOpen className={className} aria-hidden="true" />;
    case 'wordMaster':
      return <Brain className={className} aria-hidden="true" />;
    case 'vocab30':
      return <Compass className={className} aria-hidden="true" />;
    case 'collector':
      return <Award className={className} aria-hidden="true" />;
    case 'lessons5':
      return <Star className={className} aria-hidden="true" />;
    default:
      return <Trophy className={className} aria-hidden="true" />;
  }
}

function getBadgeToneClasses(
  tone: AchievementBadge['tone'],
  unlocked: boolean
): string {
  if (!unlocked) {
    return 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500';
  }
  switch (tone) {
    case 'orange':
      return 'bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400';
    case 'amber':
      return 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400';
    case 'emerald':
      return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400';
    case 'violet':
      return 'bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400';
    case 'rose':
      return 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400';
    case 'sky':
    default:
      return 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400';
  }
}

export function FamilyHomeDashboard({
  parentUser,
  accountType = 'parent',
  learners,
  activeLearner,
  ageGroups,
  languages,
  packages,
  activeLearnerProgress,
  dailyUsedMinutesMap,
  storyUsedMinutesMap,
  interfaceLocale,
  quickInterfaceLocales,
  messages,
  reducedMotion,
  onSelectLearner,
  onNavigateTab,
  onChangeInterfaceLocale,
  onOpenStickerBook,
  onOpenWordReview,
}: FamilyHomeDashboardProps) {
  const isVi = interfaceLocale === 'vi';
  const isStudentAccount = accountType === 'student';
  const [viewMode, setViewMode] = useState<'overview' | 'detail'>('overview');
  const [progressByLearner, setProgressByLearner] = useState<
    Record<string, LessonProgressRecord[]>
  >(() => ({ [activeLearner.id]: activeLearnerProgress }));

  // Sync active learner progress from parent prop
  useEffect(() => {
    setProgressByLearner((prev) => ({
      ...prev,
      [activeLearner.id]: activeLearnerProgress,
    }));
  }, [activeLearner.id, activeLearnerProgress]);

  // Fetch cloud progress for all profiles in the account
  const learnerIdsKey = learners.map((l) => l.id).join(',');
  useEffect(() => {
    let cancelled = false;
    if (learners.length === 0) return;
    if (parentUser.provider === 'firebase' && parentUser.emailVerified !== false) {
      void listAllFirestoreProgress(parentUser.id)
        .then((allRecords) => {
          if (cancelled) return;
          const grouped: Record<string, LessonProgressRecord[]> = {};
          for (const child of learners) {
            grouped[child.id] = [];
          }
          for (const rec of allRecords) {
            if (!grouped[rec.learnerId]) grouped[rec.learnerId] = [];
            grouped[rec.learnerId].push(rec);
          }
          setProgressByLearner((prev) => ({ ...prev, ...grouped }));
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }
    void Promise.all(
      learners.map(async (child) => {
        try {
          const res = await apiClient.getProgress(child.id);
          return [child.id, res.progress] as const;
        } catch {
          return [child.id, [] as LessonProgressRecord[]] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setProgressByLearner((prev) => {
        const next = { ...prev };
        for (const [id, records] of entries) {
          next[id] = records;
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learnerIdsKey, parentUser.id, parentUser.provider, parentUser.emailVerified]);

  const getLocaleName = (code: string) => {
    const match = languages.find((l) => l.locale === code);
    return match ? match.nativeName : code.toUpperCase();
  };

  const getAgeGroupLabel = (learner: LearnerProfile) => {
    const match =
      ageGroups.find((g) => g.id === learner.ageBand) ??
      ageGroups.find(
        (g) => learner.ageYears >= g.minAge && learner.ageYears <= g.maxAge
      );
    if (match) {
      return isVi ? match.shortLabels.vi : match.shortLabels.en;
    }
    if (learner.gradeLevel && learner.gradeLevel > 0) {
      return isVi ? `Lớp ${learner.gradeLevel}` : `Grade ${learner.gradeLevel}`;
    }
    return isVi ? `${learner.ageYears} tuổi` : `Age ${learner.ageYears}`;
  };

  const todayFormatted = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(isVi ? 'vi-VN' : 'en-US', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
      }).format(new Date());
    } catch {
      return getTodayDateKey();
    }
  }, [isVi]);

  // Compute rich, real per-child analytics
  const learnerSnapshots = useMemo(() => {
    const todayKey = getTodayDateKey();
    return learners.map((child) => {
      const records = progressByLearner[child.id] ?? [];
      const rewards = loadLearnerRewards(child.id);
      const achievements = computeLearnerAchievements(child.id);
      const streak = computeGoalStreak(child.id);
      const last7 = computeLast7Days(
        child.id,
        records.map((r) => r.updatedAt)
      );
      const trickyWords = getTrickyWordsForReview(child.id);
      const masteredWords = getMasteredWordsList(child.id);
      const completedRecords = records.filter((r) => r.completed);
      const totalLessons = Math.max(
        achievements.totalLessons,
        completedRecords.length
      );
      const totalStories = achievements.totalStories;
      const effectiveStreak = Math.max(streak.currentStreak, last7.streakDays);
      const longestStreak = Math.max(streak.longestStreak, effectiveStreak);
      const rank = computeLearnerRank(
        achievements.unlockedCount,
        totalLessons,
        totalStories
      );
      const learnLimit = child.preferences.dailyMinutesLimit ?? 15;
      const storyLimit = child.preferences.storyDailyMinutesLimit ?? 15;
      const learnUsed = dailyUsedMinutesMap[child.id] ?? 0;
      const storyUsed = storyUsedMinutesMap[child.id] ?? 0;
      const todayLog = rewards.dailyLog[todayKey];
      const activeToday =
        learnUsed > 0 ||
        storyUsed > 0 ||
        (todayLog?.lessonsCompleted ?? 0) > 0 ||
        (todayLog?.storiesRead ?? 0) > 0;

      return {
        learner: child,
        records,
        rewards,
        achievements,
        streak,
        last7,
        trickyWords,
        masteredWords,
        totalLessons,
        totalStories,
        effectiveStreak,
        longestStreak,
        rank,
        learnLimit,
        storyLimit,
        learnUsed,
        storyUsed,
        activeToday,
      };
    });
  }, [learners, progressByLearner, dailyUsedMinutesMap, storyUsedMinutesMap]);

  // Aggregate family KPIs
  const familyTotals = useMemo(() => {
    const totalLessons = learnerSnapshots.reduce(
      (sum, s) => sum + s.totalLessons,
      0
    );
    const totalStories = learnerSnapshots.reduce(
      (sum, s) => sum + s.totalStories,
      0
    );
    const totalWords = learnerSnapshots.reduce(
      (sum, s) => sum + s.achievements.totalWords,
      0
    );
    const totalUnlockedBadges = learnerSnapshots.reduce(
      (sum, s) => sum + s.achievements.unlockedCount,
      0
    );
    const totalPossibleBadges = learnerSnapshots.reduce(
      (sum, s) => sum + s.achievements.totalCount,
      0
    );
    const totalStickers = learnerSnapshots.reduce(
      (sum, s) => sum + s.rewards.unlockedStickerIds.length,
      0
    );
    const bestStreak = learnerSnapshots.reduce(
      (max, s) => Math.max(max, s.effectiveStreak),
      0
    );
    const activeChildrenToday = learnerSnapshots.filter(
      (s) => s.activeToday
    ).length;

    return {
      totalLessons,
      totalStories,
      totalWords,
      totalUnlockedBadges,
      totalPossibleBadges,
      totalStickers,
      bestStreak,
      activeChildrenToday,
    };
  }, [learnerSnapshots]);

  const activeSnapshot =
    learnerSnapshots.find((s) => s.learner.id === activeLearner.id) ??
    learnerSnapshots[0];

  const parentGreetingName =
    parentUser.displayName?.trim() ||
    parentUser.email?.split('@')[0] ||
    (isVi ? 'Phụ huynh' : 'Parent');

  const openLearnerAndGo = (
    learnerId: string,
    destination: WorkspaceDestination
  ) => {
    onSelectLearner(learnerId);
    onNavigateTab(destination);
  };

  const openLearnerDetail = (learnerId: string) => {
    onSelectLearner(learnerId);
    setViewMode('detail');
  };

  const resolvePackageTitle = (lessonId: string) => {
    const matched = packages.find(
      (p) =>
        p.id === lessonId ||
        lessonId.includes(p.id) ||
        lessonId.includes(p.topicId.replace('topic.', ''))
    );
    if (matched) {
      return (
        matched.titles[interfaceLocale] ||
        matched.titles.vi ||
        matched.titles.en ||
        lessonId
      );
    }
    return lessonId;
  };

  const maxDetailDayScore = activeSnapshot
    ? Math.max(
        1,
        ...activeSnapshot.last7.days.map(
          (d) => d.lessons * 3 + d.stories * 3 + d.words
        )
      )
    : 1;

  return (
    <div className="space-y-8">
      {/* Executive Header: Greeting + Unboxed Metadata + Segmented View Switcher */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
            <span className="capitalize">{todayFormatted}</span>
            <span aria-hidden="true">·</span>
            <span>
              {isStudentAccount
                ? getAgeGroupLabel(activeLearner)
                : `${learners.length} ${isVi ? 'hồ sơ bé đang theo dõi' : 'learner profiles'}`}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {isStudentAccount
                ? isVi
                  ? 'Tài khoản tự học độc lập'
                  : 'Independent self-study'
                : isVi
                  ? 'Đang chọn:'
                  : 'Active:'}{' '}
              {!isStudentAccount && (
                <strong className="text-slate-800 dark:text-slate-100">
                  {activeLearner.nickname}
                </strong>
              )}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-tight">
            {isStudentAccount
              ? isVi
                ? `Xin chào, ${activeLearner.nickname}`
                : `Welcome back, ${activeLearner.nickname}`
              : isVi
                ? `Bảng điều khiển học tập, ${parentGreetingName}`
                : `Family learning overview, ${parentGreetingName}`}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
            {isStudentAccount
              ? isVi
                ? 'Theo dõi chuỗi ngày tự học, từ vựng cần ôn, mục tiêu mỗi ngày và kho sách nói học thuật không giới hạn.'
                : 'Track your self-study streak, vocabulary review, daily goals, and unlimited audiobooks.'
              : isVi
                ? 'Theo dõi tiến độ học bài, danh hiệu đạt được, và quản lý khung giờ học bài – truyện kể độc lập với thư viện sách nói không giới hạn.'
                : 'Track lesson milestones, earned titles, and separate daily time limits for lessons and picture stories alongside unlimited audiobooks.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Segmented View Toggle: Tổng hợp vs Chi tiết */}
          <div
            role="tablist"
            aria-label={isVi ? 'Chế độ hiển thị trang chủ' : 'Dashboard view mode'}
            className="inline-flex items-center p-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900 gap-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'overview'}
              onClick={() => setViewMode('overview')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'overview'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isVi ? 'Tổng hợp gia đình' : 'Family Summary'}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'detail'}
              onClick={() => setViewMode('detail')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'detail'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isVi ? 'Chi tiết từng bé' : 'Child Details'}</span>
            </button>
          </div>

          {/* Quick Language Switcher */}
          <div className="relative inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <Globe
              className="w-3.5 h-3.5 text-accent ml-3 shrink-0 pointer-events-none"
              aria-hidden="true"
            />
            <select
              aria-label={isVi ? 'Ngôn ngữ giao diện' : 'Interface language'}
              value={interfaceLocale}
              onChange={(e) => onChangeInterfaceLocale(e.target.value)}
              className="appearance-none bg-transparent pl-1.5 pr-8 py-2 min-h-[38px] text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              {quickInterfaceLocales.map((loc) => (
                <option
                  key={loc.locale}
                  value={loc.locale}
                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  {loc.nativeName}
                </option>
              ))}
            </select>
            <ChevronDown
              className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none"
              aria-hidden="true"
            />
          </div>
        </div>
      </section>

      {/* Top 4-Column Family KPI Strip — Clean Single Surface, Hairline Dividers, Tabular Numerals */}
      <section
        aria-label={isVi ? 'Chỉ số học tập tổng hợp' : 'Family learning metrics'}
        className="surface-card rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 dark:divide-slate-800"
      >
        <div className="p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isVi ? 'Bài học & truyện đã hoàn thành' : 'Completed lessons & stories'}
          </p>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-50 tabular-nums">
            {familyTotals.totalLessons + familyTotals.totalStories}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {familyTotals.totalLessons} {isVi ? 'bài học' : 'lessons'} ·{' '}
            {familyTotals.totalStories} {isVi ? 'truyện' : 'stories'} ·{' '}
            {familyTotals.totalWords} {isVi ? 'lượt từ' : 'words'}
          </p>
        </div>

        <div className="p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isVi ? 'Chuỗi ngày học liên tiếp' : 'Active learning streak'}
          </p>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-50 tabular-nums">
            {familyTotals.bestStreak}{' '}
            <span className="text-base font-semibold text-slate-500 dark:text-slate-400">
              {isVi ? 'ngày' : 'days'}
            </span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {familyTotals.activeChildrenToday}/{learners.length}{' '}
            {isVi ? 'bé đã tương tác hôm nay' : 'learners active today'}
          </p>
        </div>

        <div className="p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isVi ? 'Danh hiệu & Huy hiệu gia đình' : 'Titles & earned badges'}
          </p>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-50 tabular-nums">
            {familyTotals.totalUnlockedBadges}
            <span className="text-base font-medium text-slate-400 dark:text-slate-500">
              /{familyTotals.totalPossibleBadges}
            </span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {familyTotals.totalStickers}{' '}
            {isVi ? 'sticker đã mở khóa' : 'stickers unlocked'}
          </p>
        </div>

        <div className="p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isVi
              ? `Thời lượng hôm nay · ${activeLearner.nickname}`
              : `Today's timers · ${activeLearner.nickname}`}
          </p>
          <div className="flex items-baseline gap-3 tabular-nums">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-50">
              {activeSnapshot?.learnUsed ?? 0}/{activeSnapshot?.learnLimit ?? 15}
              <span className="text-xs font-medium text-slate-500 ml-0.5">
                {messages.parent.minutesUnit}
              </span>
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">
              {activeSnapshot?.storyUsed ?? 0}/{activeSnapshot?.storyLimit ?? 15}
              <span className="text-xs font-medium text-slate-500 ml-0.5">
                {messages.parent.minutesUnit}
              </span>
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isVi
              ? 'Học bài · Truyện kể · Sách nói không giới hạn'
              : 'Lessons · Stories · Audiobooks unlimited'}
          </p>
        </div>
      </section>

      {viewMode === 'overview' ? (
        <motion.div
          key="overview"
          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="space-y-8"
        >
          {/* All Children Learning & Achievements Matrix */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                  {isVi
                    ? 'Hồ sơ học tập & Danh hiệu của các con'
                    : 'Children progress & earned titles'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {isVi
                    ? 'Chọn nhanh một bé để vào học, đọc truyện hẹn giờ, nghe sách nói hoặc xem báo cáo chi tiết.'
                    : 'Select any child to jump into lessons, timed stories, unlimited audiobooks, or full reports.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('parents')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {isStudentAccount
                    ? isVi
                      ? 'Cài đặt tự học & Mã phụ huynh'
                      : 'Self-study settings & Parent link'
                    : isVi
                      ? 'Quản lý hồ sơ & khung giờ'
                      : 'Manage profiles & limits'}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {learnerSnapshots.map((snap) => {
                const isSelected = snap.learner.id === activeLearner.id;
                const learnPct = Math.min(
                  100,
                  Math.round(
                    (snap.learnUsed / Math.max(1, snap.learnLimit)) * 100
                  )
                );
                const storyPct = Math.min(
                  100,
                  Math.round(
                    (snap.storyUsed / Math.max(1, snap.storyLimit)) * 100
                  )
                );
                const unlockedBadges = snap.achievements.achievements.filter(
                  (b) => b.unlocked
                );

                return (
                  <article
                    key={snap.learner.id}
                    className={`surface-card rounded-2xl p-6 flex flex-col justify-between gap-5 transition-colors ${
                      isSelected
                        ? 'ring-1 ring-inset border-accent'
                        : 'hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Child Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-lg font-bold shrink-0 ${
                            AVATAR_MONOGRAM_STYLES[snap.learner.avatarTone]
                          }`}
                        >
                          {snap.learner.nickname.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 truncate">
                              {snap.learner.nickname}
                            </h3>
                            {isSelected && (
                              <span className="text-[11px] font-semibold text-accent whitespace-nowrap">
                                · {isVi ? 'Đang chọn' : 'Active'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {getAgeGroupLabel(snap.learner)} ·{' '}
                            {isVi ? 'Đang học' : 'Learning'}{' '}
                            {getLocaleName(
                              snap.learner.preferences.learningLocale
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 space-y-0.5">
                        <p
                          className={`text-xs font-bold inline-flex items-center gap-1 ${snap.rank.toneClass}`}
                        >
                          <Crown className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>
                            {isVi ? snap.rank.titleVi : snap.rank.titleEn}
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {isVi ? `Cấp ${snap.rank.level}/5` : `Rank ${snap.rank.level}/5`} ·{' '}
                          {snap.effectiveStreak}{' '}
                          {isVi ? 'ngày liên tiếp' : 'day streak'}
                        </p>
                      </div>
                    </div>

                    {/* Metrics & 7-Day Cadence Row */}
                    <div className="grid grid-cols-3 gap-3 py-3.5 border-y border-slate-100 dark:border-slate-800/80 tabular-nums">
                      <div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isVi ? 'Bài học' : 'Lessons'}
                        </p>
                        <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          {snap.totalLessons}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isVi ? 'Truyện đã đọc' : 'Stories'}
                        </p>
                        <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          {snap.totalStories}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isVi ? 'Huy hiệu' : 'Badges'}
                        </p>
                        <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          {snap.achievements.unlockedCount}/
                          {snap.achievements.totalCount}
                        </p>
                      </div>
                    </div>

                    {/* Dual Daily Timers (Learn vs Picture Stories) */}
                    <div className="space-y-2.5 text-xs tabular-nums">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                          <span className="font-medium">
                            {isVi ? 'Học bài hôm nay' : 'Lessons today'}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {snap.learnUsed}/{snap.learnLimit}{' '}
                            {messages.parent.minutesUnit}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-sky-600 dark:bg-sky-400 transition-all"
                            style={{ width: `${learnPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                          <span className="font-medium">
                            {isVi ? 'Truyện kể hôm nay' : 'Picture stories today'}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {snap.storyUsed}/{snap.storyLimit}{' '}
                            {messages.parent.minutesUnit}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-600 dark:bg-indigo-400 transition-all"
                            style={{ width: `${storyPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 7-day strip + unlocked badges line */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-1">
                        {snap.last7.days.map((day) => (
                          <div
                            key={day.dateKey}
                            title={`${day.dateKey}: ${day.lessons} ${isVi ? 'bài' : 'lessons'}, ${day.stories} ${isVi ? 'truyện' : 'stories'}`}
                            className={`w-6 h-6 rounded-md text-[10px] font-semibold flex items-center justify-center tabular-nums ${
                              day.active
                                ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {day.shortDay}
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        {unlockedBadges.slice(0, 4).map((b) => (
                          <span
                            key={b.id}
                            title={isVi ? b.titleVi : b.titleEn}
                            className={`w-6 h-6 rounded-lg inline-flex items-center justify-center ${getBadgeToneClasses(
                              b.tone,
                              true
                            )}`}
                          >
                            {renderBadgeIcon(b.icon, 'w-3.5 h-3.5')}
                          </span>
                        ))}
                        {unlockedBadges.length === 0 && (
                          <span className="text-[11px]">
                            {isVi
                              ? 'Sẵn sàng mở huy hiệu đầu tiên'
                              : 'Ready for first badge'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openLearnerAndGo(snap.learner.id, 'learn')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl btn-accent text-xs font-semibold whitespace-nowrap cursor-pointer"
                        >
                          <Play className="w-3 h-3" aria-hidden="true" />
                          <span>{isVi ? 'Vào học' : 'Learn'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openLearnerAndGo(snap.learner.id, 'stories')
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{isVi ? 'Truyện kể' : 'Stories'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openLearnerAndGo(snap.learner.id, 'audiobooks')
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40 whitespace-nowrap cursor-pointer"
                        >
                          <Headphones className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{isVi ? 'Sách nói' : 'Audiobooks'}</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => openLearnerDetail(snap.learner.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline whitespace-nowrap cursor-pointer py-1.5"
                      >
                        <span>{isVi ? 'Xem chi tiết' : 'Full report'}</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* 3 Experience Pillars: Clear Separation of Timed Lessons, Timed Picture Stories, and Unlimited Audiobooks */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
              {isVi
                ? `Không gian trải nghiệm của ${activeLearner.nickname}`
                : `${activeLearner.nickname}'s learning spaces`}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <button
                type="button"
                onClick={() => onNavigateTab('learn')}
                className="group surface-card rounded-2xl p-6 text-left flex flex-col justify-between gap-4 hover:border-accent transition-colors cursor-pointer"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <span className="font-semibold text-sky-700 dark:text-sky-400 inline-flex items-center gap-1.5">
                      <Layers className="w-4 h-4" aria-hidden="true" />
                      <span>{isVi ? 'Hẹn giờ riêng' : 'Timed lessons'}</span>
                    </span>
                    <span>
                      {activeSnapshot?.learnUsed ?? 0}/
                      {activeSnapshot?.learnLimit ?? 15}{' '}
                      {messages.parent.minutesUnit}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                    {isVi ? 'Học bài theo lộ trình' : 'Guided lessons'}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {isVi
                      ? 'Thẻ từ vựng, nghe chọn, luyện đọc theo và ghép cặp phù hợp chính xác lứa tuổi.'
                      : 'Flashcards, listening, repeat-after-me, and matching tailored to age.'}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent group-hover:translate-x-0.5 transition-transform">
                  <span>{isVi ? 'Mở bài học ngay' : 'Open lessons'}</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('stories')}
                className="group surface-card rounded-2xl p-6 text-left flex flex-col justify-between gap-4 hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors cursor-pointer"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <span className="font-semibold text-indigo-700 dark:text-indigo-400 inline-flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4" aria-hidden="true" />
                      <span>{isVi ? 'Hẹn giờ riêng' : 'Timed stories'}</span>
                    </span>
                    <span>
                      {activeSnapshot?.storyUsed ?? 0}/
                      {activeSnapshot?.storyLimit ?? 15}{' '}
                      {messages.parent.minutesUnit}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                    {isVi ? 'Truyện kể tranh song ngữ' : 'Picture stories'}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {isVi
                      ? 'Truyện ngắn minh họa có chạm tra từ vựng và phụ đề song ngữ, giới hạn thời lượng riêng.'
                      : 'Short illustrated stories with tap-to-learn vocabulary and independent daily limit.'}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                  <span>{isVi ? 'Đọc truyện tranh' : 'Open picture stories'}</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('audiobooks')}
                className="group surface-card rounded-2xl p-6 text-left flex flex-col justify-between gap-4 hover:border-emerald-500 dark:hover:border-emerald-400 transition-colors cursor-pointer"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1.5">
                      <Headphones className="w-4 h-4" aria-hidden="true" />
                      <span>{isVi ? 'Sách nói' : 'Audiobooks'}</span>
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                      <InfinityIcon className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{isVi ? 'Không giới hạn' : 'Unlimited'}</span>
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                    {isVi ? 'Sách nói & Truyện dài' : 'Audiobooks & Long Stories'}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {isVi
                      ? 'Nghe tự do nhiều chương MP3 giọng người thật và cổ tích dài tiếng Việt, có hẹn giờ tắt đi ngủ.'
                      : 'Unlimited multi-chapter MP3 audiobooks and long tales with chapter index & sleep timer.'}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                  <span>{isVi ? 'Mở kho sách nói' : 'Open audiobooks'}</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
              </button>
            </div>
          </section>

          {/* Learning Tip of the Day */}
          <LearningTipOfTheDay
            learnerId={activeLearner.id}
            learnerName={activeLearner.nickname}
            interfaceLocale={interfaceLocale}
            reducedMotion={reducedMotion}
          />
        </motion.div>
      ) : (
        /* Detailed Single-Child Analytics & Achievements View */
        activeSnapshot && (
          <motion.div
            key={`detail-${activeSnapshot.learner.id}`}
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="space-y-8"
          >
            {/* Child Selector Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {learnerSnapshots.map((snap) => {
                  const selected = snap.learner.id === activeSnapshot.learner.id;
                  return (
                    <button
                      key={snap.learner.id}
                      type="button"
                      onClick={() => onSelectLearner(snap.learner.id)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        selected
                          ? 'border-accent bg-accent-soft'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{snap.learner.nickname}</span>
                      <span className="opacity-70 tabular-nums">
                        · {getAgeGroupLabel(snap.learner)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenStickerBook}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                  <span className="tabular-nums">
                    {isVi ? 'Sổ Sticker' : 'Sticker Book'} (
                    {activeSnapshot.rewards.unlockedStickerIds.length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onOpenWordReview}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Brain className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                  <span className="tabular-nums">
                    {isVi ? 'Ôn từ khó' : 'Review words'} (
                    {activeSnapshot.trickyWords.length})
                  </span>
                </button>
              </div>
            </div>

            {/* Detailed Child Rank & Achievement Summary Card */}
            <section className="surface-card rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div
                  className={`w-16 h-16 rounded-2xl border flex items-center justify-center text-2xl font-bold shrink-0 ${
                    AVATAR_MONOGRAM_STYLES[activeSnapshot.learner.avatarTone]
                  }`}
                >
                  {activeSnapshot.learner.nickname.slice(0, 1).toUpperCase()}
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span
                      className={`font-bold inline-flex items-center gap-1 ${activeSnapshot.rank.toneClass}`}
                    >
                      <Medal className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {isVi
                          ? activeSnapshot.rank.titleVi
                          : activeSnapshot.rank.titleEn}
                      </span>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{getAgeGroupLabel(activeSnapshot.learner)}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {isVi ? 'Ngôn ngữ học:' : 'Learning:'}{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {getLocaleName(
                          activeSnapshot.learner.preferences.learningLocale
                        )}
                      </strong>
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                    {activeSnapshot.learner.nickname}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                    {activeSnapshot.rank.nextTitleVi &&
                    activeSnapshot.rank.nextMinBadges !== null
                      ? isVi
                        ? `Đạt ${activeSnapshot.achievements.unlockedCount}/${activeSnapshot.rank.nextMinBadges} huy hiệu để thăng danh hiệu “${activeSnapshot.rank.nextTitleVi}”.`
                        : `${activeSnapshot.achievements.unlockedCount}/${activeSnapshot.rank.nextMinBadges} badges toward “${activeSnapshot.rank.nextTitleEn}”.`
                      : isVi
                        ? 'Bé đã đạt danh hiệu cao nhất trên TM-Lingo!'
                        : 'Highest rank achieved on TM-Lingo!'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 lg:border-l lg:border-slate-200/80 dark:lg:border-slate-800 lg:pl-6 tabular-nums">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isVi ? 'Chuỗi hiện tại' : 'Current streak'}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                    {activeSnapshot.effectiveStreak}{' '}
                    <span className="text-xs font-medium text-slate-500">
                      {isVi ? 'ngày' : 'd'}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isVi ? 'Kỷ lục dài nhất' : 'Best streak'}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                    {activeSnapshot.longestStreak}{' '}
                    <span className="text-xs font-medium text-slate-500">
                      {isVi ? 'ngày' : 'd'}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isVi ? 'Từ khó đã thuộc' : 'Mastered words'}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                    {activeSnapshot.masteredWords.length}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('learn')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-xl btn-accent text-xs font-semibold whitespace-nowrap cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isVi ? 'Vào học ngay' : 'Start lesson'}</span>
                </button>
              </div>
            </section>

            {/* Two-Column Analytics: 7-Day Activity Chart + Separate Time Budgets */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <section className="lg:col-span-7 surface-card rounded-2xl p-6 flex flex-col justify-between gap-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {isVi
                        ? 'Biểu đồ học tập 7 ngày gần nhất'
                        : '7-day learning activity'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {activeSnapshot.last7.activeDaysCount}/7{' '}
                      {isVi ? 'ngày có hoạt động' : 'active days'} ·{' '}
                      {activeSnapshot.last7.totalWords7d}{' '}
                      {isVi ? 'lượt luyện từ vựng' : 'vocabulary practices'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2.5 items-end h-40 pt-4">
                  {activeSnapshot.last7.days.map((day) => {
                    const score = day.lessons * 3 + day.stories * 3 + day.words;
                    const heightPct =
                      score === 0
                        ? 8
                        : Math.max(
                            18,
                            Math.round((score / maxDetailDayScore) * 100)
                          );
                    return (
                      <div
                        key={day.dateKey}
                        className="flex flex-col items-center gap-2 h-full justify-end"
                      >
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                          {day.lessons + day.stories > 0
                            ? day.lessons + day.stories
                            : '·'}
                        </span>
                        <div className="w-full flex-1 flex items-end justify-center">
                          <div
                            title={`${day.dateKey}: ${day.lessons} ${isVi ? 'bài học' : 'lessons'}, ${day.stories} ${isVi ? 'truyện' : 'stories'}, ${day.words} ${isVi ? 'từ' : 'words'}`}
                            className={`w-full max-w-[34px] rounded-t-lg transition-all ${
                              day.active
                                ? 'bg-sky-600 dark:bg-sky-400'
                                : 'bg-slate-100 dark:bg-slate-800'
                            }`}
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {day.shortDay}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="lg:col-span-5 surface-card rounded-2xl p-6 flex flex-col justify-between gap-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {isVi
                        ? 'Khung giờ học mỗi ngày'
                        : 'Daily time budgets'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isVi
                        ? 'Cấu hình thời lượng riêng cho Học bài và Truyện kể'
                        : 'Independent limits for lessons and picture stories'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('parents')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline whitespace-nowrap cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{isVi ? 'Điều chỉnh' : 'Adjust'}</span>
                  </button>
                </div>

                <div className="space-y-4 tabular-nums">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                        <span>{isVi ? 'Học bài tương tác' : 'Interactive lessons'}</span>
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {activeSnapshot.learnUsed}/{activeSnapshot.learnLimit}{' '}
                        {messages.parent.minutesUnit}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-sky-600 dark:bg-sky-400"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (activeSnapshot.learnUsed /
                                Math.max(1, activeSnapshot.learnLimit)) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                        <span>{isVi ? 'Truyện kể tranh' : 'Picture stories'}</span>
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {activeSnapshot.storyUsed}/{activeSnapshot.storyLimit}{' '}
                        {messages.parent.minutesUnit}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-600 dark:bg-indigo-400"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (activeSnapshot.storyUsed /
                                Math.max(1, activeSnapshot.storyLimit)) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5">
                      <Headphones className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                      <span>{isVi ? 'Sách nói & Truyện dài' : 'Audiobooks'}</span>
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                      <InfinityIcon className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{isVi ? 'Không giới hạn' : 'Unlimited'}</span>
                    </span>
                  </div>
                </div>
              </section>
            </div>

            {/* Full Achievements & Titles Showcase */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                    {isVi
                      ? `Tủ Danh hiệu & Huy hiệu của ${activeSnapshot.learner.nickname}`
                      : `${activeSnapshot.learner.nickname}'s Achievements & Badges`}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {isVi
                      ? `Đã mở khóa ${activeSnapshot.achievements.unlockedCount}/${activeSnapshot.achievements.totalCount} danh hiệu học tập`
                      : `${activeSnapshot.achievements.unlockedCount}/${activeSnapshot.achievements.totalCount} learning badges unlocked`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {activeSnapshot.achievements.achievements.map((badge) => {
                  const pct = Math.min(
                    100,
                    Math.round((badge.current / Math.max(1, badge.target)) * 100)
                  );
                  return (
                    <div
                      key={badge.id}
                      className={`surface-card rounded-2xl p-4 flex flex-col justify-between gap-3 ${
                        badge.unlocked ? '' : 'opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${getBadgeToneClasses(
                            badge.tone,
                            badge.unlocked
                          )}`}
                        >
                          {renderBadgeIcon(badge.icon, 'w-4 h-4')}
                        </div>
                        <span
                          className={`text-[11px] font-semibold inline-flex items-center gap-1 ${
                            badge.unlocked
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {badge.unlocked ? (
                            <>
                              <Check className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>{isVi ? 'Đã đạt' : 'Unlocked'}</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" aria-hidden="true" />
                              <span className="tabular-nums">
                                {badge.current}/{badge.target}
                              </span>
                            </>
                          )}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {isVi ? badge.titleVi : badge.titleEn}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          {isVi ? badge.descriptionVi : badge.descriptionEn}
                        </p>
                      </div>

                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            badge.unlocked
                              ? 'bg-emerald-600 dark:bg-emerald-400'
                              : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Detailed Lesson Progress Table + Tricky Words Review */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <section className="lg:col-span-8 surface-card rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {isVi
                      ? 'Chi tiết tiến độ bài học đã lưu'
                      : 'Saved lesson progress history'}
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {activeSnapshot.records.length}{' '}
                    {isVi ? 'bản ghi' : 'records'}
                  </span>
                </div>

                {activeSnapshot.records.length === 0 ? (
                  <div className="p-8 text-center space-y-3">
                    <GraduationCap
                      className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {isVi
                        ? `${activeSnapshot.learner.nickname} chưa có lịch sử bài học nào. Bắt đầu gói bài học đầu tiên ngay nhé.`
                        : `No lesson records saved yet for ${activeSnapshot.learner.nickname}.`}
                    </p>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('learn')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl btn-accent text-xs font-semibold cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{isVi ? 'Bắt đầu bài học đầu tiên' : 'Start first lesson'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                          <th className="py-3 px-6 font-semibold">
                            {isVi ? 'Bài học' : 'Lesson'}
                          </th>
                          <th className="py-3 px-4 font-semibold">
                            {isVi ? 'Chế độ' : 'Mode'}
                          </th>
                          <th className="py-3 px-4 font-semibold text-right">
                            {isVi ? 'Hoàn thành' : 'Completion'}
                          </th>
                          <th className="py-3 px-6 font-semibold text-right">
                            {isVi ? 'Trạng thái' : 'Status'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {activeSnapshot.records.slice(0, 8).map((rec, idx) => {
                          const pct = Math.min(
                            100,
                            Math.round(
                              (rec.completedActivityIds.length /
                                Math.max(1, rec.totalActivities)) *
                                100
                            )
                          );
                          return (
                            <tr
                              key={`${rec.lessonId}-${rec.mode}-${idx}`}
                              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="py-3 px-6 font-semibold text-slate-900 dark:text-slate-100">
                                {resolvePackageTitle(rec.lessonId)}
                              </td>
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-400 capitalize">
                                {rec.mode}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                                {rec.completedActivityIds.length}/
                                {rec.totalActivities} ({pct}%)
                              </td>
                              <td className="py-3 px-6 text-right">
                                <span
                                  className={`font-semibold ${
                                    rec.completed
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-amber-600 dark:text-amber-400'
                                  }`}
                                >
                                  {rec.completed
                                    ? messages.parent.completedLabel
                                    : messages.parent.inProgressLabel}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Tricky Words Panel */}
              <section className="lg:col-span-4 surface-card rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {isVi ? 'Từ vựng nên ôn cùng bé' : 'Words to review'}
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {activeSnapshot.trickyWords.length}
                  </span>
                </div>

                {activeSnapshot.trickyWords.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {isVi
                      ? 'Chưa có từ khó nào cần ôn. Khi bé nghe lại nhiều lần một từ trong bài học hoặc truyện kể, từ đó sẽ tự động xuất hiện ở đây.'
                      : 'No tricky words logged yet. Words replayed during lessons or stories appear here automatically.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {activeSnapshot.trickyWords.slice(0, 6).map((item) => (
                      <li
                        key={item.key}
                        className="py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {item.term}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                            {item.replays}{' '}
                            {isVi ? 'lần nghe lại' : 'replays'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            speakText({
                              text: item.term,
                              locale:
                                item.locale ||
                                activeSnapshot.learner.preferences
                                  .learningLocale,
                              rate: activeSnapshot.learner.preferences.audioSpeed,
                            })
                          }
                          aria-label={`Listen to ${item.term}`}
                          className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-accent hover:border-accent transition-colors shrink-0 cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  onClick={onOpenWordReview}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Brain className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                  <span>{isVi ? 'Mở phiên ôn từ khó' : 'Open word review'}</span>
                </button>
              </section>
            </div>
          </motion.div>
        )
      )}
    </div>
  );
}

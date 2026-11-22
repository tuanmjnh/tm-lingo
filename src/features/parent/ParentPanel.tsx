import { useCallback, useEffect, useState } from 'react';
import {
  Archive,
  Brain,
  Calendar,
  Check,
  Copy,
  Download,
  Flame,
  Globe,
  GraduationCap,
  Lock,
  LogIn,
  LogOut,
  Plus,
  Share2,
  Trash2,
  Trophy,
  User,
  UserPlus,
  Volume2,
} from 'lucide-react';
import type {
  AgeGroupConfig,
  AuthUserProfile,
  LearnerPreferences,
  LearnerProfile,
  LessonProgressRecord,
  LocaleConfig,
  ParentConsentPurpose,
  ParentPrivacySummary,
} from '../../../packages/contracts/types';
import type { UiMessages } from '../../i18n/messages';
import { apiClient } from '../../shared/apiClient';
import { speakText } from '../../audio/speechPlayer';
import {
  computeGoalStreak,
  computeLast7Days,
  computeLearnerAchievements,
  getMasteredWordsList,
  getTrickyWordsForReview,
  isParentalGateEnabled,
  setParentalGateEnabled,
} from '../../lib/learnerRewards';

interface ParentPanelProps {
  authUser: AuthUserProfile | null;
  authBusy: boolean;
  authError: string | null;
  authNotice: string | null;
  onSignInGoogle: () => Promise<void>;
  onSignInEmail: (email: string, password: string) => Promise<void>;
  onSignUpEmail: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<void>;
  onSignOut: () => Promise<void>;
  learners: LearnerProfile[];
  activeLearner: LearnerProfile;
  ageGroups: AgeGroupConfig[];
  languages: LocaleConfig[];
  progressRecords: LessonProgressRecord[];
  messages: UiMessages;
  onSelectLearner: (learnerId: string) => void;
  onCreateLearner: (payload: {
    nickname: string;
    ageYears: number;
    ageBand?: string;
    gradeLevel?: number | null;
    avatarTone: LearnerProfile['avatarTone'];
  }) => Promise<void>;
  onUpdateLearnerProfile: (
    learnerId: string,
    patch: {
      nickname?: string;
      ageYears?: number;
      ageBand?: string;
      gradeLevel?: number | null;
      applyAgeDefaults?: boolean;
    }
  ) => Promise<void>;
  onUpdatePreferences: (patch: Partial<LearnerPreferences>) => Promise<void>;
  onFamilyDataChanged: () => Promise<void>;
  onOpenWordReview?: () => void;
}

const AVATAR_STYLES: Record<LearnerProfile['avatarTone'], string> = {
  sky: 'bg-sky-100 text-sky-800',
  amber: 'bg-amber-100 text-amber-800',
  emerald: 'bg-emerald-100 text-emerald-800',
  rose: 'bg-rose-100 text-rose-800',
};

export function ParentPanel({
  authUser,
  authBusy,
  authError,
  authNotice,
  onSignInGoogle,
  onSignInEmail,
  onSignUpEmail,
  onSignOut,
  learners,
  activeLearner,
  ageGroups,
  languages,
  progressRecords,
  messages,
  onSelectLearner,
  onCreateLearner,
  onUpdateLearnerProfile,
  onUpdatePreferences,
  onFamilyDataChanged,
  onOpenWordReview,
}: ParentPanelProps) {
  const isVi = activeLearner.preferences.interfaceLocale === 'vi';
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [nickname, setNickname] = useState('');
  const [ageYears, setAgeYears] = useState(4);
  const [gradeLevel, setGradeLevel] = useState<number>(0);
  const [avatarTone, setAvatarTone] =
    useState<LearnerProfile['avatarTone']>('emerald');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  // Active learner K-12 profile edit controls
  const [editAgeYears, setEditAgeYears] = useState(activeLearner.ageYears);
  const [editGradeLevel, setEditGradeLevel] = useState<number>(
    activeLearner.gradeLevel ?? (activeLearner.ageYears <= 5 ? 0 : Math.min(12, Math.max(1, activeLearner.ageYears - 5)))
  );
  const [editAgeBand, setEditAgeBand] = useState(activeLearner.ageBand);
  const [applyAgeDefaults, setApplyAgeDefaults] = useState(true);
  const [profileSaved, setProfileSaved] = useState(false);
  const [weeklyCopied, setWeeklyCopied] = useState(false);

  // Parental Gate local toggle
  const [gateEnabled, setGateEnabled] = useState(false);
  useEffect(() => {
    setGateEnabled(isParentalGateEnabled());
  }, []);

  useEffect(() => {
    setEditAgeYears(activeLearner.ageYears);
    setEditGradeLevel(
      activeLearner.gradeLevel ??
        (activeLearner.ageYears <= 5
          ? 0
          : Math.min(12, Math.max(1, activeLearner.ageYears - 5)))
    );
    setEditAgeBand(activeLearner.ageBand);
  }, [
    activeLearner.id,
    activeLearner.ageYears,
    activeLearner.gradeLevel,
    activeLearner.ageBand,
  ]);

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Child Privacy & Data Control state
  const [privacy, setPrivacy] = useState<ParentPrivacySummary | null>(null);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyNotice, setPrivacyNotice] = useState<string | null>(null);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [confirmSoftArchive, setConfirmSoftArchive] = useState(false);
  const [showHardDeleteBox, setShowHardDeleteBox] = useState(false);
  const [hardDeletePhrase, setHardDeletePhrase] = useState('');

  const loadPrivacy = useCallback(async () => {
    if (!authUser) {
      setPrivacy(null);
      return;
    }
    try {
      const res = await apiClient.getParentPrivacy();
      setPrivacy(res.privacy);
    } catch {
      setPrivacy(null);
    }
  }, [authUser]);

  useEffect(() => {
    void loadPrivacy();
  }, [loadPrivacy]);

  const getConsentState = (purpose: ParentConsentPurpose): boolean => {
    const records = (privacy?.consents ?? []).filter(
      (c) => c.purpose === purpose
    );
    if (records.length === 0) return purpose !== 'web_push_reminders';
    return records[records.length - 1].granted;
  };

  const handleToggleConsent = async (
    purpose: ParentConsentPurpose,
    granted: boolean
  ) => {
    setPrivacyBusy(true);
    setPrivacyError(null);
    setPrivacyNotice(null);
    try {
      const res = await apiClient.recordParentConsent(purpose, granted);
      setPrivacy(res.privacy);
      setPrivacyNotice(
        isVi
          ? 'Đã ghi nhận lựa chọn đồng thuận vào sổ nhật ký quyền riêng tư.'
          : 'Recorded consent preference in the privacy ledger.'
      );
    } catch (err) {
      setPrivacyError(
        err instanceof Error ? err.message : 'Unable to update consent'
      );
    } finally {
      setPrivacyBusy(false);
    }
  };

  const handleExportFamilyData = async () => {
    setPrivacyBusy(true);
    setPrivacyError(null);
    setPrivacyNotice(null);
    try {
      const { exportData } = await apiClient.exportParentData();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tm-lingo-family-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPrivacyNotice(
        isVi
          ? 'Đã xuất và tải xuống bản sao dữ liệu gia đình.'
          : 'Exported and downloaded a copy of your family data.'
      );
    } catch (err) {
      setPrivacyError(
        err instanceof Error ? err.message : 'Unable to export data'
      );
    } finally {
      setPrivacyBusy(false);
    }
  };

  const handleSoftArchiveFamily = async () => {
    setPrivacyBusy(true);
    setPrivacyError(null);
    setPrivacyNotice(null);
    try {
      const { result } = await apiClient.deleteParentData('soft');
      setConfirmSoftArchive(false);
      setPrivacyNotice(
        isVi
          ? `Đã lưu trữ (xóa mềm) ${result.affectedLearners} hồ sơ bé.`
          : `Archived (soft-deleted) ${result.affectedLearners} child profile(s).`
      );
      await loadPrivacy();
      await onFamilyDataChanged();
    } catch (err) {
      setPrivacyError(
        err instanceof Error ? err.message : 'Unable to archive data'
      );
    } finally {
      setPrivacyBusy(false);
    }
  };

  const handleHardDeleteFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hardDeletePhrase.trim().toUpperCase() !== 'DELETE') return;
    setPrivacyBusy(true);
    setPrivacyError(null);
    setPrivacyNotice(null);
    try {
      const { result } = await apiClient.deleteParentData('hard', 'DELETE');
      setHardDeletePhrase('');
      setShowHardDeleteBox(false);
      setPrivacyNotice(
        isVi
          ? `Đã xóa vĩnh viễn ${result.affectedLearners} hồ sơ bé và ${result.deletedProgress} bản ghi tiến độ.`
          : `Permanently deleted ${result.affectedLearners} child profile(s) and ${result.deletedProgress} progress record(s).`
      );
      await loadPrivacy();
      await onFamilyDataChanged();
    } catch (err) {
      setPrivacyError(
        err instanceof Error ? err.message : 'Unable to permanently delete data'
      );
    } finally {
      setPrivacyBusy(false);
    }
  };

  const uiLocales = languages.filter((l) => l.enabled && l.uiEnabled);
  const learningLocales = languages.filter((l) => l.enabled && l.learningEnabled);
  const explanationLocales = languages.filter(
    (l) => l.enabled && l.explanationEnabled
  );
  const narrationLocales = languages.filter((l) => l.enabled && l.ttsEnabled);

  const handlePrefChange = async (patch: Partial<LearnerPreferences>) => {
    setSaving(true);
    try {
      await onUpdatePreferences(patch);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 1800);
    } finally {
      setSaving(false);
    }
  };

  const matchAgeGroup = (years: number): AgeGroupConfig | undefined =>
    ageGroups.find((g) => years >= g.minAge && years <= g.maxAge) ?? ageGroups[0];

  const getGradeLabel = (grade: number | null | undefined): string => {
    if (!grade || grade <= 0) return isVi ? 'Mầm non' : 'Pre-K';
    return isVi ? `Lớp ${grade}` : `Grade ${grade}`;
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    setSaving(true);
    try {
      const matched = matchAgeGroup(ageYears);
      await onCreateLearner({
        nickname: nickname.trim(),
        ageYears,
        ageBand: matched?.id,
        gradeLevel,
        avatarTone,
      });
      setNickname('');
      setShowCreateForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveActiveAgeProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdateLearnerProfile(activeLearner.id, {
        ageYears: editAgeYears,
        gradeLevel: editGradeLevel,
        ageBand: editAgeBand,
        applyAgeDefaults,
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const weeklySummary = computeLast7Days(
    activeLearner.id,
    progressRecords.map((r) => r.updatedAt)
  );
  const goalStreak = computeGoalStreak(activeLearner.id);
  const achievementSummary = computeLearnerAchievements(activeLearner.id);
  const allReviewWords = getTrickyWordsForReview(activeLearner.id);
  const trickyWordList = allReviewWords.slice(0, 6);
  const masteredWordCount = getMasteredWordsList(activeLearner.id).length;

  const weeklyLessonsCount = weeklySummary.days.reduce(
    (sum, d) => sum + d.lessons,
    0
  );
  const weeklyStoriesCount = weeklySummary.days.reduce(
    (sum, d) => sum + d.stories,
    0
  );
  const maxDayActivity = Math.max(
    1,
    ...weeklySummary.days.map((d) => d.lessons * 3 + d.stories * 3 + d.words)
  );
  const avgLessonCompletionPct =
    progressRecords.length > 0
      ? Math.round(
          progressRecords.reduce(
            (sum, rec) =>
              sum +
              Math.min(
                100,
                (rec.completedActivityIds.length /
                  Math.max(1, rec.totalActivities)) *
                  100
              ),
            0
          ) / progressRecords.length
        )
      : Math.round((weeklySummary.activeDaysCount / 7) * 100);

  const effectiveStreakDays = Math.max(
    weeklySummary.streakDays,
    goalStreak.currentStreak
  );
  const bestStreakDays = Math.max(
    effectiveStreakDays,
    goalStreak.longestStreak
  );

  const buildWeeklySummaryText = () => {
    const topReviewTerms = trickyWordList
      .slice(0, 4)
      .map((w) => w.term)
      .join(', ');
    if (isVi) {
      const lines = [
        `Tóm tắt học tập tuần của ${activeLearner.nickname} (TM-Lingo):`,
        `- Hoạt động: ${weeklySummary.activeDaysCount}/7 ngày · Chuỗi hiện tại: ${effectiveStreakDays} ngày (Kỷ lục: ${bestStreakDays} ngày)`,
        `- Kết quả 7 ngày: ${weeklyLessonsCount} bài học, ${weeklyStoriesCount} truyện song ngữ, ${weeklySummary.totalWords7d} lượt luyện từ`,
        `- Tỷ lệ hoàn thành: ${avgLessonCompletionPct}% · Huy hiệu: ${achievementSummary.unlockedCount}/${achievementSummary.totalCount} · Từ khó đã thuộc: ${masteredWordCount}`,
      ];
      if (topReviewTerms) {
        lines.push(`- Gợi ý ôn cùng bé tuần tới: ${topReviewTerms}`);
      }
      return lines.join('\n');
    }

    const lines = [
      `${activeLearner.nickname}'s Weekly Learning Summary (TM-Lingo):`,
      `- Active days: ${weeklySummary.activeDaysCount}/7 · Current streak: ${effectiveStreakDays}d (Best: ${bestStreakDays}d)`,
      `- 7-day progress: ${weeklyLessonsCount} lessons, ${weeklyStoriesCount} stories, ${weeklySummary.totalWords7d} vocabulary practices`,
      `- Completion rate: ${avgLessonCompletionPct}% · Badges: ${achievementSummary.unlockedCount}/${achievementSummary.totalCount} · Mastered words: ${masteredWordCount}`,
    ];
    if (topReviewTerms) {
      lines.push(`- Words to practice together next: ${topReviewTerms}`);
    }
    return lines.join('\n');
  };

  const handleCopyWeeklySummary = async () => {
    const summaryText = buildWeeklySummaryText();
    try {
      await navigator.clipboard.writeText(summaryText);
      setWeeklyCopied(true);
      window.setTimeout(() => setWeeklyCopied(false), 2400);
    } catch {
      // Fallback copy via temporary textarea
      const ta = document.createElement('textarea');
      ta.value = summaryText;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setWeeklyCopied(true);
        window.setTimeout(() => setWeeklyCopied(false), 2400);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  const handleShareWeeklySummary = async () => {
    const summaryText = buildWeeklySummaryText();
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: isVi
            ? `Tiến độ tuần của ${activeLearner.nickname} - TM-Lingo`
            : `${activeLearner.nickname}'s Weekly Progress - TM-Lingo`,
          text: summaryText,
        });
        return;
      } catch {
        // User cancelled or share unavailable — fall back to clipboard copy
      }
    }
    await handleCopyWeeklySummary();
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) return;
    if (authMode === 'signin') {
      await onSignInEmail(email, password);
    } else {
      await onSignUpEmail(email, password, displayName);
    }
  };

  return (
    <div className="space-y-8">
      <div className="max-w-3xl space-y-2">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
          {messages.parent.heading}
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          {messages.parent.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: Learner Profiles & Independent Locale Settings */}
        <div className="lg:col-span-7 space-y-6">
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {messages.parent.profilesHeading}
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateForm((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span className="whitespace-nowrap">
                  {messages.parent.addLearner}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {learners.map((profile) => {
                const isActive = profile.id === activeLearner.id;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => onSelectLearner(profile.id)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      isActive
                        ? 'border-accent bg-accent-soft'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${AVATAR_STYLES[profile.avatarTone]}`}
                    >
                      <User className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {profile.nickname}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {profile.ageYears} {isVi ? 'tuổi' : 'y'} ·{' '}
                        {getGradeLabel(profile.gradeLevel)} ·{' '}
                        {profile.preferences.learningLocale.toUpperCase()} /{' '}
                        {profile.preferences.explanationLocale.toUpperCase()}
                      </p>
                    </div>
                    {isActive && (
                      <Check
                        className="w-4 h-4 text-accent shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active Learner K-12 Age & Grade Configuration */}
            <form
              onSubmit={handleSaveActiveAgeProfile}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                  <GraduationCap className="w-4 h-4 text-accent" aria-hidden="true" />
                  <span>
                    {isVi
                      ? `Độ tuổi & cấp học của ${activeLearner.nickname} (Mầm non – Lớp 12)`
                      : `${activeLearner.nickname}'s Age & Grade (Pre-K – Grade 12)`}
                  </span>
                </div>
                {profileSaved && (
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {messages.parent.savedNotice}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-600">
                    {messages.parent.ageLabel}
                  </span>
                  <select
                    value={editAgeYears}
                    onChange={(e) => {
                      const nextAge = Number(e.target.value);
                      setEditAgeYears(nextAge);
                      setEditGradeLevel(
                        nextAge <= 5 ? 0 : Math.min(12, Math.max(1, nextAge - 5))
                      );
                      const matched = matchAgeGroup(nextAge);
                      if (matched) setEditAgeBand(matched.id);
                    }}
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-2.5 text-sm text-slate-900"
                  >
                    {Array.from({ length: 16 }, (_, idx) => idx + 3).map((age) => (
                      <option key={age} value={age}>
                        {age} {isVi ? 'tuổi' : 'yrs'}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-600">
                    {isVi ? 'Khối lớp' : 'Grade level'}
                  </span>
                  <select
                    value={editGradeLevel}
                    onChange={(e) => setEditGradeLevel(Number(e.target.value))}
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-2.5 text-sm text-slate-900"
                  >
                    <option value={0}>{isVi ? 'Mầm non' : 'Pre-K'}</option>
                    {Array.from({ length: 12 }, (_, idx) => idx + 1).map((g) => (
                      <option key={g} value={g}>
                        {isVi ? `Lớp ${g}` : `Grade ${g}`}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-600">
                    {isVi ? 'Nhóm lộ trình' : 'Curriculum band'}
                  </span>
                  <select
                    value={editAgeBand}
                    onChange={(e) => setEditAgeBand(e.target.value)}
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-2.5 text-sm text-slate-900"
                  >
                    {ageGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {isVi ? g.shortLabels.vi : g.shortLabels.en}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyAgeDefaults}
                    onChange={(e) => setApplyAgeDefaults(e.target.checked)}
                    className="w-4 h-4 accent-sky-600"
                  />
                  <span>
                    {isVi
                      ? 'Áp dụng gợi ý thời lượng & tốc độ đọc theo nhóm tuổi'
                      : 'Apply recommended duration & speed for this age group'}
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {isVi ? 'Cập nhật hồ sơ' : 'Save profile'}
                </button>
              </div>
            </form>

            {showCreateForm && (
              <form
                onSubmit={handleCreateSubmit}
                className="pt-4 border-t border-slate-100 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-700">
                      {messages.parent.nicknameLabel}
                    </span>
                    <input
                      type="text"
                      required
                      maxLength={32}
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="Bé Bông / Minh Anh"
                      className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-700">
                      {messages.parent.ageLabel}
                    </span>
                    <select
                      value={ageYears}
                      onChange={(e) => {
                        const nextAge = Number(e.target.value);
                        setAgeYears(nextAge);
                        setGradeLevel(
                          nextAge <= 5 ? 0 : Math.min(12, Math.max(1, nextAge - 5))
                        );
                      }}
                      className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    >
                      {Array.from({ length: 16 }, (_, idx) => idx + 3).map((age) => (
                        <option key={age} value={age}>
                          {age} {isVi ? 'tuổi' : 'yrs'}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-700">
                      {isVi ? 'Khối lớp' : 'Grade level'}
                    </span>
                    <select
                      value={gradeLevel}
                      onChange={(e) => setGradeLevel(Number(e.target.value))}
                      className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    >
                      <option value={0}>{isVi ? 'Mầm non' : 'Pre-K'}</option>
                      {Array.from({ length: 12 }, (_, idx) => idx + 1).map((g) => (
                        <option key={g} value={g}>
                          {isVi ? `Lớp ${g}` : `Grade ${g}`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {matchAgeGroup(ageYears) && (
                  <p className="text-xs text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
                    {isVi ? 'Lộ trình phù hợp:' : 'Matched curriculum band:'}{' '}
                    <strong>
                      {isVi
                        ? matchAgeGroup(ageYears)?.displayNames.vi
                        : matchAgeGroup(ageYears)?.displayNames.en}
                    </strong>{' '}
                    · {matchAgeGroup(ageYears)?.uiProfile.defaultDailyMinutes}{' '}
                    {messages.parent.minutesUnit}
                  </p>
                )}

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {(['sky', 'amber', 'emerald', 'rose'] as const).map(
                      (tone) => (
                        <button
                          key={tone}
                          type="button"
                          onClick={() => setAvatarTone(tone)}
                          className={`w-8 h-8 rounded-lg ${AVATAR_STYLES[tone]} ${
                            avatarTone === tone
                              ? 'ring-2 ring-slate-900 ring-offset-1'
                              : ''
                          } cursor-pointer`}
                          aria-label={`Avatar color ${tone}`}
                        />
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-4 py-2 min-h-[40px] rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      {messages.parent.cancelButton}
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 min-h-[40px] rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
                    >
                      {messages.parent.createButton}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {messages.parent.languageHeading}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {messages.parent.languageNote}
                </p>
              </div>
              {savedNotice && (
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                  {messages.parent.savedNotice}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {messages.parent.interfaceLocale}
                </span>
                <select
                  value={activeLearner.preferences.interfaceLocale}
                  onChange={(e) =>
                    void handlePrefChange({ interfaceLocale: e.target.value })
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  {uiLocales.map((l) => (
                    <option key={l.locale} value={l.locale}>
                      {l.nativeName} ({l.locale})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {messages.parent.learningLocale}
                </span>
                <select
                  value={activeLearner.preferences.learningLocale}
                  onChange={(e) =>
                    void handlePrefChange({ learningLocale: e.target.value })
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  {learningLocales.map((l) => (
                    <option key={l.locale} value={l.locale}>
                      {l.nativeName} ({l.locale})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {messages.parent.explanationLocale}
                </span>
                <select
                  value={activeLearner.preferences.explanationLocale}
                  onChange={(e) =>
                    void handlePrefChange({ explanationLocale: e.target.value })
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  {explanationLocales.map((l) => (
                    <option key={l.locale} value={l.locale}>
                      {l.nativeName} ({l.locale})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {messages.parent.narrationLocale}
                </span>
                <select
                  value={activeLearner.preferences.narrationLocale}
                  onChange={(e) =>
                    void handlePrefChange({ narrationLocale: e.target.value })
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  {narrationLocales.map((l) => (
                    <option key={l.locale} value={l.locale}>
                      {l.nativeName} ({l.locale})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {messages.parent.accessibilityHeading}
              </h3>

              <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                <span>{messages.parent.reducedMotion}</span>
                <input
                  type="checkbox"
                  checked={activeLearner.preferences.reducedMotion}
                  onChange={(e) =>
                    void handlePrefChange({ reducedMotion: e.target.checked })
                  }
                  className="w-4 h-4 accent-sky-600"
                />
              </label>

              <label className="flex items-center justify-between gap-4 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                <div>
                  <span className="font-medium text-slate-800 dark:text-slate-100 block">
                    {isVi
                      ? 'Cổng xác nhận phụ huynh (Parental Gate)'
                      : 'Parental Gate lock'}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {isVi
                      ? 'Yêu cầu phép tính nhỏ hoặc giữ 2 giây khi mở trang Phụ huynh để bé không bấm nhầm.'
                      : 'Requires a quick math check or 2-second hold before opening Parents settings.'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={gateEnabled}
                  onChange={(e) => {
                    setGateEnabled(e.target.checked);
                    setParentalGateEnabled(e.target.checked);
                  }}
                  className="w-4 h-4 accent-sky-600 shrink-0"
                />
              </label>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300 tabular-nums">
                  <span>{messages.parent.dailyLimit}</span>
                  <span className="font-semibold">
                    {activeLearner.preferences.dailyMinutesLimit}{' '}
                    {messages.parent.minutesUnit}
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={60}
                  step={5}
                  value={activeLearner.preferences.dailyMinutesLimit}
                  onChange={(e) =>
                    void handlePrefChange({
                      dailyMinutesLimit: Number(e.target.value),
                    })
                  }
                  className="w-full accent-sky-600"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right column: Parent Account, Learner Progress & System Admin Link */}
        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {messages.parent.accountHeading}
            </h2>
            {authUser ? (
              <div className="space-y-3">
                <div className="text-sm text-slate-700 dark:text-slate-300">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {authUser.displayName ?? authUser.email ?? 'Parent'}
                  </p>
                  {authUser.email && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {authUser.email} ·{' '}
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {authUser.role === 'admin'
                          ? messages.parent.roleAdmin
                          : authUser.role === 'teacher'
                            ? messages.parent.roleTeacher
                            : messages.parent.roleParent}
                      </span>
                    </p>
                  )}
                  <p className="mt-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {messages.parent.accountSignedInNote}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void onSignOut()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  <span className="whitespace-nowrap">
                    {messages.parent.signOutButton}
                  </span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 leading-relaxed">
                  {messages.parent.accountGuestNote}
                </p>

                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void onSignInGoogle()}
                  className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Globe
                    className="w-4 h-4 text-sky-600 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="whitespace-nowrap">
                    {messages.parent.signInGoogle}
                  </span>
                </button>

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-slate-200" />
                  <span className="mx-3 shrink-0 text-xs text-slate-400">
                    {messages.parent.orWithEmail}
                  </span>
                  <div className="flex-grow border-t border-slate-200" />
                </div>

                <div className="flex border-b border-slate-200 text-sm font-semibold">
                  <button
                    type="button"
                    onClick={() => setAuthMode('signin')}
                    className={`px-3 py-2 border-b-2 transition-colors cursor-pointer ${
                      authMode === 'signin'
                        ? 'border-sky-600 text-slate-900'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {messages.parent.signInTab}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('signup')}
                    className={`px-3 py-2 border-b-2 transition-colors cursor-pointer ${
                      authMode === 'signup'
                        ? 'border-sky-600 text-slate-900'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {messages.parent.signUpTab}
                  </button>
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-3">
                  {authMode === 'signup' && (
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-700">
                        {messages.parent.displayNameLabel}
                      </span>
                      <input
                        type="text"
                        maxLength={48}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Mẹ Bé Min"
                        className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                      />
                    </label>
                  )}

                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-slate-700">
                      {messages.parent.emailLabel}
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="parent@example.com"
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-slate-700">
                      {messages.parent.passwordLabel}
                    </span>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={authBusy}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {authMode === 'signin' ? (
                      <LogIn className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <UserPlus className="w-4 h-4" aria-hidden="true" />
                    )}
                    <span className="whitespace-nowrap">
                      {authMode === 'signin'
                        ? messages.parent.signInButton
                        : messages.parent.signUpButton}
                    </span>
                  </button>
                </form>
              </div>
            )}

            {authNotice && (
              <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                {authNotice}
              </p>
            )}
            {authError && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {authError}
              </p>
            )}
          </section>

          {/* Weekly 7-Day Activity Calendar, KPI Insights, Streak & Shareable Summary */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar
                  className="w-4 h-4 text-accent shrink-0"
                  aria-hidden="true"
                />
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight whitespace-nowrap">
                  {isVi ? 'Tóm tắt tiến độ 7 ngày' : '7-Day Learning Insights'}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/60 text-xs font-bold text-amber-700 dark:text-amber-300 tabular-nums whitespace-nowrap shrink-0">
                  <Flame
                    className="w-3.5 h-3.5 text-amber-500 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {effectiveStreakDays}{' '}
                    {isVi ? 'ngày liên tiếp' : 'day streak'}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => void handleCopyWeeklySummary()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-accent hover:text-accent transition-colors cursor-pointer"
                >
                  {weeklyCopied ? (
                    <>
                      <Check
                        className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400"
                        aria-hidden="true"
                      />
                      <span className="text-emerald-700 dark:text-emerald-300">
                        {isVi ? 'Đã sao chép!' : 'Copied!'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{isVi ? 'Sao chép' : 'Copy'}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => void handleShareWeeklySummary()}
                  title={
                    isVi
                      ? 'Chia sẻ báo cáo tuần cho gia đình'
                      : 'Share weekly summary with family'
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg btn-accent text-xs font-semibold cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isVi ? 'Chia sẻ' : 'Share'}</span>
                </button>
              </div>
            </div>

            {/* 4-Card Weekly KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/60 p-3 space-y-0.5">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {isVi ? 'Chuỗi kỷ lục' : 'Best streak'}
                </p>
                <p className="text-lg font-extrabold text-orange-600 dark:text-orange-400 tabular-nums">
                  {bestStreakDays} {isVi ? 'ngày' : 'd'}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {isVi
                    ? `Hiện tại: ${effectiveStreakDays} ngày`
                    : `Current: ${effectiveStreakDays}d`}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/60 p-3 space-y-0.5">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {isVi ? 'Bài & Truyện (7n)' : 'Lessons & Stories'}
                </p>
                <p className="text-lg font-extrabold text-sky-600 dark:text-sky-400 tabular-nums">
                  {weeklyLessonsCount + weeklyStoriesCount}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {weeklyLessonsCount} {isVi ? 'bài' : 'les'} ·{' '}
                  {weeklyStoriesCount} {isVi ? 'truyện' : 'st'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/60 p-3 space-y-0.5">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {isVi ? 'Hoàn thành' : 'Completion'}
                </p>
                <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {avgLessonCompletionPct}%
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {weeklySummary.activeDaysCount}/7{' '}
                  {isVi ? 'ngày học' : 'active days'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/60 p-3 space-y-0.5">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-amber-500" aria-hidden="true" />
                  <span>{isVi ? 'Huy hiệu' : 'Badges'}</span>
                </p>
                <p className="text-lg font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                  {achievementSummary.unlockedCount}/
                  {achievementSummary.totalCount}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {masteredWordCount} {isVi ? 'từ đã thuộc' : 'words mastered'}
                </p>
              </div>
            </div>

            {/* 7-Day Activity Calendar with Visual Intensity Bars */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {weeklySummary.days.map((day) => {
                const activityScore =
                  day.lessons * 3 + day.stories * 3 + day.words;
                const barHeightPct = day.active
                  ? Math.max(24, Math.round((activityScore / maxDayActivity) * 100))
                  : 12;
                return (
                  <div
                    key={day.dateKey}
                    title={
                      isVi
                        ? `${day.dateKey}: ${day.lessons} bài học, ${day.stories} truyện, ${day.words} lượt từ`
                        : `${day.dateKey}: ${day.lessons} lessons, ${day.stories} stories, ${day.words} words`
                    }
                    className={`flex flex-col items-center justify-between rounded-xl border px-0 py-2 sm:px-1.5 sm:py-2.5 min-w-0 gap-1.5 ${
                      day.active
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <span className="text-[10px] sm:text-[11px] font-semibold leading-none text-center">
                      {day.shortDay}
                    </span>

                    <div className="w-2.5 h-8 rounded-full bg-slate-200/70 dark:bg-slate-800 flex items-end overflow-hidden">
                      <div
                        className={`w-full rounded-full transition-all ${
                          day.active
                            ? 'bg-emerald-500 dark:bg-emerald-400'
                            : 'bg-slate-300/60 dark:bg-slate-700'
                        }`}
                        style={{ height: `${barHeightPct}%` }}
                      />
                    </div>

                    <div
                      className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center shrink-0 ${
                        day.active
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200/70 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {day.active ? (
                        <Check className="w-3 h-3" aria-hidden="true" />
                      ) : (
                        <span className="text-[10px] leading-none">·</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed tabular-nums">
              {isVi
                ? `Tuần này ${activeLearner.nickname} đã hoạt động ${weeklySummary.activeDaysCount}/7 ngày, hoàn thành ${weeklyLessonsCount} bài học, ${weeklyStoriesCount} truyện và luyện khoảng ${weeklySummary.totalWords7d} lượt từ vựng.`
                : `Active ${weeklySummary.activeDaysCount}/7 days this week with ${weeklyLessonsCount} lessons, ${weeklyStoriesCount} stories, and ~${weeklySummary.totalWords7d} vocabulary practices.`}
            </p>

            {(trickyWordList.length > 0 || masteredWordCount > 0) && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {isVi
                        ? 'Từ con hay bấm nghe lại (nên ôn cùng bé):'
                        : 'Words to review together (replayed often):'}
                    </p>
                    {masteredWordCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                        <Check className="w-3 h-3" aria-hidden="true" />
                        <span>
                          {isVi
                            ? `Đã thuộc ${masteredWordCount} từ`
                            : `${masteredWordCount} mastered`}
                        </span>
                      </span>
                    )}
                  </div>
                  {onOpenWordReview && (
                    <button
                      type="button"
                      onClick={onOpenWordReview}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl btn-accent text-xs font-semibold cursor-pointer"
                    >
                      <Brain className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {trickyWordList.length > 0
                          ? isVi
                            ? `Ôn nhanh (${allReviewWords.length})`
                            : `Start Review (${allReviewWords.length})`
                          : isVi
                            ? 'Xem từ đã thuộc'
                            : 'View mastered'}
                      </span>
                    </button>
                  )}
                </div>

                {trickyWordList.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {trickyWordList.map((w) => (
                      <button
                        key={w.key}
                        type="button"
                        onClick={() =>
                          speakText({
                            text: w.term,
                            locale:
                              w.locale ||
                              activeLearner.preferences.learningLocale,
                            rate: 0.85,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] max-w-full rounded-xl border border-accent bg-accent-soft text-xs font-semibold text-left cursor-pointer"
                      >
                        <Volume2
                          className="w-3.5 h-3.5 text-accent shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate">{w.term}</span>
                        <span className="text-[10px] opacity-80 tabular-nums shrink-0">
                          ×{w.replays}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {messages.parent.progressHeading}
            </h2>
            {progressRecords.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {messages.parent.noProgressYet}
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {progressRecords.map((rec) => (
                  <div
                    key={`${rec.lessonId}-${rec.learningLocale}-${rec.mode}`}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {rec.lessonId} · {rec.mode}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {rec.learningLocale.toUpperCase()} ·{' '}
                        {rec.completedActivityIds.length}/{rec.totalActivities}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        rec.completed
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-accent'
                      }`}
                    >
                      {rec.completed
                        ? messages.parent.completedLabel
                        : messages.parent.inProgressLabel}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {authUser && (
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <Lock
                    className="w-4 h-4 text-accent shrink-0"
                    aria-hidden="true"
                  />
                  <h2 className="text-lg font-bold">
                    {isVi
                      ? 'Quyền riêng tư & Dữ liệu của gia đình'
                      : 'Family Privacy & Data Control'}
                  </h2>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {isVi
                    ? 'Quản lý sự đồng thuận lưu trữ hồ sơ, tải bản sao dữ liệu gia đình, hoặc lưu trữ/xóa vĩnh viễn dữ liệu học tập.'
                    : 'Manage parental consents, download a copy of your family data, or archive/permanently delete learner records.'}
                </p>
              </div>

              {privacy && (
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-3 text-center">
                  <div>
                    <p className="text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      {privacy.learnerCount}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {isVi ? 'Hồ sơ bé' : 'Profiles'}
                    </p>
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-900 tabular-nums">
                      {privacy.progressCount}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {isVi ? 'Tiến độ' : 'Progress'}
                    </p>
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-900 tabular-nums">
                      {privacy.storyPositionCount}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {isVi ? 'Dấu truyện' : 'Bookmarks'}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2.5 pt-1 border-t border-slate-100">
                {(
                  [
                    [
                      'child_profile_storage',
                      isVi
                        ? 'Lưu trữ hồ sơ biệt danh & tuổi của bé'
                        : 'Store child nickname & age profiles',
                    ],
                    [
                      'learning_progress_sync',
                      isVi
                        ? 'Đồng bộ tiến độ học & dấu trang truyện'
                        : 'Sync lesson progress & story bookmarks',
                    ],
                    [
                      'web_push_reminders',
                      isVi
                        ? 'Nhận thông báo nhắc học nhẹ nhàng cho phụ huynh'
                        : 'Receive gentle parent reminder notifications',
                    ],
                  ] as Array<[ParentConsentPurpose, string]>
                ).map(([purpose, label]) => (
                  <label
                    key={purpose}
                    className="flex items-center justify-between gap-3 text-xs font-medium text-slate-700 cursor-pointer"
                  >
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      disabled={privacyBusy}
                      checked={getConsentState(purpose)}
                      onChange={(e) =>
                        void handleToggleConsent(purpose, e.target.checked)
                      }
                      className="w-4 h-4 accent-sky-600 shrink-0"
                    />
                  </label>
                ))}
              </div>

              {privacyNotice && (
                <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  {privacyNotice}
                </p>
              )}
              {privacyError && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {privacyError}
                </p>
              )}

              <div className="pt-2 border-t border-slate-100 space-y-2.5">
                <button
                  type="button"
                  disabled={privacyBusy}
                  onClick={() => void handleExportFamilyData()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-sky-600" aria-hidden="true" />
                  <span>
                    {isVi
                      ? 'Tải bản sao dữ liệu gia đình'
                      : 'Download Family Data'}
                  </span>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {!confirmSoftArchive ? (
                    <button
                      type="button"
                      disabled={privacyBusy}
                      onClick={() => setConfirmSoftArchive(true)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {isVi ? 'Lưu trữ hồ sơ' : 'Archive Data'}
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5">
                      <button
                        type="button"
                        disabled={privacyBusy}
                        onClick={() => void handleSoftArchiveFamily()}
                        className="flex-1 px-2 py-1 rounded-lg bg-amber-600 text-white text-[11px] font-semibold cursor-pointer"
                      >
                        {isVi ? 'Xác nhận lưu trữ' : 'Confirm Archive'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmSoftArchive(false)}
                        className="px-2 py-1 text-[11px] font-semibold text-slate-600 cursor-pointer"
                      >
                        {isVi ? 'Hủy' : 'Cancel'}
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={privacyBusy}
                    onClick={() => setShowHardDeleteBox((v) => !v)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      {isVi ? 'Xóa vĩnh viễn' : 'Delete Forever'}
                    </span>
                  </button>
                </div>

                {showHardDeleteBox && (
                  <form
                    onSubmit={handleHardDeleteFamily}
                    className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 space-y-2.5"
                  >
                    <p className="text-xs text-rose-900 leading-relaxed">
                      {isVi
                        ? 'Thao tác này sẽ xóa vĩnh viễn toàn bộ hồ sơ bé, tiến độ học và dấu trang truyện. Nhập DELETE để xác nhận:'
                        : 'This permanently deletes all child profiles, progress, and bookmarks. Type DELETE to confirm:'}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={hardDeletePhrase}
                        onChange={(e) => setHardDeletePhrase(e.target.value)}
                        placeholder="DELETE"
                        className="flex-1 min-h-[36px] rounded-lg border border-rose-200 bg-white px-2.5 text-xs font-mono uppercase"
                      />
                      <button
                        type="submit"
                        disabled={
                          privacyBusy ||
                          hardDeletePhrase.trim().toUpperCase() !== 'DELETE'
                        }
                        className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-40 cursor-pointer"
                      >
                        {isVi ? 'Xóa ngay' : 'Purge'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

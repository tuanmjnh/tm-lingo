'use client';

import { useEffect, useState } from 'react';
import {
  Brain,
  Check,
  Copy,
  Flame,
  GraduationCap,
  KeyRound,
  Link2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Unlink,
  UserCheck,
} from 'lucide-react';
import type {
  AgeGroupConfig,
  AuthUserProfile,
  FamilyInviteRecord,
  LearnerPreferences,
  LearnerProfile,
  LessonProgressRecord,
  LocaleConfig,
  ObserverLinkRecord,
} from '../../../packages/contracts/types';
import type { UiMessages } from '../../i18n/messages';
import {
  createStudentInviteCode,
  revokeStudentInvite,
  subscribeObserverLinksForStudent,
  subscribeStudentInvites,
  syncStudentObserverSnapshots,
  unlinkObserverLink,
} from '../../shared/firestoreService';
import {
  computeGoalStreak,
  computeLast7Days,
  getMasteredWordsList,
  getTrickyWordsForReview,
} from '../../lib/learnerRewards';

interface StudentSelfHubProps {
  authUser: AuthUserProfile;
  authBusy: boolean;
  onSignOut: () => Promise<void>;
  studentProfile: LearnerProfile;
  ageGroups: AgeGroupConfig[];
  languages: LocaleConfig[];
  progressRecords: LessonProgressRecord[];
  messages: UiMessages;
  onUpdateLearnerProfile: (
    learnerId: string,
    patch: {
      nickname?: string;
      ageYears?: number;
      ageBand?: string;
      gradeLevel?: number | null;
      avatarTone?: LearnerProfile['avatarTone'];
      applyAgeDefaults?: boolean;
    }
  ) => Promise<void>;
  onUpdatePreferences: (patch: Partial<LearnerPreferences>) => Promise<void>;
  onOpenWordReview?: () => void;
}

const AVATAR_TONES: Array<{
  id: LearnerProfile['avatarTone'];
  labelVi: string;
  labelEn: string;
  dotClass: string;
}> = [
  { id: 'sky', labelVi: 'Xanh dương', labelEn: 'Sky', dotClass: 'bg-sky-600' },
  {
    id: 'emerald',
    labelVi: 'Ngọc lục bảo',
    labelEn: 'Emerald',
    dotClass: 'bg-emerald-600',
  },
  {
    id: 'amber',
    labelVi: 'Hổ phách',
    labelEn: 'Amber',
    dotClass: 'bg-amber-500',
  },
  { id: 'rose', labelVi: 'San hô', labelEn: 'Rose', dotClass: 'bg-rose-600' },
];

export function StudentSelfHub({
  authUser,
  authBusy,
  onSignOut,
  studentProfile,
  ageGroups,
  languages,
  progressRecords,
  messages,
  onUpdateLearnerProfile,
  onUpdatePreferences,
  onOpenWordReview,
}: StudentSelfHubProps) {
  const isVi = studentProfile.preferences.interfaceLocale === 'vi';

  // Self-profile edit state
  const [nickname, setNickname] = useState(studentProfile.nickname);
  const [ageYears, setAgeYears] = useState(studentProfile.ageYears);
  const [gradeLevel, setGradeLevel] = useState<number>(
    studentProfile.gradeLevel ??
      (studentProfile.ageYears <= 5
        ? 0
        : Math.min(12, Math.max(1, studentProfile.ageYears - 5)))
  );
  const [ageBand, setAgeBand] = useState(studentProfile.ageBand);
  const [avatarTone, setAvatarTone] = useState<LearnerProfile['avatarTone']>(
    studentProfile.avatarTone
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);

  // Parent observer invite & active links state
  const [invites, setInvites] = useState<FamilyInviteRecord[]>([]);
  const [observerLinks, setObserverLinks] = useState<ObserverLinkRecord[]>([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    setNickname(studentProfile.nickname);
    setAgeYears(studentProfile.ageYears);
    setGradeLevel(
      studentProfile.gradeLevel ??
        (studentProfile.ageYears <= 5
          ? 0
          : Math.min(12, Math.max(1, studentProfile.ageYears - 5)))
    );
    setAgeBand(studentProfile.ageBand);
    setAvatarTone(studentProfile.avatarTone);
  }, [
    studentProfile.id,
    studentProfile.nickname,
    studentProfile.ageYears,
    studentProfile.gradeLevel,
    studentProfile.ageBand,
    studentProfile.avatarTone,
  ]);

  useEffect(() => {
    if (!authUser.id || authUser.emailVerified === false) return;
    const unsubInvites = subscribeStudentInvites(authUser.id, setInvites);
    const unsubLinks = subscribeObserverLinksForStudent(
      authUser.id,
      setObserverLinks
    );
    return () => {
      unsubInvites();
      unsubLinks();
    };
  }, [authUser.id, authUser.emailVerified]);

  const weeklySummary = computeLast7Days(
    studentProfile.id,
    progressRecords.map((r) => r.updatedAt)
  );
  const goalStreak = computeGoalStreak(studentProfile.id);
  const effectiveStreak = Math.max(
    weeklySummary.streakDays,
    goalStreak.currentStreak
  );
  const completedLessonsCount = progressRecords.filter((r) => r.completed).length;
  const totalActivitiesCompleted = progressRecords.reduce(
    (sum, r) => sum + r.completedActivityIds.length,
    0
  );
  const trickyCount = getTrickyWordsForReview(studentProfile.id).length;
  const masteredCount = getMasteredWordsList(studentProfile.id).length;

  // Keep linked parents' read-only snapshot fresh whenever student opens Hub
  useEffect(() => {
    if (observerLinks.length === 0) return;
    void syncStudentObserverSnapshots(authUser.id, {
      studentName: studentProfile.nickname,
      ageYears: studentProfile.ageYears,
      ageBand: studentProfile.ageBand,
      gradeLevel: studentProfile.gradeLevel ?? 7,
      avatarTone: studentProfile.avatarTone,
      completedLessonsCount,
      totalActivitiesCompleted,
      currentStreakDays: effectiveStreak,
      dailyMinutesGoal: studentProfile.preferences.dailyMinutesLimit,
    });
  }, [
    authUser.id,
    observerLinks.length,
    studentProfile.nickname,
    studentProfile.ageYears,
    studentProfile.ageBand,
    studentProfile.gradeLevel,
    studentProfile.avatarTone,
    studentProfile.preferences.dailyMinutesLimit,
    completedLessonsCount,
    totalActivitiesCompleted,
    effectiveStreak,
  ]);

  const matchAgeGroup = (years: number) =>
    ageGroups.find((g) => years >= g.minAge && years <= g.maxAge) ??
    ageGroups[0];

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    setSavingProfile(true);
    try {
      await onUpdateLearnerProfile(studentProfile.id, {
        nickname: nickname.trim(),
        ageYears,
        ageBand,
        gradeLevel,
        avatarTone,
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePrefChange = async (patch: Partial<LearnerPreferences>) => {
    await onUpdatePreferences(patch);
    setPrefSaved(true);
    setTimeout(() => setPrefSaved(false), 1800);
  };

  const handleGenerateInvite = async () => {
    setInviteBusy(true);
    setInviteError(null);
    try {
      await createStudentInviteCode(authUser.id, studentProfile);
    } catch (err) {
      setInviteError(
        err instanceof Error
          ? err.message
          : isVi
            ? 'Không thể tạo mã liên kết lúc này.'
            : 'Unable to create link code right now.'
      );
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRevokeInvite = async (code: string) => {
    setInviteBusy(true);
    setInviteError(null);
    try {
      await revokeStudentInvite(code);
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : 'Unable to revoke invite code'
      );
    } finally {
      setInviteBusy(false);
    }
  };

  const handleUnlinkParent = async (linkId: string) => {
    setInviteBusy(true);
    setInviteError(null);
    try {
      await unlinkObserverLink(linkId);
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : 'Unable to unlink observer'
      );
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(null), 2200);
    } catch {
      // ignore clipboard errors
    }
  };

  const uiLocales = languages.filter((l) => l.enabled && l.uiEnabled);
  const learningLocales = languages.filter((l) => l.enabled && l.learningEnabled);
  const explanationLocales = languages.filter(
    (l) => l.enabled && l.explanationEnabled
  );
  const narrationLocales = languages.filter((l) => l.enabled && l.ttsEnabled);

  const activeInvites = invites.filter(
    (inv) =>
      inv.status === 'active' && new Date(inv.expiresAt).getTime() > Date.now()
  );

  return (
    <div className="space-y-8">
      <div className="max-w-3xl space-y-2">
        <p className="text-xs font-semibold text-accent uppercase tracking-wider">
          {isVi ? 'Tài khoản học sinh tự học' : 'Independent Student Account'}
        </p>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
          {isVi
            ? `Không gian tự học của ${studentProfile.nickname}`
            : `${studentProfile.nickname}'s Self-Study Hub`}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          {isVi
            ? 'Bạn toàn quyền quản lý mục tiêu học tập, ngôn ngữ, tốc độ nghe và quyền chia sẻ tiến độ (chỉ xem) với phụ huynh.'
            : 'You have full ownership of your learning goals, language settings, audio pace, and optional read-only parent sharing.'}
        </p>
      </div>

      {/* Top Student Metrics Strip */}
      <section className="surface-card rounded-2xl grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 dark:divide-slate-800">
        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isVi ? 'Bài học đã hoàn thành' : 'Lessons completed'}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 tabular-nums">
            {completedLessonsCount}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {totalActivitiesCompleted} {isVi ? 'hoạt động đã qua' : 'activities done'}
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isVi ? 'Chuỗi ngày tự học' : 'Study streak'}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 tabular-nums inline-flex items-center gap-1.5">
            <Flame className="w-6 h-6 text-amber-500" aria-hidden="true" />
            <span>{effectiveStreak}</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {weeklySummary.activeDaysCount}/7 {isVi ? 'ngày gần nhất' : 'active last 7d'}
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isVi ? 'Mục tiêu mỗi ngày' : 'Daily self-goal'}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 tabular-nums">
            {studentProfile.preferences.dailyMinutesLimit}{' '}
            <span className="text-sm font-medium text-slate-500">
              {messages.parent.minutesUnit}
            </span>
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            {isVi ? 'Không khóa giờ học' : 'No time lockouts'}
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isVi ? 'Từ vựng cần ôn' : 'Words to review'}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 tabular-nums">
            {trickyCount}
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {masteredCount} {isVi ? 'đã thuộc' : 'mastered'}
            </span>
            {onOpenWordReview && trickyCount > 0 && (
              <button
                type="button"
                onClick={onOpenWordReview}
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline cursor-pointer"
              >
                <Brain className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isVi ? 'Ôn ngay' : 'Review'}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: Profile + Study Preferences */}
        <div className="lg:col-span-7 space-y-6">
          <form
            onSubmit={handleSaveProfile}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2">
                <GraduationCap
                  className="w-5 h-5 text-accent"
                  aria-hidden="true"
                />
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {isVi ? 'Hồ sơ & Cấp học của bạn' : 'Your Profile & Grade'}
                </h2>
              </div>
              {profileSaved && (
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {messages.parent.savedNotice}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isVi ? 'Tên hiển thị' : 'Display name'}
                </span>
                <input
                  type="text"
                  required
                  maxLength={32}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isVi ? 'Độ tuổi' : 'Age'}
                </span>
                <select
                  value={ageYears}
                  onChange={(e) => {
                    const nextAge = Number(e.target.value);
                    setAgeYears(nextAge);
                    setGradeLevel(
                      nextAge <= 5
                        ? 0
                        : Math.min(12, Math.max(1, nextAge - 5))
                    );
                    const matched = matchAgeGroup(nextAge);
                    if (matched) setAgeBand(matched.id);
                  }}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  {Array.from({ length: 16 }, (_, idx) => idx + 3).map(
                    (age) => (
                      <option key={age} value={age}>
                        {age} {isVi ? 'tuổi' : 'yrs'}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isVi ? 'Khối lớp' : 'Grade'}
                </span>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value={0}>{isVi ? 'Mầm non' : 'Pre-K'}</option>
                  {Array.from({ length: 12 }, (_, idx) => idx + 1).map((g) => (
                    <option key={g} value={g}>
                      {isVi ? `Lớp ${g}` : `Grade ${g}`}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isVi ? 'Nhóm lộ trình học' : 'Curriculum pathway'}
                </span>
                <select
                  value={ageBand}
                  onChange={(e) => setAgeBand(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  {ageGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {isVi ? g.displayNames.vi : g.displayNames.en} ({g.cefrRange})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                {AVATAR_TONES.map((tone) => (
                  <button
                    key={tone.id}
                    type="button"
                    onClick={() => setAvatarTone(tone.id)}
                    aria-label={isVi ? tone.labelVi : tone.labelEn}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center border cursor-pointer ${
                      avatarTone === tone.id
                        ? 'border-slate-900 dark:border-white ring-2 ring-slate-900/20 dark:ring-white/25'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full ${tone.dotClass}`} />
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-2.5 min-h-[42px] rounded-xl btn-accent text-sm font-semibold disabled:opacity-50 cursor-pointer"
              >
                {isVi ? 'Lưu hồ sơ' : 'Save profile'}
              </button>
            </div>
          </form>

          {/* Languages & Self-Study Goal */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {isVi ? 'Ngôn ngữ & Mục tiêu tự học' : 'Languages & Study Goals'}
              </h2>
              {prefSaved && (
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
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
                  value={studentProfile.preferences.interfaceLocale}
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
                  value={studentProfile.preferences.learningLocale}
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
                  value={studentProfile.preferences.explanationLocale}
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
                  value={studentProfile.preferences.narrationLocale}
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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm tabular-nums">
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    {isVi
                      ? 'Mục tiêu tự học mỗi ngày (chỉ nhắc nhẹ, không khóa)'
                      : 'Daily study target (soft goal, never locks)'}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {studentProfile.preferences.dailyMinutesLimit}{' '}
                    {messages.parent.minutesUnit}
                  </span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={120}
                  step={5}
                  value={studentProfile.preferences.dailyMinutesLimit}
                  onChange={(e) =>
                    void handlePrefChange({
                      dailyMinutesLimit: Number(e.target.value),
                    })
                  }
                  className="w-full accent-sky-600"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm tabular-nums">
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    {isVi ? 'Tốc độ đọc phát âm mặc định' : 'Default speech speed'}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {studentProfile.preferences.audioSpeed.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.75}
                  max={1.4}
                  step={0.05}
                  value={studentProfile.preferences.audioSpeed}
                  onChange={(e) =>
                    void handlePrefChange({
                      audioSpeed: Number(e.target.value),
                    })
                  }
                  className="w-full accent-indigo-600"
                />
              </div>

              <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                <span>{messages.parent.reducedMotion}</span>
                <input
                  type="checkbox"
                  checked={studentProfile.preferences.reducedMotion}
                  onChange={(e) =>
                    void handlePrefChange({ reducedMotion: e.target.checked })
                  }
                  className="w-4 h-4 accent-sky-600"
                />
              </label>
            </div>
          </section>
        </div>

        {/* Right column: Parent Read-Only Observer Link + Account */}
        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 inline-flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-accent" aria-hidden="true" />
                  <span>
                    {isVi
                      ? 'Chia sẻ tiến độ với Phụ huynh'
                      : 'Parent Read-Only Link'}
                  </span>
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {isVi
                    ? 'Tạo mã 6 ký tự nếu bạn muốn ba mẹ xem thống kê tiến độ học. Phụ huynh chỉ có quyền xem, không thể thay đổi cài đặt hay khóa tài khoản của bạn.'
                    : 'Generate a 6-character code if you want a parent to view your study summary. Parents only have read-only access and cannot lock or alter your account.'}
                </p>
              </div>
            </div>

            {inviteError && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-800 dark:text-rose-200">
                {inviteError}
              </div>
            )}

            <button
              type="button"
              disabled={inviteBusy || authUser.emailVerified === false}
              onClick={() => void handleGenerateInvite()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl btn-accent text-sm font-semibold disabled:opacity-50 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" aria-hidden="true" />
              <span>
                {isVi
                  ? 'Tạo mã liên kết mới (Hiệu lực 7 ngày)'
                  : 'Generate 6-char Link Code (7-day expiry)'}
              </span>
            </button>

            {activeInvites.length > 0 && (
              <div className="space-y-2.5 pt-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {isVi ? 'Mã đang chờ phụ huynh nhập:' : 'Active invite codes:'}
                </p>
                {activeInvites.map((inv) => (
                  <div
                    key={inv.inviteCode}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5"
                  >
                    <div>
                      <p className="font-mono text-lg font-bold tracking-[0.2em] text-slate-900 dark:text-slate-50">
                        {inv.inviteCode}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {isVi ? 'Hết hạn:' : 'Expires:'}{' '}
                        {new Date(inv.expiresAt).toLocaleDateString(
                          isVi ? 'vi-VN' : 'en-US'
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleCopyCode(inv.inviteCode)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        {copiedCode === inv.inviteCode ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        <span>
                          {copiedCode === inv.inviteCode
                            ? isVi
                              ? 'Đã chép'
                              : 'Copied'
                            : isVi
                              ? 'Sao chép'
                              : 'Copy'}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={inviteBusy}
                        onClick={() => void handleRevokeInvite(inv.inviteCode)}
                        aria-label={isVi ? 'Thu hồi mã' : 'Revoke code'}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:border-rose-300 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Active Linked Parents */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span>
                  {isVi
                    ? `Phụ huynh đang theo dõi (${observerLinks.length})`
                    : `Connected parent observers (${observerLinks.length})`}
                </span>
              </p>

              {observerLinks.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isVi
                    ? 'Chưa có phụ huynh nào liên kết. Tài khoản đang ở chế độ hoàn toàn riêng tư.'
                    : 'No parent linked yet. Your account is completely private.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {observerLinks.map((link) => (
                    <div
                      key={link.linkId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {link.parentDisplayName}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isVi ? 'Quyền chỉ xem tiến độ' : 'Read-only observer'}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={inviteBusy}
                        onClick={() => void handleUnlinkParent(link.linkId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] rounded-lg border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer shrink-0"
                      >
                        <Unlink className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{isVi ? 'Ngắt kết nối' : 'Unlink'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Account Card */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck
                className="w-5 h-5 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {isVi ? 'Tài khoản đám mây' : 'Cloud Account'}
              </h2>
            </div>

            <div className="space-y-1 text-sm">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {authUser.displayName ?? studentProfile.nickname}
              </p>
              {authUser.email && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {authUser.email}
                </p>
              )}
              <p className="text-xs text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1 pt-1">
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {isVi
                    ? 'Hồ sơ & tiến độ được đồng bộ trực tiếp lên Firebase Firestore.'
                    : 'Profile & progress synced live to Firebase Firestore.'}
                </span>
              </p>
            </div>

            <button
              type="button"
              disabled={authBusy}
              onClick={() => void onSignOut()}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>{messages.parent.signOutButton}</span>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

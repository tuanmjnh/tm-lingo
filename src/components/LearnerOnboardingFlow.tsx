'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GraduationCap,
  Loader2,
  Users,
} from 'lucide-react';
import type {
  AccountType,
  AgeGroupConfig,
  LearnerProfile,
  LocaleConfig,
} from '../../packages/contracts/types';

interface LearnerOnboardingFlowProps {
  interfaceLocale: string;
  ageGroups: AgeGroupConfig[];
  languages: LocaleConfig[];
  initialAgeBand?: string | null;
  parentEmail?: string | null;
  onComplete: (payload: {
    accountType: AccountType;
    nickname: string;
    ageYears: number;
    ageBand: string;
    gradeLevel: number | null;
    avatarTone: LearnerProfile['avatarTone'];
    learningLocale: string;
    explanationLocale: string;
  }) => Promise<void>;
}

const AVATAR_TONES: Array<{
  id: LearnerProfile['avatarTone'];
  labelVi: string;
  labelEn: string;
  swatch: string;
}> = [
  { id: 'sky', labelVi: 'Xanh dương', labelEn: 'Sky', swatch: '#0284C7' },
  {
    id: 'emerald',
    labelVi: 'Ngọc lục bảo',
    labelEn: 'Emerald',
    swatch: '#059669',
  },
  { id: 'amber', labelVi: 'Hổ phách', labelEn: 'Amber', swatch: '#D97706' },
  { id: 'rose', labelVi: 'San hô', labelEn: 'Rose', swatch: '#E11D48' },
];

function isTeenBand(group: AgeGroupConfig | null | undefined): boolean {
  if (!group) return false;
  return (
    group.minAge >= 12 ||
    group.stage === 'middle_school' ||
    group.stage === 'high_school'
  );
}

export function LearnerOnboardingFlow({
  interfaceLocale,
  ageGroups,
  languages,
  initialAgeBand,
  parentEmail,
  onComplete,
}: LearnerOnboardingFlowProps) {
  const isVi = interfaceLocale === 'vi';
  const [step, setStep] = useState<1 | 2>(1);

  const initialMatchedGroup =
    ageGroups.find((g) => g.id === initialAgeBand) ?? ageGroups[0] ?? null;

  const [accountType, setAccountType] = useState<AccountType>(() =>
    isTeenBand(initialMatchedGroup) ? 'student' : 'parent'
  );
  const [nickname, setNickname] = useState('');

  const [selectedBandId, setSelectedBandId] = useState<string>(
    initialMatchedGroup?.id ?? '3-5'
  );
  const [ageYears, setAgeYears] = useState<number>(
    initialMatchedGroup
      ? Math.round((initialMatchedGroup.minAge + initialMatchedGroup.maxAge) / 2)
      : 4
  );
  const [gradeLevel, setGradeLevel] = useState<number>(
    initialMatchedGroup && initialMatchedGroup.grades.length > 0
      ? initialMatchedGroup.grades[0]
      : 0
  );
  const [avatarTone, setAvatarTone] =
    useState<LearnerProfile['avatarTone']>('sky');
  const [learningLocale, setLearningLocale] = useState<string>('en');
  const [explanationLocale, setExplanationLocale] = useState<string>(
    interfaceLocale === 'en' ? 'en' : 'vi'
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialAgeBand && ageGroups.some((g) => g.id === initialAgeBand)) {
      const g = ageGroups.find((x) => x.id === initialAgeBand)!;
      setAccountType(isTeenBand(g) ? 'student' : 'parent');
      setSelectedBandId(g.id);
      setAgeYears(Math.round((g.minAge + g.maxAge) / 2));
      setGradeLevel(g.grades.length > 0 ? g.grades[0] : 0);
    }
  }, [initialAgeBand, ageGroups]);

  const handleChooseAccountType = (nextType: AccountType) => {
    setAccountType(nextType);
    if (nextType === 'student') {
      const teenGroup =
        ageGroups.find((g) => isTeenBand(g)) ??
        ageGroups.find((g) => g.maxAge >= 12) ??
        ageGroups[ageGroups.length - 1];
      if (teenGroup && ageYears < 12) {
        setSelectedBandId(teenGroup.id);
        setAgeYears(Math.max(12, Math.round((teenGroup.minAge + teenGroup.maxAge) / 2)));
        setGradeLevel(teenGroup.grades.length > 0 ? teenGroup.grades[0] : 7);
      }
    } else {
      const childGroup =
        ageGroups.find((g) => !isTeenBand(g)) ?? ageGroups[0];
      if (childGroup && ageYears >= 12) {
        setSelectedBandId(childGroup.id);
        setAgeYears(Math.round((childGroup.minAge + childGroup.maxAge) / 2));
        setGradeLevel(childGroup.grades.length > 0 ? childGroup.grades[0] : 0);
      }
    }
  };

  const activeGroup =
    ageGroups.find((g) => g.id === selectedBandId) ??
    ageGroups.find((g) => ageYears >= g.minAge && ageYears <= g.maxAge) ??
    ageGroups[0] ??
    null;

  const learningLocales = languages.filter((l) => l.enabled && l.learningEnabled);
  const explanationLocales = languages.filter(
    (l) => l.enabled && l.explanationEnabled
  );

  const handleSelectGroup = (group: AgeGroupConfig) => {
    setSelectedBandId(group.id);
    const midAge = Math.round((group.minAge + group.maxAge) / 2);
    setAgeYears(midAge);
    setGradeLevel(group.grades.length > 0 ? group.grades[0] : 0);
  };

  const handleAgeChange = (nextAge: number) => {
    setAgeYears(nextAge);
    const matched = ageGroups.find(
      (g) => nextAge >= g.minAge && nextAge <= g.maxAge
    );
    if (matched) {
      setSelectedBandId(matched.id);
    }
    setGradeLevel(nextAge >= 6 ? Math.min(12, Math.max(1, nextAge - 5)) : 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError(
        accountType === 'student'
          ? isVi
            ? 'Vui lòng nhập tên của bạn.'
            : 'Please enter your name.'
          : isVi
            ? 'Vui lòng nhập tên gọi của bé.'
            : 'Please enter the learner’s name.'
      );
      setStep(1);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onComplete({
        accountType,
        nickname: nickname.trim(),
        ageYears,
        ageBand: activeGroup?.id ?? selectedBandId,
        gradeLevel,
        avatarTone,
        learningLocale,
        explanationLocale,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isVi
            ? 'Không thể tạo hồ sơ học viên lúc này.'
            : 'Unable to create learner profile right now.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isStudentMode = accountType === 'student';

  return (
    <div className="max-w-3xl mx-auto py-4 sm:py-8 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {isVi ? `Bước ${step} / 2` : `Step ${step} of 2`}
          </span>
          {parentEmail && (
            <>
              <span aria-hidden="true">·</span>
              <span>{parentEmail}</span>
            </>
          )}
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {step === 1
            ? isVi
              ? 'Chọn loại tài khoản & lứa tuổi học'
              : 'Choose account mode & learning stage'
            : isVi
              ? 'Chọn ngôn ngữ học tập'
              : 'Choose learning languages'}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
          {step === 1
            ? isVi
              ? 'Hồ sơ sẽ được lưu an toàn trên đám mây (Firebase Firestore) để đồng bộ trên mọi thiết bị.'
              : 'Your profile is stored securely in Firebase Firestore and syncs across all devices.'
            : isStudentMode
              ? isVi
                ? 'Chọn ngôn ngữ muốn học và ngôn ngữ giải thích. Bạn luôn có thể chỉnh sửa trong mục Tự học.'
                : 'Pick your target and helper languages. You can update these anytime in your Self-Study Hub.'
              : isVi
                ? 'Chọn ngôn ngữ muốn học và ngôn ngữ hỗ trợ giải thích. Bạn luôn có thể thay đổi lại bất cứ lúc nào trong Góc Phụ huynh.'
                : 'Pick the target language and helper explanation language. You can update these anytime.'}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6"
      >
        {step === 1 ? (
          <>
            {/* Account Mode Selector: Parent (Family 3-11) vs Independent Student (12-18) */}
            <div className="space-y-2.5">
              <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                {isVi ? 'Ai sẽ sử dụng tài khoản này? *' : 'Who will use this account? *'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleChooseAccountType('parent')}
                  aria-pressed={!isStudentMode}
                  className={`text-left rounded-xl border p-4 space-y-1.5 transition-colors cursor-pointer ${
                    !isStudentMode
                      ? 'border-accent bg-accent-soft'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                      <Users className="w-4 h-4 text-accent" aria-hidden="true" />
                      <span>
                        {isVi ? 'Phụ huynh / Gia đình' : 'Parent / Family'}
                      </span>
                    </span>
                    {!isStudentMode && (
                      <Check className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {isVi
                      ? 'Tạo và quản lý nhiều hồ sơ cho bé Mầm non – Tiểu học (3–11 tuổi), giới hạn giờ học & theo dõi con Cấp 2–3.'
                      : 'Manage child profiles (ages 3–11), set daily limits, and optionally view linked teen progress.'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleChooseAccountType('student')}
                  aria-pressed={isStudentMode}
                  className={`text-left rounded-xl border p-4 space-y-1.5 transition-colors cursor-pointer ${
                    isStudentMode
                      ? 'border-accent bg-accent-soft'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                      <GraduationCap className="w-4 h-4 text-accent" aria-hidden="true" />
                      <span>
                        {isVi ? 'Học sinh tự học (Cấp 2–3)' : 'Independent Student (12–18)'}
                      </span>
                    </span>
                    {isStudentMode && (
                      <Check className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {isVi
                      ? 'Tài khoản độc lập cho học sinh THCS & THPT (12–18 tuổi). Tự chủ mục tiêu, không khóa giờ học, có thể tạo mã để ba mẹ chỉ xem tiến độ.'
                      : 'Self-managed account for Middle & High School learners (12–18). No lockouts, optional read-only parent link.'}
                  </p>
                </button>
              </div>
            </div>

            {/* Learner Name */}
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {isStudentMode
                  ? isVi
                    ? 'Tên của bạn *'
                    : 'Your name *'
                  : isVi
                    ? 'Tên gọi hoặc biệt danh của bé *'
                    : 'Child name or nickname *'}
              </span>
              <input
                type="text"
                required
                maxLength={32}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={
                  isStudentMode
                    ? isVi
                      ? 'Ví dụ: Minh Khôi, Gia Hân...'
                      : 'e.g. Alex, Mia...'
                    : isVi
                      ? 'Ví dụ: Bé Bông, Minh Khôi...'
                      : 'e.g. Mia, Liam...'
                }
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              />
            </label>

            {/* Choose K-12 Age Group Cards */}
            <div className="space-y-2.5">
              <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                {isVi ? 'Chọn nhóm tuổi / cấp học *' : 'Select age group / stage *'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ageGroups.map((group) => {
                  const selected = activeGroup?.id === group.id;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => handleSelectGroup(group)}
                      aria-pressed={selected}
                      className={`text-left rounded-xl border p-4 space-y-1.5 transition-colors cursor-pointer ${
                        selected
                          ? 'border-accent bg-accent-soft'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                          {group.minAge}–{group.maxAge} {isVi ? 'tuổi' : 'yrs'} ·{' '}
                          {group.cefrRange}
                        </span>
                        {selected && (
                          <Check className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
                        )}
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {isVi ? group.gradeRange.vi : group.gradeRange.en}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {isVi ? group.descriptions.vi : group.descriptions.en}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Exact Age & Grade Refinement */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isVi ? 'Tuổi cụ thể' : 'Exact age'}
                </span>
                <select
                  value={ageYears}
                  onChange={(e) => handleAgeChange(Number(e.target.value))}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  {Array.from({ length: 16 }, (_, idx) => idx + 3).map((age) => (
                    <option key={age} value={age}>
                      {age} {isVi ? 'tuổi' : 'years old'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isVi ? 'Cấp lớp hiện tại' : 'Current grade'}
                </span>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(Number(e.target.value))}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value={0}>
                    {isVi ? 'Mầm non (Chưa vào lớp 1)' : 'Preschool'}
                  </option>
                  {Array.from({ length: 12 }, (_, idx) => idx + 1).map((g) => (
                    <option key={g} value={g}>
                      {isVi ? `Lớp ${g}` : `Grade ${g}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {activeGroup && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-4 py-3 text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {isVi ? 'Lộ trình đề xuất:' : 'Matched pathway:'}{' '}
                  {isVi ? activeGroup.displayNames.vi : activeGroup.displayNames.en}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {activeGroup.uiProfile.defaultDailyMinutes}{' '}
                  {isVi ? 'phút/ngày' : 'min/day'}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {isVi ? 'Tốc độ đọc' : 'Audio'} {activeGroup.uiProfile.defaultAudioSpeed}x
                </span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  if (!nickname.trim()) {
                    setError(
                      isStudentMode
                        ? isVi
                          ? 'Vui lòng nhập tên của bạn trước khi tiếp tục.'
                          : 'Please enter your name first.'
                        : isVi
                          ? 'Vui lòng nhập tên gọi của bé trước khi tiếp tục.'
                          : 'Please enter the learner’s name first.'
                    );
                    return;
                  }
                  setError(null);
                  setStep(2);
                }}
                className="inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-xl btn-accent text-sm font-semibold cursor-pointer"
              >
                <span>{isVi ? 'Tiếp tục chọn ngôn ngữ' : 'Continue to languages'}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {isVi ? 'Ngôn ngữ muốn học' : 'Target learning language'}
                </span>
                <select
                  value={learningLocale}
                  onChange={(e) => setLearningLocale(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  {(learningLocales.length > 0
                    ? learningLocales
                    : [{ locale: 'en', nativeName: 'English' }]
                  ).map((loc) => (
                    <option key={loc.locale} value={loc.locale}>
                      {loc.nativeName} ({loc.locale.toUpperCase()})
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {isVi ? 'Ngôn ngữ giải thích' : 'Explanation language'}
                </span>
                <select
                  value={explanationLocale}
                  onChange={(e) => setExplanationLocale(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  {(explanationLocales.length > 0
                    ? explanationLocales
                    : [
                        { locale: 'vi', nativeName: 'Tiếng Việt' },
                        { locale: 'en', nativeName: 'English' },
                      ]
                  ).map((loc) => (
                    <option key={loc.locale} value={loc.locale}>
                      {loc.nativeName} ({loc.locale.toUpperCase()})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Avatar color */}
            <div className="space-y-2">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {isVi ? 'Màu biểu tượng hồ sơ' : 'Profile badge color'}
              </span>
              <div className="flex flex-wrap gap-2.5">
                {AVATAR_TONES.map((tone) => {
                  const selected = avatarTone === tone.id;
                  return (
                    <button
                      key={tone.id}
                      type="button"
                      onClick={() => setAvatarTone(tone.id)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                        selected
                          ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: tone.swatch }}
                      />
                      <span>{isVi ? tone.labelVi : tone.labelEn}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>{isVi ? 'Quay lại' : 'Back'}</span>
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-xl btn-accent text-sm font-semibold disabled:opacity-60 cursor-pointer"
              >
                {submitting && (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                )}
                <span>
                  {isStudentMode
                    ? isVi
                      ? 'Hoàn tất & Bắt đầu tự học'
                      : 'Finish & Start Self-Study'
                    : isVi
                      ? 'Hoàn tất & Mở bài học theo tuổi'
                      : 'Finish & Open Age-Matched Lessons'}
                </span>
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

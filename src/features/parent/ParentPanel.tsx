import { useState } from 'react';
import {
  Check,
  ChevronRight,
  LogIn,
  LogOut,
  Plus,
  ShieldCheck,
  User,
  UserPlus,
} from 'lucide-react';
import type {
  AuthUserProfile,
  LearnerPreferences,
  LearnerProfile,
  LessonProgressRecord,
  LocaleConfig,
} from '../../../packages/contracts/types';
import type { UiMessages } from '../../i18n/messages';

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
  onOpenAdmin: () => void;
  learners: LearnerProfile[];
  activeLearner: LearnerProfile;
  languages: LocaleConfig[];
  progressRecords: LessonProgressRecord[];
  messages: UiMessages;
  onSelectLearner: (learnerId: string) => void;
  onCreateLearner: (payload: {
    nickname: string;
    ageYears: number;
    avatarTone: LearnerProfile['avatarTone'];
  }) => Promise<void>;
  onUpdatePreferences: (patch: Partial<LearnerPreferences>) => Promise<void>;
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
  onOpenAdmin,
  learners,
  activeLearner,
  languages,
  progressRecords,
  messages,
  onSelectLearner,
  onCreateLearner,
  onUpdatePreferences,
}: ParentPanelProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [nickname, setNickname] = useState('');
  const [ageYears, setAgeYears] = useState(4);
  const [avatarTone, setAvatarTone] =
    useState<LearnerProfile['avatarTone']>('emerald');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

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

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    setSaving(true);
    try {
      await onCreateLearner({
        nickname: nickname.trim(),
        ageYears,
        avatarTone,
      });
      setNickname('');
      setShowCreateForm(false);
    } finally {
      setSaving(false);
    }
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
        <h1 className="text-3xl font-bold text-slate-900">
          {messages.parent.heading}
        </h1>
        <p className="text-base text-slate-600 leading-relaxed">
          {messages.parent.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: Learner Profiles & Independent Locale Settings */}
        <div className="lg:col-span-7 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-slate-900">
                {messages.parent.profilesHeading}
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateForm((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
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
                        ? 'border-sky-500 bg-sky-50/50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${AVATAR_STYLES[profile.avatarTone]}`}
                    >
                      <User className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 truncate">
                        {profile.nickname}
                      </p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {profile.ageYears}y ·{' '}
                        {profile.preferences.learningLocale.toUpperCase()} /{' '}
                        {profile.preferences.explanationLocale.toUpperCase()}
                      </p>
                    </div>
                    {isActive && (
                      <Check
                        className="w-4 h-4 text-sky-600 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {showCreateForm && (
              <form
                onSubmit={handleCreateSubmit}
                className="pt-4 border-t border-slate-100 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      placeholder="Bé Bông"
                      className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-700">
                      {messages.parent.ageLabel}
                    </span>
                    <select
                      value={ageYears}
                      onChange={(e) => setAgeYears(Number(e.target.value))}
                      className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    >
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                      <option value={5}>5</option>
                    </select>
                  </label>
                </div>

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

          <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">
                  {messages.parent.languageHeading}
                </h2>
                <p className="text-sm text-slate-600">
                  {messages.parent.languageNote}
                </p>
              </div>
              {savedNotice && (
                <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">
                  {messages.parent.savedNotice}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">
                  {messages.parent.interfaceLocale}
                </span>
                <select
                  value={activeLearner.preferences.interfaceLocale}
                  onChange={(e) =>
                    void handlePrefChange({ interfaceLocale: e.target.value })
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                >
                  {uiLocales.map((l) => (
                    <option key={l.locale} value={l.locale}>
                      {l.nativeName} ({l.locale})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">
                  {messages.parent.learningLocale}
                </span>
                <select
                  value={activeLearner.preferences.learningLocale}
                  onChange={(e) =>
                    void handlePrefChange({ learningLocale: e.target.value })
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                >
                  {learningLocales.map((l) => (
                    <option key={l.locale} value={l.locale}>
                      {l.nativeName} ({l.locale})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">
                  {messages.parent.explanationLocale}
                </span>
                <select
                  value={activeLearner.preferences.explanationLocale}
                  onChange={(e) =>
                    void handlePrefChange({ explanationLocale: e.target.value })
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                >
                  {explanationLocales.map((l) => (
                    <option key={l.locale} value={l.locale}>
                      {l.nativeName} ({l.locale})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700">
                  {messages.parent.narrationLocale}
                </span>
                <select
                  value={activeLearner.preferences.narrationLocale}
                  onChange={(e) =>
                    void handlePrefChange({ narrationLocale: e.target.value })
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                >
                  {narrationLocales.map((l) => (
                    <option key={l.locale} value={l.locale}>
                      {l.nativeName} ({l.locale})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                {messages.parent.accessibilityHeading}
              </h3>

              <label className="flex items-center justify-between text-sm text-slate-700 cursor-pointer">
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

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm text-slate-700 tabular-nums">
                  <span>{messages.parent.dailyLimit}</span>
                  <span className="font-semibold">
                    {activeLearner.preferences.dailyMinutesLimit}{' '}
                    {messages.parent.minutesUnit}
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={30}
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
          <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">
              {messages.parent.accountHeading}
            </h2>
            {authUser ? (
              <div className="space-y-3">
                <div className="text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">
                    {authUser.displayName ?? authUser.email ?? 'Parent'}
                  </p>
                  {authUser.email && (
                    <p className="text-xs text-slate-500">
                      {authUser.email} ·{' '}
                      <span className="font-medium text-slate-700">
                        {authUser.role === 'admin'
                          ? messages.parent.roleAdmin
                          : authUser.role === 'teacher'
                            ? messages.parent.roleTeacher
                            : messages.parent.roleParent}
                      </span>
                    </p>
                  )}
                  <p className="mt-1.5 text-xs font-medium text-emerald-700">
                    {messages.parent.accountSignedInNote}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void onSignOut()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
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
                  <svg
                    className="w-4 h-4 shrink-0"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.29A7.18 7.18 0 0 1 4.9 12c0-.79.14-1.56.38-2.29V6.62H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l3.99-3.09Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.99 3.09c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
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

          <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">
              {messages.parent.progressHeading}
            </h2>
            {progressRecords.length === 0 ? (
              <p className="text-sm text-slate-500">
                {messages.parent.noProgressYet}
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {progressRecords.map((rec) => (
                  <div
                    key={`${rec.lessonId}-${rec.learningLocale}-${rec.mode}`}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Fruits · {rec.mode}
                      </p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        Locale: {rec.learningLocale.toUpperCase()} ·{' '}
                        {rec.completedActivityIds.length}/{rec.totalActivities}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        rec.completed ? 'text-emerald-700' : 'text-sky-700'
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

          {authUser &&
            (authUser.role === 'admin' || authUser.role === 'teacher') && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
              <div className="flex items-center gap-2 text-slate-900">
                <ShieldCheck
                  className="w-5 h-5 text-sky-600 shrink-0"
                  aria-hidden="true"
                />
                <h2 className="text-base font-bold">
                  {messages.parent.openAdminTitle}
                </h2>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                {messages.parent.openAdminDesc}
              </p>
              <button
                type="button"
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span>{messages.parent.openAdminButton}</span>
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

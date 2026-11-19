import { useState } from 'react';
import { Check, LogIn, LogOut, Plus, User } from 'lucide-react';
import type {
  LearnerPreferences,
  LearnerProfile,
  LessonProgressRecord,
  LocaleConfig,
} from '../../../packages/contracts/types';
import type { UiMessages } from '../../i18n/messages';

interface ParentPanelProps {
  authUser: { uid: string; displayName: string | null; email: string | null } | null;
  authBusy: boolean;
  authError: string | null;
  onSignInGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
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
  onSignInGoogle,
  onSignOut,
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

        {/* Right column: Parent Account, Gentle Progress & Language Registry */}
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
                    <p className="text-xs text-slate-500">{authUser.email}</p>
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
                  className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <LogIn className="w-4 h-4" aria-hidden="true" />
                  <span className="whitespace-nowrap">
                    {messages.parent.signInGoogle}
                  </span>
                </button>
              </div>
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

          <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">
              {messages.parent.registryHeading}
            </h2>
            <div className="divide-y divide-slate-100 text-sm">
              {languages.map((lang) => (
                <div
                  key={lang.locale}
                  className="py-3 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {lang.nativeName}{' '}
                      <span className="font-normal text-slate-500">
                        ({lang.locale})
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      UI: {lang.uiEnabled ? 'Yes' : 'No'} · Learn:{' '}
                      {lang.learningEnabled ? 'Yes' : 'No'} · TTS:{' '}
                      {lang.ttsEnabled ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      lang.contentStatus === 'ready'
                        ? 'text-emerald-700'
                        : 'text-slate-500'
                    }`}
                  >
                    {lang.contentStatus === 'ready'
                      ? messages.parent.statusReady
                      : messages.parent.statusPlanned}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

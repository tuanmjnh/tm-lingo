import { useCallback, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import type {
  ExperienceMode,
  LearnerPreferences,
  LearnerProfile,
  LessonProgressRecord,
  LocaleConfig,
} from '../packages/contracts/types';
import { auth, googleProvider } from './firebase';
import { apiClient } from './shared/apiClient';
import {
  createFirestoreLearner,
  ensureParentAccount,
  seedStarterLearnerIfEmpty,
  subscribeLearners,
  subscribeProgress,
  updateFirestoreLearnerPreferences,
} from './shared/firestoreService';
import { getUiMessages } from './i18n/messages';
import { AssetImage } from './components/AssetImage';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { LessonPlayer } from './features/lesson-player/LessonPlayer';
import { StoryReader } from './features/story-reader/StoryReader';
import { ParentPanel } from './features/parent/ParentPanel';
import { NotificationManager } from './features/notifications/NotificationManager';

type AppTab = 'learn' | 'stories' | 'notifications' | 'parents';

function getInitialTab(): AppTab {
  if (typeof window === 'undefined') return 'learn';
  const param = new URLSearchParams(window.location.search).get('tab');
  if (
    param === 'stories' ||
    param === 'notifications' ||
    param === 'parents'
  ) {
    return param;
  }
  return 'learn';
}

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>(getInitialTab);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [languages, setLanguages] = useState<LocaleConfig[]>([]);
  const [learners, setLearners] = useState<LearnerProfile[]>([]);
  const [activeLearnerId, setActiveLearnerId] = useState<string>('');
  const [progressRecords, setProgressRecords] = useState<LessonProgressRecord[]>(
    []
  );
  const [experienceMode, setExperienceMode] =
    useState<ExperienceMode>('guided');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  const loadLocalBootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [langRes, learnerRes] = await Promise.all([
        apiClient.getLanguages(),
        apiClient.getLearners(),
      ]);
      setLanguages(langRes.languages);
      if (!authUser) {
        setLearners(learnerRes.learners);
        if (learnerRes.learners.length > 0) {
          setActiveLearnerId((prev) => prev || learnerRes.learners[0].id);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to connect to TM-Lingo API'
      );
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    if (authReady) {
      void loadLocalBootstrap();
    }
  }, [authReady, loadLocalBootstrap]);

  // Attach Firestore learners listener ONLY when authenticated
  useEffect(() => {
    if (!authReady || !authUser) return;

    let unsubLearners: (() => void) | null = null;
    let cancelled = false;

    const initCloudSync = async () => {
      try {
        await ensureParentAccount(
          authUser.uid,
          authUser.displayName ?? authUser.email ?? 'Parent'
        );
        await seedStarterLearnerIfEmpty(authUser.uid);
        if (cancelled) return;
        unsubLearners = subscribeLearners(authUser.uid, (cloudLearners) => {
          setLearners(cloudLearners);
          if (cloudLearners.length > 0) {
            setActiveLearnerId((prev) =>
              cloudLearners.some((l) => l.id === prev)
                ? prev
                : cloudLearners[0].id
            );
          }
        });
      } catch (err) {
        if (!cancelled) {
          setAuthError(
            err instanceof Error ? err.message : 'Cloud sync initialization failed'
          );
        }
      }
    };

    void initCloudSync();

    return () => {
      cancelled = true;
      unsubLearners?.();
    };
  }, [authReady, authUser]);

  const refreshLocalProgress = useCallback(async (learnerId: string) => {
    if (!learnerId || authUser) return;
    try {
      const res = await apiClient.getProgress(learnerId);
      setProgressRecords(res.progress);
    } catch {
      // non-blocking
    }
  }, [authUser]);

  // Attach Firestore progress listener when signed in, or load local progress when guest
  useEffect(() => {
    if (!activeLearnerId) return;
    if (authUser) {
      return subscribeProgress(authUser.uid, activeLearnerId, (records) => {
        setProgressRecords(records);
      });
    }
    void refreshLocalProgress(activeLearnerId);
    return undefined;
  }, [authUser, activeLearnerId, refreshLocalProgress]);

  const activeLearner =
    learners.find((l) => l.id === activeLearnerId) ?? learners[0] ?? null;

  const messages = getUiMessages(
    activeLearner?.preferences.interfaceLocale ?? 'vi'
  );

  useEffect(() => {
    if (activeLearner?.preferences.interfaceLocale) {
      document.documentElement.lang = activeLearner.preferences.interfaceLocale;
    }
  }, [activeLearner?.preferences.interfaceLocale]);

  const handleSignInGoogle = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Google sign-in was cancelled'
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signOut(auth);
      setProgressRecords([]);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign-out failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleUpdatePreferences = async (patch: Partial<LearnerPreferences>) => {
    if (!activeLearner) return;
    if (authUser) {
      await updateFirestoreLearnerPreferences(
        authUser.uid,
        activeLearner.id,
        patch
      );
      return;
    }
    const res = await apiClient.updateLearnerPreferences(activeLearner.id, patch);
    setLearners((prev) =>
      prev.map((l) => (l.id === res.learner.id ? res.learner : l))
    );
  };

  const handleCreateLearner = async (payload: {
    nickname: string;
    ageYears: number;
    avatarTone: LearnerProfile['avatarTone'];
  }) => {
    const basePrefs = {
      interfaceLocale: activeLearner?.preferences.interfaceLocale ?? 'vi',
      learningLocale: activeLearner?.preferences.learningLocale ?? 'en',
      explanationLocale: activeLearner?.preferences.explanationLocale ?? 'vi',
      narrationLocale: activeLearner?.preferences.narrationLocale ?? 'en',
    };

    if (authUser) {
      const newId = await createFirestoreLearner(authUser.uid, {
        ...payload,
        ...basePrefs,
      });
      setActiveLearnerId(newId);
      return;
    }

    const res = await apiClient.createLearner({
      ...payload,
      ...basePrefs,
    });
    setLearners((prev) => [...prev, res.learner]);
    setActiveLearnerId(res.learner.id);
  };

  const getLocaleName = (code: string) => {
    const match = languages.find((l) => l.locale === code);
    return match ? match.nativeName : code.toUpperCase();
  };

  const scrollToLessonStage = () => {
    setActiveTab('learn');
    setTimeout(() => {
      document
        .getElementById('lesson-stage')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  return (
    <div
      className={`min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] ${
        activeLearner?.preferences.reducedMotion ? 'reduced-motion' : ''
      }`}
    >
      {/* Top Bar Contract: 3 clean zones separated by gap-8 */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('learn')}
            className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            TM-Lingo
          </button>

          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            {(
              [
                ['learn', messages.nav.learn],
                ['stories', messages.nav.stories],
                ['notifications', messages.nav.notifications],
                ['parents', messages.nav.parents],
              ] as const
            ).map(([tabKey, label]) => {
              const isActive = activeTab === tabKey;
              return (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setActiveTab(tabKey)}
                  className={`py-1 whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                    isActive
                      ? 'border-sky-600 text-slate-900 font-semibold'
                      : 'border-transparent hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={scrollToLessonStage}
              className="px-4 py-2 min-h-[40px] rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {messages.nav.startLesson}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-10">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            Loading TM-Lingo...
          </div>
        ) : error || !activeLearner ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 space-y-3">
            <p className="font-semibold text-amber-900">
              {error ?? 'No learner profile available'}
            </p>
            <button
              type="button"
              onClick={() => void loadLocalBootstrap()}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'learn' && (
              <>
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                  <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                      <span>
                        {messages.hero.learningMeta}:{' '}
                        <strong className="text-slate-800">
                          {getLocaleName(
                            activeLearner.preferences.learningLocale
                          )}
                        </strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {messages.hero.explanationMeta}:{' '}
                        <strong className="text-slate-800">
                          {getLocaleName(
                            activeLearner.preferences.explanationLocale
                          )}
                        </strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{messages.hero.ageBand}</span>
                    </div>

                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12]">
                      {messages.hero.greeting}, {activeLearner.nickname}!
                    </h1>

                    <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                      {messages.hero.subtitle}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={scrollToLessonStage}
                        className="px-5 py-3 min-h-[46px] rounded-xl bg-sky-600 text-white font-semibold hover:bg-sky-700 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        {messages.hero.continueButton}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('stories')}
                        className="px-5 py-3 min-h-[46px] rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        {messages.hero.openStoryButton}
                      </button>
                      <PWAInstallButton
                        locale={activeLearner.preferences.interfaceLocale}
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <div className="h-full min-h-[240px] rounded-2xl overflow-hidden border border-slate-200 bg-white">
                      <AssetImage
                        assetRef="img-story-fruit-market"
                        altOverride="Fruit Market learning theme illustration"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </section>

                <div id="lesson-stage" className="scroll-mt-24">
                  <LessonPlayer
                    parentUid={authUser?.uid ?? null}
                    learner={activeLearner}
                    mode={experienceMode}
                    messages={messages}
                    onModeChange={setExperienceMode}
                    onOpenStory={() => setActiveTab('stories')}
                    onProgressUpdated={() =>
                      void refreshLocalProgress(activeLearner.id)
                    }
                  />
                </div>
              </>
            )}

            {activeTab === 'stories' && (
              <StoryReader
                parentUid={authUser?.uid ?? null}
                learner={activeLearner}
                languages={languages}
                messages={messages}
              />
            )}

            {activeTab === 'notifications' && (
              <NotificationManager
                interfaceLocale={activeLearner.preferences.interfaceLocale}
              />
            )}

            {activeTab === 'parents' && (
              <ParentPanel
                authUser={
                  authUser
                    ? {
                        uid: authUser.uid,
                        displayName: authUser.displayName,
                        email: authUser.email,
                      }
                    : null
                }
                authBusy={authBusy}
                authError={authError}
                onSignInGoogle={handleSignInGoogle}
                onSignOut={handleSignOut}
                learners={learners}
                activeLearner={activeLearner}
                languages={languages}
                progressRecords={progressRecords}
                messages={messages}
                onSelectLearner={setActiveLearnerId}
                onCreateLearner={handleCreateLearner}
                onUpdatePreferences={handleUpdatePreferences}
              />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>TM-Lingo · Multilingual Early Language Learning (Ages 3–5)</span>
          <span>
            Interface: {activeLearner?.preferences.interfaceLocale ?? 'vi'} ·
            Learning: {activeLearner?.preferences.learningLocale ?? 'en'}
          </span>
        </div>
      </footer>

      <OfflineIndicator
        locale={activeLearner?.preferences.interfaceLocale ?? 'vi'}
      />
    </div>
  );
}

export default App;

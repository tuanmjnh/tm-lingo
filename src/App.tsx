'use client';

import { useCallback, useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type {
  AuthUserProfile,
  ExperienceMode,
  LearnerPreferences,
  LearnerProfile,
  LessonProgressRecord,
  LocaleConfig,
  MediaAssetRecord,
} from '../packages/contracts/types';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { apiClient } from './shared/apiClient';
import { getUiMessages } from './i18n/messages';
import { AssetImage } from './components/AssetImage';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { NotificationBell } from './components/NotificationBell';
import { LessonPlayer } from './features/lesson-player/LessonPlayer';
import { StoryReader } from './features/story-reader/StoryReader';
import { ParentPanel } from './features/parent/ParentPanel';
import {
  AdminWorkspace,
  type AdminSection,
} from './features/admin/AdminWorkspace';
import { AdminLoginView } from './features/admin/AdminLoginView';

type AppTab = 'learn' | 'stories' | 'parents' | 'admin';

function getInitialTab(): AppTab {
  if (typeof window === 'undefined') return 'learn';
  const param = new URLSearchParams(window.location.search).get('tab');
  if (param === 'stories' || param === 'parents' || param === 'admin') {
    return param;
  }
  return 'learn';
}

function mapSupabaseUser(user: User | null): AuthUserProfile | null {
  if (!user) return null;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const appMeta = user.app_metadata as Record<string, unknown> | undefined;
  const rawRole = appMeta?.role;
  const role =
    rawRole === 'admin' || rawRole === 'teacher' || rawRole === 'parent'
      ? rawRole
      : 'parent';
  const displayName =
    typeof meta?.full_name === 'string' && meta.full_name.trim()
      ? meta.full_name.trim()
      : typeof meta?.name === 'string' && meta.name.trim()
        ? meta.name.trim()
        : user.email ?? null;
  return {
    id: user.id,
    email: user.email ?? null,
    displayName,
    role,
    provider: 'supabase',
  };
}

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>(getInitialTab);
  const [adminSection, setAdminSection] =
    useState<AdminSection>('notifications');
  const [authUser, setAuthUser] = useState<AuthUserProfile | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const [languages, setLanguages] = useState<LocaleConfig[]>([]);
  const [learners, setLearners] = useState<LearnerProfile[]>([]);
  const [activeLearnerId, setActiveLearnerId] = useState<string>('');
  const [progressRecords, setProgressRecords] = useState<LessonProgressRecord[]>(
    []
  );
  const [mediaAssets, setMediaAssets] = useState<MediaAssetRecord[]>([]);
  const [experienceMode, setExperienceMode] =
    useState<ExperienceMode>('guided');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const syncServerUser = useCallback(async (fallbackUser: User | null) => {
    if (!fallbackUser) {
      setAuthUser(null);
      return;
    }
    const optimistic = mapSupabaseUser(fallbackUser);
    setAuthUser(optimistic);
    try {
      const res = await apiClient.getCurrentUser();
      if (res.user) {
        setAuthUser(res.user);
      }
    } catch {
      // Keep optimistic parent fallback if network temporarily fails
    }
  }, []);

  // Subscribe to Supabase Auth session state and verify server-authoritative role
  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let mounted = true;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        await syncServerUser(data.session?.user ?? null);
        if (mounted) setAuthReady(true);
      })
      .catch(() => {
        if (mounted) setAuthReady(true);
      });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void syncServerUser(session?.user ?? null).finally(() => {
          if (mounted) setAuthReady(true);
        });
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [syncServerUser]);

  // Listen for popup OAuth callback messages from /auth/callback
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const handleMessage = async (event: MessageEvent) => {
      const origin = event.origin;
      if (
        origin !== window.location.origin &&
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost')
      ) {
        return;
      }
      const data = event.data as {
        type?: string;
        code?: string | null;
        accessToken?: string | null;
        refreshToken?: string | null;
        error?: string | null;
      } | null;
      if (!data || data.type !== 'SUPABASE_OAUTH_CALLBACK') return;

      setAuthBusy(true);
      setAuthError(null);
      setAuthNotice(null);
      try {
        if (data.error) {
          throw new Error(data.error);
        }
        if (data.code) {
          const { error: exchangeErr } =
            await client.auth.exchangeCodeForSession(data.code);
          if (exchangeErr) throw exchangeErr;
        } else if (data.accessToken && data.refreshToken) {
          const { error: sessionErr } = await client.auth.setSession({
            access_token: data.accessToken,
            refresh_token: data.refreshToken,
          });
          if (sessionErr) throw sessionErr;
        }
      } catch (err) {
        setAuthError(
          err instanceof Error ? err.message : 'Google sign-in failed'
        );
      } finally {
        setAuthBusy(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Register push notification service worker
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/push-sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    }
  }, []);

  const isStaff = authUser?.role === 'admin' || authUser?.role === 'teacher';

  const loadBootstrapData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [langRes, learnerRes] = await Promise.all([
        apiClient.getLanguages(),
        apiClient.getLearners(),
      ]);
      setLanguages(langRes.languages);
      setLearners(learnerRes.learners);
      if (learnerRes.learners.length > 0) {
        setActiveLearnerId((prev) =>
          learnerRes.learners.some((l) => l.id === prev)
            ? prev
            : learnerRes.learners[0].id
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to connect to TM-Lingo API'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authReady) {
      void loadBootstrapData();
    }
  }, [authReady, authUser?.id, loadBootstrapData]);

  // Load system media library ONLY for authenticated staff (Admin / Teacher)
  useEffect(() => {
    if (!authReady || !isStaff) {
      setMediaAssets([]);
      return;
    }
    let active = true;
    apiClient
      .listMedia()
      .then((res) => {
        if (active) setMediaAssets(res.assets);
      })
      .catch(() => {
        if (active) setMediaAssets([]);
      });
    return () => {
      active = false;
    };
  }, [authReady, isStaff, authUser?.id]);

  const refreshProgress = useCallback(async (learnerId: string) => {
    if (!learnerId) return;
    try {
      const res = await apiClient.getProgress(learnerId);
      setProgressRecords(res.progress);
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    if (!activeLearnerId) return;
    void refreshProgress(activeLearnerId);
  }, [activeLearnerId, authUser?.id, refreshProgress]);

  const activeLearner =
    learners.find((l) => l.id === activeLearnerId) ?? learners[0] ?? null;

  const uiLocales = languages.filter((l) => l.enabled && l.uiEnabled);
  const currentInterfaceLocale =
    activeLearner?.preferences.interfaceLocale ?? 'vi';
  const messages = getUiMessages(currentInterfaceLocale);

  useEffect(() => {
    document.documentElement.lang = currentInterfaceLocale;
  }, [currentInterfaceLocale]);

  const handleSignInGoogle = async () => {
    if (!supabase) {
      setAuthError('Supabase Auth is not configured.');
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });
      if (oauthErr) throw oauthErr;
      if (!data?.url) {
        throw new Error('Could not initialize Google sign-in URL.');
      }

      const width = 520;
      const height = 640;
      const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
      const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
      const popup = window.open(
        data.url,
        'tm_lingo_google_oauth',
        `width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)},resizable=yes,scrollbars=yes`
      );
      if (!popup) {
        setAuthError(
          currentInterfaceLocale === 'vi'
            ? 'Trình duyệt đang chặn cửa sổ bật lên (popup). Hãy cho phép popup rồi thử lại.'
            : 'Popup was blocked by your browser. Please allow popups and try again.'
        );
        setAuthBusy(false);
        return;
      }

      const pollTimer = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(pollTimer);
          setAuthBusy(false);
        }
      }, 600);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Google sign-in failed'
      );
      setAuthBusy(false);
    }
  };

  const handleSignInEmail = async (email: string, password: string) => {
    if (!supabase) {
      setAuthError('Supabase Auth is not configured.');
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInErr) throw signInErr;
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignUpEmail = async (
    email: string,
    password: string,
    displayName: string
  ) => {
    if (!supabase) {
      setAuthError('Supabase Auth is not configured.');
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: displayName.trim() || email.split('@')[0],
          },
        },
      });
      if (signUpErr) throw signUpErr;
      if (!data.session) {
        setAuthNotice(messages.parent.signUpCheckEmail);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign-up failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    setAuthBusy(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      await supabase.auth.signOut();
      setProgressRecords([]);
      setMediaAssets([]);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign-out failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleUpdatePreferences = async (patch: Partial<LearnerPreferences>) => {
    if (!activeLearner) return;
    setLearners((prev) =>
      prev.map((l) =>
        l.id === activeLearner.id
          ? { ...l, preferences: { ...l.preferences, ...patch } }
          : l
      )
    );
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

    const res = await apiClient.createLearner({
      ...payload,
      ...basePrefs,
    });
    setLearners((prev) => [...prev, res.learner]);
    setActiveLearnerId(res.learner.id);
  };

  const handleUploadMedia = async (payload: {
    file: File;
    title: string;
    locale: string;
  }) => {
    const res = await apiClient.uploadMedia(payload);
    setMediaAssets((prev) => [res.asset, ...prev]);
  };

  const handleDeleteMedia = async (assetId: string) => {
    await apiClient.deleteMedia(assetId);
    setMediaAssets((prev) => prev.filter((item) => item.id !== assetId));
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

  const openAdmin = (section: AdminSection = 'notifications') => {
    setAdminSection(section);
    setActiveTab('admin');
  };

  const navItems: Array<[AppTab, string]> = isStaff
    ? [
        ['learn', messages.nav.learn],
        ['stories', messages.nav.stories],
        ['parents', messages.nav.parents],
        ['admin', messages.nav.admin],
      ]
    : [
        ['learn', messages.nav.learn],
        ['stories', messages.nav.stories],
        ['parents', messages.nav.parents],
      ];

  return (
    <div
      className={`min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] ${
        activeLearner?.preferences.reducedMotion ? 'reduced-motion' : ''
      }`}
    >
      {/* Clean 3-zone Top Bar: Brand — Focused Nav — Actions (Bell only when signed in, VI/EN, Primary CTA) */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
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
            {navItems.map(([tabKey, label]) => {
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

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Notification Bell Icon: shown ONLY when signed in */}
            {authUser && (
              <NotificationBell
                userId={authUser.id}
                isStaff={isStaff}
                interfaceLocale={currentInterfaceLocale}
                onNavigateTab={setActiveTab}
                onOpenAdminNotifications={() => openAdmin('notifications')}
              />
            )}

            {/* Compact Display Language Switcher (interfaceLocale only) */}
            <div
              className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5"
              role="group"
              aria-label={messages.nav.languageSwitchLabel}
            >
              <Globe
                className="w-3.5 h-3.5 text-slate-400 mx-1.5 hidden sm:block"
                aria-hidden="true"
              />
              {(uiLocales.length > 0
                ? uiLocales
                : [
                    { locale: 'vi', nativeName: 'Tiếng Việt' },
                    { locale: 'en', nativeName: 'English' },
                  ]
              ).map((loc) => {
                const isSelected = currentInterfaceLocale === loc.locale;
                return (
                  <button
                    key={loc.locale}
                    type="button"
                    onClick={() =>
                      void handleUpdatePreferences({
                        interfaceLocale: loc.locale,
                      })
                    }
                    title={loc.nativeName}
                    aria-pressed={isSelected}
                    className={`px-2 py-1.5 min-h-[32px] rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {loc.locale}
                  </button>
                );
              })}
            </div>

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
              onClick={() => void loadBootstrapData()}
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

                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12] [text-wrap:balance]">
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
                    learner={activeLearner}
                    mode={experienceMode}
                    messages={messages}
                    onModeChange={setExperienceMode}
                    onOpenStory={() => setActiveTab('stories')}
                    onProgressUpdated={() =>
                      void refreshProgress(activeLearner.id)
                    }
                  />
                </div>
              </>
            )}

            {activeTab === 'stories' && (
              <StoryReader
                learner={activeLearner}
                languages={languages}
                messages={messages}
              />
            )}

            {activeTab === 'parents' && (
              <ParentPanel
                authUser={authUser}
                authBusy={authBusy}
                authError={authError}
                authNotice={authNotice}
                onSignInGoogle={handleSignInGoogle}
                onSignInEmail={handleSignInEmail}
                onSignUpEmail={handleSignUpEmail}
                onSignOut={handleSignOut}
                onOpenAdmin={() => openAdmin('notifications')}
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

            {activeTab === 'admin' &&
              (authUser && isStaff ? (
                <AdminWorkspace
                  authUser={authUser}
                  interfaceLocale={currentInterfaceLocale}
                  activeLearningLocale={activeLearner.preferences.learningLocale}
                  initialSection={adminSection}
                  languages={languages}
                  mediaAssets={mediaAssets}
                  messages={messages}
                  onUploadMedia={handleUploadMedia}
                  onDeleteMedia={handleDeleteMedia}
                />
              ) : (
                <AdminLoginView
                  authUser={authUser}
                  authBusy={authBusy}
                  authError={authError}
                  interfaceLocale={currentInterfaceLocale}
                  onSignInEmail={handleSignInEmail}
                  onSignOut={handleSignOut}
                  onBackToLearn={() => setActiveTab('learn')}
                />
              ))}
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>TM-Lingo · Multilingual Early Language Learning (Ages 3–5)</span>
          <div className="flex flex-wrap items-center gap-4">
            <span>
              Interface: {activeLearner?.preferences.interfaceLocale ?? 'vi'} ·
              Learning: {activeLearner?.preferences.learningLocale ?? 'en'}
            </span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => openAdmin('notifications')}
              className="font-medium text-slate-600 hover:text-sky-700 transition-colors cursor-pointer"
            >
              {messages.footer.adminPortal}
            </button>
          </div>
        </div>
      </footer>

      <OfflineIndicator
        locale={activeLearner?.preferences.interfaceLocale ?? 'vi'}
      />
    </div>
  );
}

export default App;

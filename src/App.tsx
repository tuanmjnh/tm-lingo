'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Award,
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  Clock,
  Globe,
  GraduationCap,
  Layers,
  Settings,
  Sparkles,
  Sun,
  User,
  Users,
} from 'lucide-react';
import type {
  AgeGroupConfig,
  AuthUserProfile,
  DeleteMode,
  ExperienceMode,
  LearnerPreferences,
  LearnerProfile,
  LearningPackageSummary,
  LessonProgressRecord,
  LocaleConfig,
  MediaAssetRecord,
} from '../packages/contracts/types';
import {
  signInParentWithEmail,
  signInParentWithGoogle,
  signOutParent,
  signUpParentWithEmail,
  subscribeParentAuth,
} from './lib/firebaseAuth';
import { apiClient } from './shared/apiClient';
import { flushOfflineQueue } from './lib/offlineQueue';
import {
  computeGoalStreak,
  getMasteredWordsList,
  getTodayDateKey,
  getTrickyWordsForReview,
  isParentalGateEnabled,
  loadLearnerRewards,
  recordDailyGoalMet,
} from './lib/learnerRewards';
import {
  applyAppearanceToDocument,
  loadAppearanceSettings,
  saveAppearanceSettings,
  type AppAccentColor,
  type AppAppearanceSettings,
  type AppThemeMode,
} from './lib/appAppearance';
import { getUiMessages } from './i18n/messages';
import { AssetImage } from './components/AssetImage';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { DailyGoalProgressRing } from './components/DailyGoalProgressRing';
import { DailyGoalCelebrationOverlay } from './components/DailyGoalCelebrationOverlay';
import { LearningTipOfTheDay } from './components/LearningTipOfTheDay';
import { SmartWordReviewModal } from './components/SmartWordReviewModal';
import { playCelebrationFanfare } from './audio/soundEffects';
import { NotificationBell } from './components/NotificationBell';
import { StickerBookModal } from './components/StickerBookModal';
import { ParentalGateModal } from './components/ParentalGateModal';
import { SettingsSlideover } from './components/SettingsSlideover';
import { AccountAuthModal } from './components/AccountAuthModal';
import { LandingHomepage } from './components/LandingHomepage';
import { LearnerOnboardingFlow } from './components/LearnerOnboardingFlow';
import { BrandLogo } from './components/BrandLogo';
import { AppLoadingScreen } from './components/AppLoadingScreen';
import { LessonPlayer } from './features/lesson-player/LessonPlayer';
import { StoryReader } from './features/story-reader/StoryReader';
import { ParentPanel } from './features/parent/ParentPanel';
import { AdminWorkspace } from './features/admin/AdminWorkspace';
import { AdminLoginView } from './features/admin/AdminLoginView';

type AppTab = 'learn' | 'stories' | 'parents' | 'admin';

interface AppProps {
  initialTab?: AppTab;
}

export function App({ initialTab = 'learn' }: AppProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<AppTab>(initialTab);

  useEffect(() => {
    if (window.location.hash) {
      const hashId = window.location.hash.slice(1);
      if (hashId === 'pathways' || hashId === 'method' || hashId === 'start') {
        const cleanUrl = `${window.location.pathname}${window.location.search}`;
        window.history.replaceState(null, '', cleanUrl);
        requestAnimationFrame(() => {
          document
            .getElementById(hashId)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }

    if (initialTab === 'admin' || pathname === '/admin') {
      setActiveTab('admin');
      return;
    }
    const param = new URLSearchParams(window.location.search).get('tab');
    if (param === 'stories' || param === 'parents' || param === 'admin') {
      setActiveTab(param);
    }
  }, [initialTab, pathname]);

  const scrollToLandingSection = useCallback(
    (sectionId: 'pathways' | 'method' | 'start') => {
      document
        .getElementById(sectionId)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    []
  );

  // Global App Appearance (Dark/Light/System, Accent Color, Language, Reduced Motion)
  const [appearance, setAppearance] = useState<AppAppearanceSettings>({
    themeMode: 'light',
    accentColor: 'sky',
    guestLocale: 'vi',
    reducedMotion: false,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Account Auth Modal & Pre-selected Age Band from Landing Page
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>(
    'signup'
  );
  const [pendingPreferredAgeBand, setPendingPreferredAgeBand] = useState<
    string | null
  >(null);

  // Hydrate & sync document theme + accent classes
  useEffect(() => {
    const initial = loadAppearanceSettings();
    setAppearance(initial);
    applyAppearanceToDocument(initial);
  }, []);

  useEffect(() => {
    applyAppearanceToDocument(appearance);
    saveAppearanceSettings(appearance);

    if (appearance.themeMode !== 'system' || typeof window === 'undefined') {
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => applyAppearanceToDocument(appearance);
    mq.addEventListener('change', handleMediaChange);
    return () => mq.removeEventListener('change', handleMediaChange);
  }, [appearance]);

  // Dual Auth Track 1: Parent Account
  const [parentUser, setParentUser] = useState<AuthUserProfile | null>(null);
  const [parentAuthBusy, setParentAuthBusy] = useState(false);
  const [parentAuthError, setParentAuthError] = useState<string | null>(null);
  const [parentAuthNotice, setParentAuthNotice] = useState<string | null>(null);

  // Dual Auth Track 2: Staff Session
  const [staffUser, setStaffUser] = useState<AuthUserProfile | null>(null);
  const [staffChecking, setStaffChecking] = useState(true);
  const [iamMode, setIamMode] = useState<'tm-hub' | 'local-dev'>('local-dev');
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);

  const [languages, setLanguages] = useState<LocaleConfig[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroupConfig[]>([]);
  const [packageAgeFilter, setPackageAgeFilter] = useState<string>('all');
  const [packages, setPackages] = useState<LearningPackageSummary[]>([]);
  const [activePackageId, setActivePackageId] = useState<string>('lp-fruits-a1');
  const [learners, setLearners] = useState<LearnerProfile[]>([]);
  const [activeLearnerId, setActiveLearnerId] = useState<string>('');
  const [progressRecords, setProgressRecords] = useState<LessonProgressRecord[]>(
    []
  );
  const [mediaAssets, setMediaAssets] = useState<MediaAssetRecord[]>([]);
  const [storageSummary, setStorageSummary] = useState<{
    bucket: string;
    provider: string;
  }>({ bucket: 'local-public', provider: 'local-public' });
  const [experienceMode, setExperienceMode] =
    useState<ExperienceMode>('guided');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedCount, setLastSyncedCount] = useState(0);
  const [dailyUsedSeconds, setDailyUsedSeconds] = useState(0);
  const [extraMinutesGranted, setExtraMinutesGranted] = useState(0);

  // Interactive UX overlays: Kid Focus Mode, Sticker Book, Parental Gate
  const [kidFocusMode, setKidFocusMode] = useState(false);
  const [stickerBookOpen, setStickerBookOpen] = useState(false);
  const [wordReviewOpen, setWordReviewOpen] = useState(false);
  const [goalCelebrationOpen, setGoalCelebrationOpen] = useState(false);
  const [goalStreakVersion, setGoalStreakVersion] = useState(0);
  const [parentGateOpen, setParentGateOpen] = useState(false);
  const [parentGateUnlockedSession, setParentGateUnlockedSession] =
    useState(false);

  // Subscribe to Parent Auth (non-blocking)
  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeParentAuth((fbUser) => {
      if (!mounted) return;
      if (!fbUser) {
        setParentUser(null);
        setLearners([]);
        setActiveLearnerId('');
        setProgressRecords([]);
        return;
      }
      setParentUser({
        id: fbUser.uid,
        email: fbUser.email ?? null,
        displayName: fbUser.displayName ?? fbUser.email ?? null,
        role: 'parent',
        provider: 'firebase',
      });
      setAuthModalOpen(false);
      setParentAuthError(null);
      apiClient
        .getCurrentUser()
        .then((res) => {
          if (mounted && res.user) {
            setParentUser(res.user);
          }
        })
        .catch(() => {
          // Keep optimistic parent profile
        });
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Check Staff session on mount
  useEffect(() => {
    let mounted = true;
    apiClient
      .getHealth()
      .then((health) => {
        if (mounted) {
          setIamMode(health.iamMode);
          setStorageSummary({
            bucket: health.storageBucket,
            provider: health.storageProvider,
          });
        }
      })
      .catch(() => undefined);

    apiClient
      .getStaffMe()
      .then((res) => {
        if (mounted) {
          setStaffUser(res.user);
          setIamMode(res.iamMode);
        }
      })
      .catch(() => {
        if (mounted) setStaffUser(null);
      })
      .finally(() => {
        if (mounted) setStaffChecking(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Service worker maintenance
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(
            registrations
              .filter((reg) => {
                const scriptUrl =
                  reg.active?.scriptURL ||
                  reg.waiting?.scriptURL ||
                  reg.installing?.scriptURL ||
                  '';
                return (
                  scriptUrl.includes('/dev-sw.js') ||
                  scriptUrl.endsWith('/sw.js')
                );
              })
              .map((reg) => reg.unregister())
          )
        )
        .catch(() => undefined)
        .finally(() => {
          navigator.serviceWorker.register('/push-sw.js').catch((err) => {
            console.warn('Service worker registration failed:', err);
          });
        });
    }
  }, []);

  const loadPublishedPackages = useCallback(async () => {
    try {
      const res = await apiClient.getPackages();
      setPackages(res.packages);
      if (res.packages.length > 0) {
        setActivePackageId((prev) =>
          res.packages.some((p) => p.id === prev) ? prev : res.packages[0].id
        );
      }
    } catch {
      // non-blocking
    }
  }, []);

  const loadBootstrapData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [langRes, ageRes, learnerRes, pkgRes] = await Promise.all([
        apiClient.getLanguages(),
        apiClient.getAgeGroups().catch(() => ({ ageGroups: [] })),
        apiClient.getLearners(),
        apiClient.getPackages(),
      ]);
      setLanguages(langRes.languages);
      setAgeGroups(ageRes.ageGroups);
      setLearners(learnerRes.learners);
      setPackages(pkgRes.packages);
      if (pkgRes.packages.length > 0) {
        setActivePackageId((prev) =>
          pkgRes.packages.some((p) => p.id === prev)
            ? prev
            : pkgRes.packages[0].id
        );
      }
      if (learnerRes.learners.length > 0) {
        setActiveLearnerId((prev) =>
          learnerRes.learners.some((l) => l.id === prev)
            ? prev
            : learnerRes.learners[0].id
        );
      } else {
        setActiveLearnerId('');
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
    void loadBootstrapData();
  }, [parentUser?.id, loadBootstrapData]);

  const loadLanguages = useCallback(async () => {
    try {
      const res = await apiClient.getLanguages();
      setLanguages(res.languages);
    } catch {
      // non-blocking
    }
  }, []);

  const loadAgeGroups = useCallback(async () => {
    try {
      const res = await apiClient.getAgeGroups();
      setAgeGroups(res.ageGroups);
    } catch {
      // non-blocking
    }
  }, []);

  const loadAdminMedia = useCallback(async () => {
    if (!staffUser) {
      setMediaAssets([]);
      return;
    }
    try {
      const res = await apiClient.listMedia({ includeArchived: true });
      setMediaAssets(res.assets);
      setStorageSummary({ bucket: res.bucket, provider: res.provider });
    } catch {
      setMediaAssets([]);
    }
  }, [staffUser]);

  useEffect(() => {
    void loadAdminMedia();
  }, [loadAdminMedia]);

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
  }, [activeLearnerId, parentUser?.id, refreshProgress]);

  // Flush IndexedDB offline sync queue on mount and reconnect
  useEffect(() => {
    let active = true;
    const runFlush = () => {
      void flushOfflineQueue({
        syncProgress: (lessonId, payload) =>
          apiClient.saveProgress(lessonId, payload),
        syncStoryPosition: (storyId, payload) =>
          apiClient.saveStoryPosition(storyId, payload),
      }).then((res) => {
        if (!active || res.synced === 0) return;
        setLastSyncedCount(res.synced);
        if (activeLearnerId) {
          void refreshProgress(activeLearnerId);
        }
        setTimeout(() => {
          if (active) setLastSyncedCount(0);
        }, 4000);
      });
    };

    runFlush();
    window.addEventListener('online', runFlush);
    return () => {
      active = false;
      window.removeEventListener('online', runFlush);
    };
  }, [activeLearnerId, refreshProgress]);

  // Gentle daily learning time limit tracker per learner per day
  useEffect(() => {
    if (!activeLearnerId || typeof window === 'undefined') return;
    const today = new Date().toISOString().slice(0, 10);
    const storageKey = `tm_lingo_usage_${today}_${activeLearnerId}`;
    try {
      const stored = Number(window.localStorage.getItem(storageKey) || '0');
      setDailyUsedSeconds(Number.isFinite(stored) ? stored : 0);
    } catch {
      setDailyUsedSeconds(0);
    }
    setExtraMinutesGranted(0);
  }, [activeLearnerId]);

  useEffect(() => {
    if (
      !activeLearnerId ||
      (activeTab !== 'learn' && activeTab !== 'stories') ||
      typeof window === 'undefined'
    ) {
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const storageKey = `tm_lingo_usage_${today}_${activeLearnerId}`;
    const timer = window.setInterval(() => {
      setDailyUsedSeconds((prev) => {
        const next = prev + 15;
        try {
          window.localStorage.setItem(storageKey, String(next));
        } catch {
          // ignore storage quota errors
        }
        return next;
      });
    }, 15000);
    return () => window.clearInterval(timer);
  }, [activeLearnerId, activeTab]);

  const activeLearner =
    learners.find((l) => l.id === activeLearnerId) ?? learners[0] ?? null;

  // Automatically match lesson shelf filter & active package to the learner's exact age band
  const activeLearnerAgeBand = activeLearner?.ageBand ?? '';
  useEffect(() => {
    if (!activeLearnerAgeBand) return;
    setPackageAgeFilter(activeLearnerAgeBand);
    if (packages.length === 0) return;
    const matched = packages.filter((p) =>
      p.ageBand.includes(activeLearnerAgeBand)
    );
    if (matched.length > 0) {
      setActivePackageId((prev) =>
        matched.some((p) => p.id === prev) ? prev : matched[0].id
      );
    }
  }, [activeLearner?.id, activeLearnerAgeBand, packages]);

  const uiLocales = languages.filter((l) => l.enabled && l.uiEnabled);
  const quickInterfaceLocales =
    uiLocales.length > 0
      ? uiLocales
      : [
          { locale: 'vi', nativeName: 'Tiếng Việt', displayName: 'Vietnamese' },
          { locale: 'en', nativeName: 'English', displayName: 'English' },
        ];
  const currentInterfaceLocale =
    activeLearner?.preferences.interfaceLocale ?? appearance.guestLocale ?? 'vi';
  const messages = getUiMessages(currentInterfaceLocale);

  useEffect(() => {
    document.documentElement.lang = currentInterfaceLocale;
  }, [currentInterfaceLocale]);

  // ---------- Appearance & Settings Handlers ----------
  const handleChangeThemeMode = (themeMode: AppThemeMode) => {
    setAppearance((prev) => ({ ...prev, themeMode }));
  };

  const handleChangeAccentColor = (accentColor: AppAccentColor) => {
    setAppearance((prev) => ({ ...prev, accentColor }));
  };

  const handleChangeReducedMotion = (reducedMotion: boolean) => {
    setAppearance((prev) => ({ ...prev, reducedMotion }));
    if (activeLearner) {
      void handleUpdatePreferences({ reducedMotion });
    }
  };

  const handleChangeInterfaceLocale = (locale: string) => {
    setAppearance((prev) => ({ ...prev, guestLocale: locale }));
    if (activeLearner) {
      void handleUpdatePreferences({ interfaceLocale: locale });
    }
  };

  const openAuthModal = (
    mode: 'signin' | 'signup',
    preferredAgeBand?: string
  ) => {
    setParentAuthError(null);
    setParentAuthNotice(null);
    if (preferredAgeBand !== undefined) {
      setPendingPreferredAgeBand(preferredAgeBand);
    }
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  // ---------- Parent Auth Handlers ----------
  const handleParentSignInGoogle = async () => {
    setParentAuthBusy(true);
    setParentAuthError(null);
    setParentAuthNotice(null);
    try {
      await signInParentWithGoogle();
    } catch (err) {
      setParentAuthError(
        err instanceof Error ? err.message : 'Google sign-in failed'
      );
    } finally {
      setParentAuthBusy(false);
    }
  };

  const handleParentSignInEmail = async (email: string, password: string) => {
    setParentAuthBusy(true);
    setParentAuthError(null);
    setParentAuthNotice(null);
    try {
      await signInParentWithEmail(email, password);
    } catch (err) {
      setParentAuthError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setParentAuthBusy(false);
    }
  };

  const handleParentSignUpEmail = async (
    email: string,
    password: string,
    displayName: string
  ) => {
    setParentAuthBusy(true);
    setParentAuthError(null);
    setParentAuthNotice(null);
    try {
      await signUpParentWithEmail(email, password, displayName);
      setParentAuthNotice(messages.parent.signUpCheckEmail);
    } catch (err) {
      setParentAuthError(err instanceof Error ? err.message : 'Sign-up failed');
    } finally {
      setParentAuthBusy(false);
    }
  };

  const handleParentSignOut = async () => {
    setParentAuthBusy(true);
    setParentAuthError(null);
    setParentAuthNotice(null);
    try {
      await signOutParent();
      setLearners([]);
      setActiveLearnerId('');
      setProgressRecords([]);
      setActiveTab('learn');
    } catch (err) {
      setParentAuthError(err instanceof Error ? err.message : 'Sign-out failed');
    } finally {
      setParentAuthBusy(false);
    }
  };

  // ---------- Staff Auth Handlers ----------
  const handleStaffLogin = async (email: string, password: string) => {
    setStaffBusy(true);
    setStaffError(null);
    try {
      const res = await apiClient.staffLogin(email, password);
      setStaffUser(res.user);
      setIamMode(res.iamMode);
    } catch (err) {
      setStaffError(
        err instanceof Error ? err.message : 'Staff sign-in failed'
      );
    } finally {
      setStaffBusy(false);
    }
  };

  const handleStaffSignOut = async () => {
    setStaffBusy(true);
    try {
      await apiClient.staffLogout();
      setStaffUser(null);
      setMediaAssets([]);
      if (pathname === '/admin') {
        router.push('/');
      } else {
        setActiveTab('learn');
      }
    } finally {
      setStaffBusy(false);
    }
  };

  // ---------- Learner & Media Handlers ----------
  const handleUpdatePreferences = async (patch: Partial<LearnerPreferences>) => {
    if (!activeLearner) return;
    setLearners((prev) =>
      prev.map((l) =>
        l.id === activeLearner.id
          ? { ...l, preferences: { ...l.preferences, ...patch } }
          : l
      )
    );
    const res = await apiClient.updateLearnerPreferences(
      activeLearner.id,
      patch
    );
    setLearners((prev) =>
      prev.map((l) => (l.id === res.learner.id ? res.learner : l))
    );
  };

  const handleCreateLearner = async (payload: {
    nickname: string;
    ageYears: number;
    ageBand?: string;
    gradeLevel?: number | null;
    avatarTone: LearnerProfile['avatarTone'];
    learningLocale?: string;
    explanationLocale?: string;
  }) => {
    const learningLocale =
      payload.learningLocale ??
      activeLearner?.preferences.learningLocale ??
      'en';
    const explanationLocale =
      payload.explanationLocale ??
      activeLearner?.preferences.explanationLocale ??
      (currentInterfaceLocale === 'en' ? 'en' : 'vi');

    const res = await apiClient.createLearner({
      nickname: payload.nickname,
      ageYears: payload.ageYears,
      ageBand: payload.ageBand,
      gradeLevel: payload.gradeLevel,
      avatarTone: payload.avatarTone,
      interfaceLocale: currentInterfaceLocale,
      learningLocale,
      explanationLocale,
      narrationLocale: learningLocale,
    });
    setLearners((prev) => [...prev, res.learner]);
    setActiveLearnerId(res.learner.id);
    setPackageAgeFilter(res.learner.ageBand);
    const matchedPkg = packages.find((p) =>
      p.ageBand.includes(res.learner.ageBand)
    );
    if (matchedPkg) {
      setActivePackageId(matchedPkg.id);
    }
  };

  const handleUpdateLearnerProfile = async (
    learnerId: string,
    patch: {
      nickname?: string;
      ageYears?: number;
      ageBand?: string;
      gradeLevel?: number | null;
      applyAgeDefaults?: boolean;
    }
  ) => {
    const res = await apiClient.updateLearnerProfile(learnerId, patch);
    setLearners((prev) =>
      prev.map((l) => (l.id === res.learner.id ? res.learner : l))
    );
  };

  const handleUploadMedia = async (payload: {
    file: File;
    title: string;
    locale: string;
  }) => {
    const res = await apiClient.uploadMedia(payload);
    setMediaAssets((prev) => [res.asset, ...prev]);
  };

  const handleDeleteMedia = async (assetId: string, mode: DeleteMode) => {
    await apiClient.deleteMedia(assetId, mode);
    await loadAdminMedia();
  };

  const handleRestoreMedia = async (assetId: string) => {
    await apiClient.restoreMedia(assetId);
    await loadAdminMedia();
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

  const leaveAdminToHome = () => {
    setKidFocusMode(false);
    if (pathname === '/admin') {
      router.push('/');
    } else {
      setActiveTab('learn');
    }
  };

  const navigateTab = (tab: AppTab) => {
    setKidFocusMode(false);
    if (
      tab === 'parents' &&
      !parentGateUnlockedSession &&
      isParentalGateEnabled()
    ) {
      setParentGateOpen(true);
      return;
    }
    if (pathname === '/admin' && tab !== 'admin') {
      router.push(tab === 'learn' ? '/' : `/?tab=${tab}`);
      return;
    }
    setActiveTab(tab);
  };

  const getPackageCoverRef = (pkgId: string, topicId?: string): string => {
    if (pkgId === 'lp-farm-a1' || topicId?.includes('farm')) {
      return 'img-story-sunny-farm';
    }
    if (pkgId === 'lp-fruits-a1' || topicId?.includes('fruit')) {
      return 'img-story-fruit-market';
    }
    if (pkgId.includes('primary') || pkgId.includes('6-8')) {
      return 'img-story-sunny-farm';
    }
    if (pkgId.includes('science') || pkgId.includes('9-11')) {
      return 'img-story-fruit-market';
    }
    return 'img-apple';
  };

  const openPackageFromStory = (packageId?: string) => {
    if (packageId && packages.some((p) => p.id === packageId)) {
      setActivePackageId(packageId);
    }
    scrollToLessonStage();
  };

  const signedInActorId = parentUser?.id ?? staffUser?.id ?? null;
  const isVi = currentInterfaceLocale === 'vi';
  const hasAuthenticatedWorkspace = Boolean(parentUser && activeLearner);
  const isGuestLanding = !parentUser && activeTab !== 'admin';
  const isOnboarding = Boolean(parentUser && !activeLearner && activeTab !== 'admin');

  const activeAgeGroup = activeLearner
    ? (ageGroups.find((g) => g.id === activeLearner.ageBand) ??
      ageGroups.find(
        (g) =>
          activeLearner.ageYears >= g.minAge &&
          activeLearner.ageYears <= g.maxAge
      ))
    : undefined;

  const filteredPackages =
    packageAgeFilter === 'all'
      ? packages
      : packages.filter((p) => p.ageBand.includes(packageAgeFilter));

  const todayRewards = activeLearner
    ? loadLearnerRewards(activeLearner.id)
    : null;
  const todayEntry = todayRewards?.dailyLog[getTodayDateKey()];
  const completedLessonToday = (todayEntry?.lessonsCompleted ?? 0) > 0;
  const completedStoryToday = (todayEntry?.storiesRead ?? 0) > 0;

  const dailyLimitMinutes =
    (activeLearner?.preferences.dailyMinutesLimit ?? 15) + extraMinutesGranted;
  const dailyUsedMinutes = Math.floor(dailyUsedSeconds / 60);
  const isDailyLimitReached =
    Boolean(activeLearner) && dailyUsedMinutes >= dailyLimitMinutes;

  // Record daily goal completion & trigger celebratory 100% overlay once per learner/day/goal milestone
  const activeLearnerIdForGoal = activeLearner?.id ?? '';
  useEffect(() => {
    if (!activeLearnerIdForGoal || !isDailyLimitReached) return;
    if (typeof window === 'undefined') return;
    const todayKey = getTodayDateKey();
    recordDailyGoalMet(activeLearnerIdForGoal, todayKey);
    setGoalStreakVersion((v) => v + 1);
    const milestoneKey = `tm_lingo_goal_celebrated_v1:${activeLearnerIdForGoal}:${todayKey}:${dailyLimitMinutes}`;
    try {
      if (window.localStorage.getItem(milestoneKey) === '1') return;
      window.localStorage.setItem(milestoneKey, '1');
    } catch {
      // ignore storage errors
    }
    setGoalCelebrationOpen(true);
    playCelebrationFanfare();
  }, [activeLearnerIdForGoal, isDailyLimitReached, dailyLimitMinutes]);

  const goalStreakSummary =
    activeLearner && goalStreakVersion >= 0
      ? computeGoalStreak(activeLearner.id, {
          includeToday: isDailyLimitReached,
        })
      : null;

  const trickyReviewCount =
    activeLearner && goalStreakVersion >= 0
      ? getTrickyWordsForReview(activeLearner.id).length
      : 0;
  const masteredReviewCount =
    activeLearner && goalStreakVersion >= 0
      ? getMasteredWordsList(activeLearner.id).length
      : 0;

  const navItems: Array<[AppTab, string]> = [
    ['learn', messages.nav.learn],
    ['stories', messages.nav.stories],
    ['parents', messages.nav.parents],
  ];

  const isFocusStage =
    kidFocusMode && activeTab === 'learn' && hasAuthenticatedWorkspace;
  const effectiveReducedMotion =
    appearance.reducedMotion || Boolean(activeLearner?.preferences.reducedMotion);

  return (
    <div
      className={`min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#0B1120] text-[#0F172A] dark:text-[#F1F5F9] transition-colors ${
        hasAuthenticatedWorkspace && !isFocusStage ? 'pb-16 md:pb-0' : ''
      } ${effectiveReducedMotion ? 'reduced-motion' : ''}`}
    >
      {/* Top Bar — 3-Zone Contract: Brand Wordmark | Single-line Nav | Settings Gear + Primary Action */}
      {!isFocusStage && (
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#0B1120]/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 transition-colors">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-6">
            <button
              type="button"
              onClick={leaveAdminToHome}
              aria-label="TM-Lingo"
              className="inline-flex items-center shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
            >
              <BrandLogo size="md" />
            </button>

            {/* Zone 2: Navigation */}
            {hasAuthenticatedWorkspace ? (
              <nav
                aria-label="Primary navigation"
                className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400"
              >
                {navItems.map(([tabKey, label]) => {
                  const isActive = activeTab === tabKey;
                  return (
                    <button
                      key={tabKey}
                      type="button"
                      onClick={() => navigateTab(tabKey)}
                      className={`py-1 whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                        isActive
                          ? 'border-accent-active text-slate-900 dark:text-white font-semibold'
                          : 'border-transparent hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </nav>
            ) : isGuestLanding ? (
              <nav
                aria-label={isVi ? 'Điều hướng giới thiệu' : 'Overview navigation'}
                className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-400"
              >
                <button
                  type="button"
                  onClick={() => scrollToLandingSection('pathways')}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                >
                  {isVi ? 'Lộ trình theo tuổi' : 'Age pathways'}
                </button>
                <button
                  type="button"
                  onClick={() => scrollToLandingSection('method')}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                >
                  {isVi ? 'Phương pháp' : 'Method'}
                </button>
                <button
                  type="button"
                  onClick={() => scrollToLandingSection('start')}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                >
                  {isVi ? 'Bắt đầu' : 'Get started'}
                </button>
              </nav>
            ) : (
              <div className="hidden md:block text-xs font-medium text-slate-500 dark:text-slate-400">
                {isOnboarding
                  ? isVi
                    ? 'Thiết lập hồ sơ học viên đầu tiên'
                    : 'Set up your first learner profile'
                  : ''}
              </div>
            )}

            {/* Zone 3: Right Actions — [Primary CTA] -> [Notification Slideover] -> [Settings Slideover (always rightmost)] */}
            <div className="flex items-center gap-2 shrink-0">
              {!parentUser && activeTab !== 'admin' ? (
                <button
                  type="button"
                  onClick={() => openAuthModal('signup')}
                  className="inline-flex items-center px-3 sm:px-4 py-2 min-h-[40px] rounded-xl btn-accent text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isVi ? 'Tạo tài khoản' : 'Create account'}
                </button>
              ) : hasAuthenticatedWorkspace ? (
                <button
                  type="button"
                  onClick={scrollToLessonStage}
                  className="inline-flex items-center px-3 sm:px-4 py-2 min-h-[40px] rounded-xl btn-accent text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {messages.nav.startLesson}
                </button>
              ) : null}

              {signedInActorId && (
                <NotificationBell
                  userId={signedInActorId}
                  interfaceLocale={currentInterfaceLocale}
                  onNavigateTab={navigateTab}
                />
              )}

              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label={
                  isVi
                    ? 'Mở cài đặt giao diện, ngôn ngữ và màu sắc'
                    : 'Open appearance, language and color settings'
                }
                title={isVi ? 'Cài đặt ứng dụng' : 'App settings'}
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0 cursor-pointer"
              >
                <Settings className="w-[18px] h-[18px]" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>
      )}

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-10">
        {activeTab === 'admin' ? (
          staffUser ? (
            <AdminWorkspace
              staffUser={staffUser}
              iamMode={iamMode}
              interfaceLocale={currentInterfaceLocale}
              activeLearningLocale={
                activeLearner?.preferences.learningLocale ?? 'en'
              }
              initialSection="overview"
              languages={languages}
              ageGroups={ageGroups}
              mediaAssets={mediaAssets}
              storageSummary={storageSummary}
              messages={messages}
              onUploadMedia={handleUploadMedia}
              onDeleteMedia={handleDeleteMedia}
              onRestoreMedia={handleRestoreMedia}
              onReloadMedia={loadAdminMedia}
              onStaffSignOut={handleStaffSignOut}
              onContentPublished={() => void loadPublishedPackages()}
              onLanguagesUpdated={() => void loadLanguages()}
              onAgeGroupsUpdated={() => void loadAgeGroups()}
            />
          ) : staffChecking ? (
            <AppLoadingScreen
              compact
              subtitle={
                isVi
                  ? 'Đang khôi phục phiên quản trị...'
                  : 'Restoring admin session...'
              }
            />
          ) : (
            <AdminLoginView
              staffBusy={staffBusy}
              staffError={staffError}
              iamMode={iamMode}
              interfaceLocale={currentInterfaceLocale}
              onStaffLogin={handleStaffLogin}
              onBackToLearn={leaveAdminToHome}
            />
          )
        ) : !parentUser ? (
          /* State 1: Unauthenticated Visitor — Clean App Introduction ONLY (Zero Demo Data) */
          <LandingHomepage
            interfaceLocale={currentInterfaceLocale}
            ageGroups={ageGroups}
            onCreateAccount={(band) => openAuthModal('signup', band)}
            onSignIn={() => openAuthModal('signin')}
          />
        ) : loading ? (
          <AppLoadingScreen
            compact
            subtitle={
              isVi
                ? 'Đang tải hồ sơ và lộ trình học phù hợp...'
                : 'Loading your profile and tailored lessons...'
            }
          />
        ) : error ? (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-8 space-y-3">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              {error}
            </p>
            <button
              type="button"
              onClick={() => void loadBootstrapData()}
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold cursor-pointer"
            >
              {isVi ? 'Thử lại' : 'Retry'}
            </button>
          </div>
        ) : !activeLearner ? (
          /* State 2: Signed-in New Account — Guided Age & Profile Onboarding */
          <LearnerOnboardingFlow
            interfaceLocale={currentInterfaceLocale}
            ageGroups={ageGroups}
            languages={languages}
            initialAgeBand={pendingPreferredAgeBand}
            parentEmail={parentUser.email}
            onComplete={async (payload) => {
              await handleCreateLearner(payload);
              setPendingPreferredAgeBand(null);
            }}
          />
        ) : (
          /* State 3: Authenticated Workspace with Age-Matched Curriculum */
          <>
            {(activeTab === 'learn' || activeTab === 'stories') &&
            isDailyLimitReached ? (
              <section className="max-w-xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-10 text-center space-y-5">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                  <Sun className="w-8 h-8" aria-hidden="true" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50">
                  {currentInterfaceLocale === 'vi'
                    ? `Hôm nay ${activeLearner.nickname} đã học thật giỏi rồi!`
                    : `Great learning today, ${activeLearner.nickname}!`}
                </h2>
                <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                  {currentInterfaceLocale === 'vi'
                    ? `Học viên đã hoàn thành đủ ${dailyLimitMinutes} phút học hôm nay. Hãy cho đôi mắt nghỉ ngơi, uống nước hoặc thư giãn một chút nhé.`
                    : `You reached today's gentle ${dailyLimitMinutes}-minute learning goal. Time to rest your eyes, stretch, and recharge!`}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setExtraMinutesGranted((m) => m + 5)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl btn-accent text-sm font-semibold cursor-pointer"
                  >
                    <Clock className="w-4 h-4" aria-hidden="true" />
                    <span>
                      {currentInterfaceLocale === 'vi'
                        ? 'Phụ huynh: Thêm 5 phút nữa'
                        : 'Parent: Allow 5 more minutes'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('parents')}
                    className="px-5 py-2.5 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    {currentInterfaceLocale === 'vi'
                      ? 'Điều chỉnh giới hạn'
                      : 'Adjust daily limit'}
                  </button>
                </div>
              </section>
            ) : (
              <>
                {activeTab === 'learn' && (
                  <>
                    {/* Quick Learner Switcher & Sticker Book Toolbar */}
                    {!isFocusStage && (
                      <section
                        aria-label={
                          isVi
                            ? 'Thanh chọn hồ sơ học sinh'
                            : 'Learner switcher bar'
                        }
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            <User
                              className="w-3.5 h-3.5 text-accent"
                              aria-hidden="true"
                            />
                            <span>{isVi ? 'Đang học:' : 'Learner:'}</span>
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {learners.map((profile) => {
                              const selected = profile.id === activeLearner.id;
                              const gradeTag =
                                profile.gradeLevel && profile.gradeLevel > 0
                                  ? isVi
                                    ? `Lớp ${profile.gradeLevel}`
                                    : `G${profile.gradeLevel}`
                                  : isVi
                                    ? `${profile.ageYears}t`
                                    : `${profile.ageYears}y`;
                              return (
                                <button
                                  key={profile.id}
                                  type="button"
                                  onClick={() => setActiveLearnerId(profile.id)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                                    selected
                                      ? 'border-accent bg-accent-soft'
                                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  <span>{profile.nickname}</span>
                                  <span className="text-[11px] opacity-75 tabular-nums">
                                    · {gradeTag}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          <DailyGoalProgressRing
                            dailyUsedMinutes={dailyUsedMinutes}
                            dailyLimitMinutes={dailyLimitMinutes}
                            isVi={isVi}
                            minutesUnit={messages.parent.minutesUnit}
                            onCelebrationClick={() => setGoalCelebrationOpen(true)}
                          />
                          {activeAgeGroup && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                              <GraduationCap
                                className="w-3.5 h-3.5 text-accent"
                                aria-hidden="true"
                              />
                              <span>
                                {isVi
                                  ? activeAgeGroup.shortLabels.vi
                                  : activeAgeGroup.shortLabels.en}
                              </span>
                            </span>
                          )}
                          <div
                            className="relative inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                            title={
                              isVi
                                ? 'Tùy chọn ngôn ngữ giao diện'
                                : 'Language Preferences'
                            }
                          >
                            <Globe
                              className="w-3.5 h-3.5 text-accent ml-2.5 shrink-0 pointer-events-none"
                              aria-hidden="true"
                            />
                            <select
                              aria-label={
                                isVi
                                  ? 'Tùy chọn ngôn ngữ'
                                  : 'Language Preferences'
                              }
                              value={currentInterfaceLocale}
                              onChange={(e) =>
                                handleChangeInterfaceLocale(e.target.value)
                              }
                              className="appearance-none bg-transparent pl-1.5 pr-7 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                            >
                              {quickInterfaceLocales.map((loc) => (
                                <option
                                  key={loc.locale}
                                  value={loc.locale}
                                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                >
                                  {loc.nativeName} ({loc.locale.toUpperCase()})
                                </option>
                              ))}
                            </select>
                            <ChevronDown
                              className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-2 pointer-events-none"
                              aria-hidden="true"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setStickerBookOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/50 text-xs font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer"
                          >
                            <Award
                              className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400"
                              aria-hidden="true"
                            />
                            <span>
                              {isVi ? 'Sổ Sticker' : 'Sticker Book'} (
                              {todayRewards?.unlockedStickerIds.length ?? 1})
                            </span>
                          </button>
                        </div>
                      </section>
                    )}

                    {/* Personalized Hero Section */}
                    {!isFocusStage && (
                      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                        <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                            <span>
                              {messages.hero.learningMeta}:{' '}
                              <strong className="text-slate-800 dark:text-slate-100">
                                {getLocaleName(
                                  activeLearner.preferences.learningLocale
                                )}
                              </strong>
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {messages.hero.explanationMeta}:{' '}
                              <strong className="text-slate-800 dark:text-slate-100">
                                {getLocaleName(
                                  activeLearner.preferences.explanationLocale
                                )}
                              </strong>
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {activeAgeGroup
                                ? isVi
                                  ? activeAgeGroup.shortLabels.vi
                                  : activeAgeGroup.shortLabels.en
                                : messages.hero.ageBand}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {dailyUsedMinutes}/{dailyLimitMinutes}{' '}
                              {messages.parent.minutesUnit}
                            </span>
                          </div>

                          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-[1.12] [text-wrap:balance]">
                            {messages.hero.greeting}, {activeLearner.nickname}!
                          </h1>

                          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                            {activeAgeGroup
                              ? isVi
                                ? activeAgeGroup.descriptions.vi
                                : activeAgeGroup.descriptions.en
                              : messages.hero.subtitle}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 pt-1">
                            <button
                              type="button"
                              onClick={scrollToLessonStage}
                              className="px-5 py-3 min-h-[46px] rounded-xl btn-accent font-semibold transition-colors whitespace-nowrap cursor-pointer"
                            >
                              {messages.hero.continueButton}
                            </button>
                            <button
                              type="button"
                              onClick={() => navigateTab('stories')}
                              className="px-5 py-3 min-h-[46px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
                            >
                              {messages.hero.openStoryButton}
                            </button>
                            <PWAInstallButton
                              locale={activeLearner.preferences.interfaceLocale}
                            />
                          </div>
                        </div>

                        <div className="lg:col-span-5">
                          <div className="h-full min-h-[240px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <AssetImage
                              assetRef={getPackageCoverRef(
                                activePackageId,
                                packages.find((p) => p.id === activePackageId)
                                  ?.topicId
                              )}
                              altOverride={
                                packages.find((p) => p.id === activePackageId)
                                  ?.titles[currentInterfaceLocale] ??
                                'TM-Lingo learning theme illustration'
                              }
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>
                      </section>
                    )}

                    {/* Learning Tip of the Day */}
                    {!isFocusStage && (
                      <LearningTipOfTheDay
                        learnerId={activeLearner.id}
                        learnerName={activeLearner.nickname}
                        interfaceLocale={currentInterfaceLocale}
                        reducedMotion={effectiveReducedMotion}
                      />
                    )}

                    {/* Daily Routine Card */}
                    {!isFocusStage && (
                      <section
                        aria-label={
                          isVi
                            ? 'Lộ trình học mỗi ngày'
                            : 'Daily learning routine'
                        }
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-accent inline-flex items-center gap-1.5">
                            <Sparkles
                              className="w-3.5 h-3.5"
                              aria-hidden="true"
                            />
                            <span>
                              {isVi
                                ? `Lộ trình ${activeAgeGroup?.uiProfile.defaultDailyMinutes ?? 10} phút hôm nay`
                                : `Today's ${activeAgeGroup?.uiProfile.defaultDailyMinutes ?? 10}-Minute Routine`}
                            </span>
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-300">
                            {isVi
                              ? 'Hoàn thành 1 bài từ vựng đúng độ tuổi và nghe 1 truyện song ngữ để giữ nhịp học đều đặn.'
                              : 'Complete 1 age-matched vocabulary lesson and enjoy 1 story to build a steady daily habit.'}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                          <button
                            type="button"
                            onClick={scrollToLessonStage}
                            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                              completedLessonToday
                                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200'
                                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200 hover:border-accent'
                            }`}
                          >
                            {completedLessonToday ? (
                              <Check
                                className="w-4 h-4 text-emerald-600 dark:text-emerald-400"
                                aria-hidden="true"
                              />
                            ) : (
                              <Layers
                                className="w-4 h-4 text-accent"
                                aria-hidden="true"
                              />
                            )}
                            <span>
                              {isVi
                                ? '1. Học từ vựng'
                                : '1. Vocabulary lesson'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => navigateTab('stories')}
                            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                              completedStoryToday
                                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200'
                                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200 hover:border-accent'
                            }`}
                          >
                            {completedStoryToday ? (
                              <Check
                                className="w-4 h-4 text-emerald-600 dark:text-emerald-400"
                                aria-hidden="true"
                              />
                            ) : (
                              <BookOpen
                                className="w-4 h-4 text-accent"
                                aria-hidden="true"
                              />
                            )}
                            <span>
                              {isVi ? '2. Đọc 1 truyện' : '2. Read 1 story'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setWordReviewOpen(true)}
                            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                              trickyReviewCount > 0
                                ? 'border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                                : masteredReviewCount > 0
                                  ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200'
                                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200 hover:border-accent'
                            }`}
                          >
                            <Brain
                              className={`w-4 h-4 ${
                                trickyReviewCount > 0
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : masteredReviewCount > 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-accent'
                              }`}
                              aria-hidden="true"
                            />
                            <span className="tabular-nums">
                              {trickyReviewCount > 0
                                ? isVi
                                  ? `3. Ôn từ khó (${trickyReviewCount})`
                                  : `3. Review words (${trickyReviewCount})`
                                : isVi
                                  ? '3. Ôn từ khó'
                                  : '3. Word review'}
                            </span>
                          </button>
                        </div>
                      </section>
                    )}

                    {/* Learning Package Shelf (Auto-matched to learner ageBand) */}
                    {!isFocusStage && packages.length > 0 && (
                      <section
                        aria-label={
                          isVi ? 'Chủ đề bài học' : 'Learning topics'
                        }
                        className="space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 inline-flex items-center gap-2">
                            <Layers
                              className="w-4 h-4 text-accent"
                              aria-hidden="true"
                            />
                            <span>
                              {isVi
                                ? 'Bài học phù hợp lứa tuổi'
                                : 'Age-matched learning topics'}
                            </span>
                          </h2>
                          <div className="flex flex-wrap items-center gap-2">
                            {ageGroups.length > 0 && (
                              <select
                                value={packageAgeFilter}
                                onChange={(e) =>
                                  setPackageAgeFilter(e.target.value)
                                }
                                aria-label={
                                  isVi
                                    ? 'Lọc gói bài học theo nhóm tuổi'
                                    : 'Filter packages by age group'
                                }
                                className="min-h-[34px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
                              >
                                <option value="all">
                                  {isVi ? 'Mọi nhóm tuổi' : 'All age groups'} (
                                  {packages.length})
                                </option>
                                {ageGroups.map((g) => (
                                  <option key={g.id} value={g.id}>
                                    {isVi
                                      ? g.shortLabels.vi
                                      : g.shortLabels.en}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {(filteredPackages.length > 0
                            ? filteredPackages
                            : packages
                          ).map((pkg) => {
                            const selected = pkg.id === activePackageId;
                            const pkgTitle =
                              pkg.titles[currentInterfaceLocale] ||
                              pkg.titles.en ||
                              Object.values(pkg.titles)[0] ||
                              pkg.id;
                            const pkgSummary =
                              pkg.summaries[currentInterfaceLocale] ||
                              pkg.summaries.vi ||
                              Object.values(pkg.summaries)[0] ||
                              '';
                            return (
                              <button
                                key={pkg.id}
                                type="button"
                                onClick={() => setActivePackageId(pkg.id)}
                                aria-pressed={selected}
                                className={`group text-left rounded-2xl border p-3 flex items-center gap-3.5 transition-colors cursor-pointer ${
                                  selected
                                    ? 'border-accent bg-accent-soft'
                                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-accent'
                                }`}
                              >
                                <div className="w-20 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shrink-0">
                                  <AssetImage
                                    assetRef={getPackageCoverRef(
                                      pkg.id,
                                      pkg.topicId
                                    )}
                                    altOverride={pkgTitle}
                                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform"
                                  />
                                </div>
                                <div className="min-w-0 flex-1 space-y-0.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                      {pkgTitle}
                                    </p>
                                    {selected && (
                                      <Check
                                        className="w-4 h-4 text-accent shrink-0"
                                        aria-hidden="true"
                                      />
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                    {pkgSummary}
                                  </p>
                                  <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 tabular-nums pt-0.5">
                                    {pkg.conceptCount}{' '}
                                    {isVi ? 'từ vựng' : 'words'} ·{' '}
                                    {pkg.ageBand.join(', ')}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    )}

                    <div id="lesson-stage" className="scroll-mt-24">
                      <LessonPlayer
                        learner={activeLearner}
                        activeAgeGroup={activeAgeGroup}
                        packages={packages}
                        activePackageId={activePackageId}
                        onSelectPackage={setActivePackageId}
                        mode={experienceMode}
                        messages={messages}
                        focusMode={kidFocusMode}
                        onToggleFocusMode={() => setKidFocusMode((v) => !v)}
                        onOpenStickerBook={() => setStickerBookOpen(true)}
                        onModeChange={setExperienceMode}
                        onOpenStory={() => navigateTab('stories')}
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
                    ageGroups={ageGroups}
                    languages={languages}
                    messages={messages}
                    onOpenPackage={openPackageFromStory}
                  />
                )}
              </>
            )}

            {activeTab === 'parents' && (
              <ParentPanel
                authUser={parentUser}
                authBusy={parentAuthBusy}
                authError={parentAuthError}
                authNotice={parentAuthNotice}
                onSignInGoogle={handleParentSignInGoogle}
                onSignInEmail={handleParentSignInEmail}
                onSignUpEmail={handleParentSignUpEmail}
                onSignOut={handleParentSignOut}
                learners={learners}
                activeLearner={activeLearner}
                ageGroups={ageGroups}
                languages={languages}
                progressRecords={progressRecords}
                messages={messages}
                onSelectLearner={setActiveLearnerId}
                onCreateLearner={handleCreateLearner}
                onUpdateLearnerProfile={handleUpdateLearnerProfile}
                onUpdatePreferences={handleUpdatePreferences}
                onFamilyDataChanged={loadBootstrapData}
                onOpenWordReview={() => setWordReviewOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {!isFocusStage && (
        <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120] mt-12 transition-colors">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-2">
              <BrandLogo size="sm" showWordmark={false} />
              <span>
                {isVi
                  ? 'TM-Lingo · Nền tảng học đa ngôn ngữ theo lộ trình (Mầm non – Lớp 12)'
                  : 'TM-Lingo · Multilingual Learning Platform (Pre-K – Grade 12)'}
              </span>
            </span>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="font-medium text-slate-600 dark:text-slate-300 hover:text-accent transition-colors cursor-pointer"
              >
                {isVi ? 'Cài đặt giao diện' : 'Appearance & Language'}
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Thumb-friendly Mobile Bottom Navigation (Authenticated Workspace Only) */}
      {hasAuthenticatedWorkspace && !isFocusStage && (
        <nav
          aria-label={isVi ? 'Điều hướng di động' : 'Mobile navigation'}
          className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 h-16 px-2 grid"
          style={{
            gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))`,
          }}
        >
          {navItems.map(([tabKey, label]) => {
            const isActive = activeTab === tabKey;
            const Icon =
              tabKey === 'learn'
                ? Layers
                : tabKey === 'stories'
                  ? BookOpen
                  : Users;
            return (
              <button
                key={tabKey}
                type="button"
                onClick={() => navigateTab(tabKey)}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? 'text-accent'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="truncate max-w-full px-1">{label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Settings Slideover (Dark Mode, Accent Colors, Language, Audio, Reduced Motion) */}
      <SettingsSlideover
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        interfaceLocale={currentInterfaceLocale}
        uiLocales={uiLocales}
        appearance={appearance}
        onChangeThemeMode={handleChangeThemeMode}
        onChangeAccentColor={handleChangeAccentColor}
        onChangeReducedMotion={handleChangeReducedMotion}
        onChangeInterfaceLocale={handleChangeInterfaceLocale}
        parentUser={parentUser}
        onOpenAuth={(mode) => openAuthModal(mode)}
        onSignOut={() => void handleParentSignOut()}
      />

      {/* Account Sign Up / Sign In Modal */}
      <AccountAuthModal
        open={authModalOpen}
        initialMode={authModalMode}
        interfaceLocale={currentInterfaceLocale}
        busy={parentAuthBusy}
        error={parentAuthError}
        notice={parentAuthNotice}
        onClose={() => setAuthModalOpen(false)}
        onSignInGoogle={handleParentSignInGoogle}
        onSignInEmail={handleParentSignInEmail}
        onSignUpEmail={handleParentSignUpEmail}
      />

      {/* Daily 100% Learning Goal Celebration Overlay */}
      {activeLearner && (
        <DailyGoalCelebrationOverlay
          open={goalCelebrationOpen}
          learnerName={activeLearner.nickname}
          dailyUsedMinutes={dailyUsedMinutes}
          dailyLimitMinutes={dailyLimitMinutes}
          stickerCount={todayRewards?.unlockedStickerIds.length ?? 1}
          streakDays={Math.max(1, goalStreakSummary?.currentStreak ?? 1)}
          longestStreakDays={Math.max(1, goalStreakSummary?.longestStreak ?? 1)}
          streakLast7Days={goalStreakSummary?.last7Days ?? []}
          nextStreakMilestone={goalStreakSummary?.nextMilestone ?? 3}
          isVi={isVi}
          minutesUnit={messages.parent.minutesUnit}
          reducedMotion={effectiveReducedMotion}
          onClose={() => setGoalCelebrationOpen(false)}
          onOpenStickerBook={() => setStickerBookOpen(true)}
          onExtendFiveMinutes={() => setExtraMinutesGranted((m) => m + 5)}
        />
      )}

      {/* Sticker Book Modal */}
      {stickerBookOpen && activeLearner && (
        <StickerBookModal
          learnerId={activeLearner.id}
          learnerName={activeLearner.nickname}
          isVi={isVi}
          onClose={() => setStickerBookOpen(false)}
        />
      )}

      {/* Smart Tricky-Words Review Modal */}
      {activeLearner && (
        <SmartWordReviewModal
          open={wordReviewOpen}
          learnerId={activeLearner.id}
          learnerName={activeLearner.nickname}
          defaultLearningLocale={activeLearner.preferences.learningLocale}
          audioSpeed={activeLearner.preferences.audioSpeed}
          isVi={isVi}
          reducedMotion={effectiveReducedMotion}
          onClose={() => setWordReviewOpen(false)}
          onReviewChanged={() => setGoalStreakVersion((v) => v + 1)}
        />
      )}

      {/* Parental Gate Modal */}
      {parentGateOpen && (
        <ParentalGateModal
          isVi={isVi}
          onUnlocked={() => {
            setParentGateUnlockedSession(true);
            setParentGateOpen(false);
            setActiveTab('parents');
          }}
          onCancel={() => setParentGateOpen(false)}
        />
      )}

      <OfflineIndicator
        locale={currentInterfaceLocale}
        lastSyncedCount={lastSyncedCount}
      />
    </div>
  );
}

export default App;

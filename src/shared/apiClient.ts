import type {
  AIProviderConnectionView,
  AIProviderModelView,
  ActivityAnswerResponse,
  AgeGroupConfig,
  AuthUserProfile,
  CmsLearningPackage,
  DeleteMode,
  ExperienceMode,
  GenerationJobRecord,
  LearnerPreferences,
  LearnerProfile,
  LearningLevel,
  LearningPackageSummary,
  LessonProgressRecord,
  LocaleConfig,
  ManagedUserRecord,
  MediaAssetRecord,
  NotificationCampaign,
  NotificationCategory,
  NotificationDeliveryLog,
  NotificationStatus,
  ParentConsentPurpose,
  ParentConsentRecord,
  ParentDataExportPayload,
  ParentPrivacySummary,
  PublicationSnapshotRecord,
  PublicationWorkflowStatus,
  PushSubscriptionSummary,
  ResolvedLessonPayload,
  SafetyReviewResult,
  StaffAuditLogEntry,
  StaffRoleRecord,
  StorageConnectionView,
  StorageProviderKind,
  StoryBook,
  StoryCategoryKey,
  StoryReadingPosition,
  StorySourceAdapterType,
  StorySourceConfig,
  ExternalStoryCatalogItem,
  UserRole,
  VoiceProfile,
} from '../../packages/contracts/types';
import { getParentIdToken } from '../lib/firebaseAuth';

export interface SupportedAIProviderMeta {
  key: string;
  name: string;
  family: string;
  defaultBaseUrl: string;
  keyless: boolean;
  docsUrl: string;
}

// Kept strictly in JS memory (never written to localStorage/sessionStorage)
// so staff admin requests remain authenticated even inside cross-origin iframes where third-party cookies are restricted.
let inMemoryStaffAccessToken: string | null = null;

async function buildHeaders(
  url: string,
  extra?: HeadersInit,
  forceRefreshParentToken = false
): Promise<Headers> {
  const headers = new Headers(extra);
  // Dual Auth Isolation: never attach Firebase Parent Bearer token to /api/v1/admin/*
  const isStaffEndpoint = url.startsWith('/api/v1/admin/');
  if (isStaffEndpoint) {
    headers.set('X-Requested-With', 'XMLHttpRequest');
    if (inMemoryStaffAccessToken) {
      headers.set('Authorization', `Bearer ${inMemoryStaffAccessToken}`);
    }
  } else {
    const token = await getParentIdToken(forceRefreshParentToken);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }
  return headers;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const isStaffEndpoint = url.startsWith('/api/v1/admin/');
  const sendRequest = async (forceRefreshParentToken: boolean) => {
    const headers = await buildHeaders(url, init?.headers, forceRefreshParentToken);
    if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(url, {
      ...init,
      credentials: 'include',
      ...(isStaffEndpoint ? { cache: 'no-store' as RequestCache } : {}),
      headers,
    });
  };

  let res = await sendRequest(false);

  // If a signed-in Firebase user hits 401 due to a stale/expired token, refresh once and retry
  if (res.status === 401 && !isStaffEndpoint) {
    const refreshedToken = await getParentIdToken(true);
    if (refreshedToken) {
      res = await sendRequest(true);
    }
  }

  if (isStaffEndpoint) {
    const refreshed = res.headers.get('X-Staff-Refreshed-Token')?.trim();
    if (refreshed) {
      inMemoryStaffAccessToken = refreshed;
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  // ---------- Health & Public Catalogs ----------
  getHealth: () =>
    apiFetch<{
      status: string;
      service: string;
      version: string;
      iamMode: 'tm-hub' | 'local-dev';
      storageBucket: string;
      storageProvider: string;
    }>('/api/v1/health'),

  getCurrentUser: () =>
    apiFetch<{ user: AuthUserProfile | null }>('/api/v1/auth/me'),

  getLanguages: () =>
    apiFetch<{ languages: LocaleConfig[] }>('/api/v1/languages'),

  getAgeGroups: () =>
    apiFetch<{ ageGroups: AgeGroupConfig[] }>('/api/v1/age-groups'),

  getVoices: (locale?: string) => {
    const query = locale ? `?locale=${encodeURIComponent(locale)}` : '';
    return apiFetch<{ voices: VoiceProfile[] }>(`/api/v1/voices${query}`);
  },

  // ---------- Family & Child Learning ----------
  getLearners: () =>
    apiFetch<{ learners: LearnerProfile[] }>('/api/v1/learners'),

  createLearner: (payload: {
    nickname: string;
    ageYears: number;
    ageBand?: string;
    gradeLevel?: number | null;
    avatarTone: LearnerProfile['avatarTone'];
    interfaceLocale: string;
    learningLocale: string;
    explanationLocale: string;
    narrationLocale: string;
  }) =>
    apiFetch<{ learner: LearnerProfile }>('/api/v1/learners', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateLearnerProfile: (
    learnerId: string,
    patch: {
      nickname?: string;
      ageYears?: number;
      ageBand?: string;
      gradeLevel?: number | null;
      avatarTone?: LearnerProfile['avatarTone'];
      applyAgeGroupDefaults?: boolean;
    }
  ) =>
    apiFetch<{ learner: LearnerProfile }>(
      `/api/v1/learners/${encodeURIComponent(learnerId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }
    ),

  updateLearnerPreferences: (
    learnerId: string,
    patch: Partial<LearnerPreferences>
  ) =>
    apiFetch<{ learner: LearnerProfile }>(
      `/api/v1/learners/${encodeURIComponent(learnerId)}/preferences`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }
    ),

  getPackages: (ageBand?: string) => {
    const qs = ageBand ? `?ageBand=${encodeURIComponent(ageBand)}` : '';
    return apiFetch<{ packages: LearningPackageSummary[] }>(
      `/api/v1/packages${qs}`
    );
  },

  getLesson: (params: {
    lessonId: string;
    mode: ExperienceMode;
    learningLocale: string;
    explanationLocale: string;
  }) => {
    const qs = new URLSearchParams({
      mode: params.mode,
      learningLocale: params.learningLocale,
      explanationLocale: params.explanationLocale,
    });
    return apiFetch<{ lesson: ResolvedLessonPayload }>(
      `/api/v1/lessons/${encodeURIComponent(params.lessonId)}?${qs.toString()}`
    );
  },

  submitAnswer: (
    activityId: string,
    payload: {
      learnerId: string;
      lessonId: string;
      learningLocale: string;
      explanationLocale: string;
      selectedId?: string;
      matchedPairs?: Array<{ wordId: string; imageId: string }>;
    }
  ) =>
    apiFetch<ActivityAnswerResponse>(
      `/api/v1/activities/${encodeURIComponent(activityId)}/answer`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  getProgress: (learnerId: string) =>
    apiFetch<{ progress: LessonProgressRecord[] }>(
      `/api/v1/progress?learnerId=${encodeURIComponent(learnerId)}`
    ),

  saveProgress: (
    lessonId: string,
    payload: {
      learnerId: string;
      learningLocale: string;
      mode: ExperienceMode;
      completedActivityIds: string[];
      totalActivities: number;
      lastActivityIndex: number;
      completed: boolean;
    }
  ) =>
    apiFetch<{ progress: LessonProgressRecord }>(
      `/api/v1/lessons/${encodeURIComponent(lessonId)}/progress`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  getStories: (ageBand?: string) => {
    const qs = ageBand ? `?ageBand=${encodeURIComponent(ageBand)}` : '';
    return apiFetch<{ stories: StoryBook[] }>(`/api/v1/stories${qs}`);
  },

  getStory: (storyId: string, learnerId?: string) => {
    const qs = learnerId ? `?learnerId=${encodeURIComponent(learnerId)}` : '';
    return apiFetch<{
      story: StoryBook;
      readingPosition: StoryReadingPosition | null;
    }>(`/api/v1/stories/${encodeURIComponent(storyId)}${qs}`);
  },

  saveStoryPosition: (
    storyId: string,
    payload: {
      learnerId: string;
      narrationLocale: string;
      segmentIndex: number;
    }
  ) =>
    apiFetch<{ readingPosition: StoryReadingPosition }>(
      `/api/v1/stories/${encodeURIComponent(storyId)}/position`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  // ---------- Notifications (Consumer) ----------
  getVapidPublicKey: () =>
    apiFetch<{ publicKey: string; configured: boolean }>(
      '/api/v1/notifications/vapid-public-key'
    ),

  getNotificationInbox: () =>
    apiFetch<{ notifications: NotificationCampaign[] }>(
      '/api/v1/notifications/inbox'
    ),

  subscribePush: (payload: {
    subscription: PushSubscriptionJSON;
    deviceLabel: string;
    locale: string;
    topics: NotificationCategory[];
  }) =>
    apiFetch<{ subscription: PushSubscriptionSummary }>(
      '/api/v1/notifications/subscribe',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  // ---------- Staff Auth (TM-Hub IAM: Partitioned HttpOnly Cookie + In-Memory Bearer) ----------
  staffLogin: async (email: string, password: string) => {
    const res = await apiFetch<{
      user: AuthUserProfile;
      iamMode: 'tm-hub' | 'local-dev';
      accessToken?: string;
    }>('/api/v1/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    inMemoryStaffAccessToken = res.accessToken ?? null;
    return { user: res.user, iamMode: res.iamMode };
  },

  staffLogout: async () => {
    try {
      return await apiFetch<{ ok: boolean }>('/api/v1/admin/auth/logout', {
        method: 'POST',
      });
    } finally {
      inMemoryStaffAccessToken = null;
    }
  },

  getStaffMe: async () => {
    const res = await apiFetch<{
      user: AuthUserProfile;
      iamMode: 'tm-hub' | 'local-dev';
      accessToken?: string;
    }>('/api/v1/admin/auth/me');
    if (res.accessToken) {
      inMemoryStaffAccessToken = res.accessToken;
    }
    return { user: res.user, iamMode: res.iamMode };
  },

  // ---------- Staff Users, Roles & Audit Logs ----------
  listAdminUsers: () =>
    apiFetch<{ users: ManagedUserRecord[]; source: 'tm-hub' | 'local' }>(
      '/api/v1/admin/staff/users'
    ),

  updateUserRole: (userId: string, role: UserRole) =>
    apiFetch<{ user: ManagedUserRecord }>(
      `/api/v1/admin/staff/users/${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }
    ),

  listStaffRoles: () =>
    apiFetch<{ roles: StaffRoleRecord[]; source: 'tm-hub' | 'local' }>(
      '/api/v1/admin/staff/roles'
    ),

  listAuditLogs: (limit = 40) =>
    apiFetch<{ logs: StaffAuditLogEntry[]; source: 'tm-hub' | 'local' }>(
      `/api/v1/admin/audit-logs?limit=${limit}`
    ),

  // ---------- Parent Privacy, Consents, Export & Deletion ----------
  getParentPrivacy: () =>
    apiFetch<{ privacy: ParentPrivacySummary }>('/api/v1/parent/privacy'),

  recordParentConsent: (purpose: ParentConsentPurpose, granted: boolean) =>
    apiFetch<{ consent: ParentConsentRecord; privacy: ParentPrivacySummary }>(
      '/api/v1/parent/privacy',
      {
        method: 'POST',
        body: JSON.stringify({ purpose, granted }),
      }
    ),

  exportParentData: () =>
    apiFetch<{ exportData: ParentDataExportPayload }>(
      '/api/v1/parent/data-export',
      { method: 'POST' }
    ),

  deleteParentData: (mode: DeleteMode, confirmPhrase?: string) =>
    apiFetch<{
      result: {
        mode: DeleteMode;
        affectedLearners: number;
        deletedProgress: number;
        deletedStoryPositions: number;
        archivedAt?: string | null;
      };
    }>('/api/v1/parent/data-deletion', {
      method: 'POST',
      body: JSON.stringify({ mode, confirmPhrase }),
    }),

  // ---------- Staff Media Library (Self-Managed R2/S3/Local) ----------
  listMedia: (options?: { includeArchived?: boolean }) =>
    apiFetch<{ assets: MediaAssetRecord[]; bucket: string; provider: string }>(
      `/api/v1/admin/media${options?.includeArchived ? '?includeArchived=1' : ''}`
    ),

  uploadMedia: (payload: { file: File; title: string; locale: string }) => {
    const form = new FormData();
    form.append('file', payload.file);
    form.append('title', payload.title);
    form.append('locale', payload.locale);
    return apiFetch<{ asset: MediaAssetRecord }>('/api/v1/admin/media', {
      method: 'POST',
      body: form,
    });
  },

  deleteMedia: (assetId: string, mode: DeleteMode = 'soft') =>
    apiFetch<{ removed: boolean; mode: DeleteMode }>(
      `/api/v1/admin/media/${encodeURIComponent(assetId)}?mode=${mode}`,
      { method: 'DELETE' }
    ),

  restoreMedia: (assetId: string) =>
    apiFetch<{ asset: MediaAssetRecord }>(
      `/api/v1/admin/media/${encodeURIComponent(assetId)}/restore`,
      { method: 'POST' }
    ),

  // ---------- Staff Notifications Management ----------
  getPushSubscriptions: () =>
    apiFetch<{ subscriptions: PushSubscriptionSummary[] }>(
      '/api/v1/admin/notifications/subscriptions'
    ),

  unsubscribePush: (subscriptionId: string) =>
    apiFetch<{ removed: boolean }>(
      `/api/v1/admin/notifications/subscriptions/${encodeURIComponent(subscriptionId)}`,
      { method: 'DELETE' }
    ),

  getNotificationCampaigns: (options?: { includeArchived?: boolean }) =>
    apiFetch<{
      campaigns: NotificationCampaign[];
      logs: NotificationDeliveryLog[];
    }>(
      `/api/v1/admin/notifications/campaigns${options?.includeArchived ? '?includeArchived=1' : ''}`
    ),

  createNotificationCampaign: (payload: {
    title: string;
    body: string;
    category: NotificationCategory;
    locale: string;
    targetUrl: string;
    status: NotificationStatus;
    scheduledFor: string | null;
  }) =>
    apiFetch<{ campaign: NotificationCampaign }>(
      '/api/v1/admin/notifications/campaigns',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  updateNotificationCampaign: (
    campaignId: string,
    patch: Partial<{
      title: string;
      body: string;
      category: NotificationCategory;
      locale: string;
      targetUrl: string;
      status: NotificationStatus;
      scheduledFor: string | null;
    }>
  ) =>
    apiFetch<{ campaign: NotificationCampaign }>(
      `/api/v1/admin/notifications/campaigns/${encodeURIComponent(campaignId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }
    ),

  deleteNotificationCampaign: (
    campaignId: string,
    mode: DeleteMode = 'soft'
  ) =>
    apiFetch<{ removed: boolean; mode: DeleteMode }>(
      `/api/v1/admin/notifications/campaigns/${encodeURIComponent(campaignId)}?mode=${mode}`,
      { method: 'DELETE' }
    ),

  restoreNotificationCampaign: (campaignId: string) =>
    apiFetch<{ campaign: NotificationCampaign }>(
      `/api/v1/admin/notifications/campaigns/${encodeURIComponent(campaignId)}/restore`,
      { method: 'POST' }
    ),

  sendNotificationCampaign: (campaignId: string) =>
    apiFetch<{
      campaign: NotificationCampaign;
      log: NotificationDeliveryLog;
    }>(
      `/api/v1/admin/notifications/campaigns/${encodeURIComponent(campaignId)}/send`,
      { method: 'POST' }
    ),

  // ---------- Self-Managed AI Providers (@tuanmjnh/tm-ai-client) ----------
  listAIProviders: (options?: { includeArchived?: boolean }) =>
    apiFetch<{
      connections: AIProviderConnectionView[];
      envFallbackAvailable: boolean;
      envFallbackModel: string;
      supportedProviders: SupportedAIProviderMeta[];
    }>(
      `/api/v1/admin/providers/ai${options?.includeArchived ? '?includeArchived=1' : ''}`
    ),

  saveAIProvider: (payload: {
    connectionId?: string;
    providerKey: string;
    baseUrl?: string;
    apiKey?: string;
    enabled?: boolean;
  }) =>
    apiFetch<{ connection: AIProviderConnectionView }>(
      '/api/v1/admin/providers/ai',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  deleteAIProvider: (connectionId: string, mode: DeleteMode = 'soft') =>
    apiFetch<{ removed: boolean; mode: DeleteMode }>(
      `/api/v1/admin/providers/ai/${encodeURIComponent(connectionId)}?mode=${mode}`,
      { method: 'DELETE' }
    ),

  restoreAIProvider: (connectionId: string) =>
    apiFetch<{ connection: AIProviderConnectionView }>(
      `/api/v1/admin/providers/ai/${encodeURIComponent(connectionId)}/restore`,
      { method: 'POST' }
    ),

  testAIProvider: (connectionId: string) =>
    apiFetch<{
      ok: boolean;
      message: string;
      discoveredModels: AIProviderModelView[];
    }>(`/api/v1/admin/providers/ai/${encodeURIComponent(connectionId)}/test`, {
      method: 'POST',
    }),

  updateAIProviderModels: (
    connectionId: string,
    models: AIProviderModelView[]
  ) =>
    apiFetch<{ connection: AIProviderConnectionView }>(
      `/api/v1/admin/providers/ai/${encodeURIComponent(connectionId)}/models`,
      {
        method: 'PATCH',
        body: JSON.stringify({ models }),
      }
    ),

  // ---------- Self-Managed Storage Providers (R2 / S3) ----------
  listStorageProviders: (options?: { includeArchived?: boolean }) =>
    apiFetch<{
      connections: StorageConnectionView[];
      envFallbackAvailable: boolean;
      envFallbackBucket: string | null;
    }>(
      `/api/v1/admin/providers/storage${options?.includeArchived ? '?includeArchived=1' : ''}`
    ),

  saveStorageProvider: (payload: {
    connectionId?: string;
    name: string;
    provider: StorageProviderKind;
    endpoint: string;
    region?: string;
    bucket: string;
    publicBaseUrl?: string;
    pathPrefix?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    isDefault?: boolean;
    enabled?: boolean;
  }) =>
    apiFetch<{ connection: StorageConnectionView }>(
      '/api/v1/admin/providers/storage',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  deleteStorageProvider: (connectionId: string, mode: DeleteMode = 'soft') =>
    apiFetch<{ removed: boolean; mode: DeleteMode }>(
      `/api/v1/admin/providers/storage/${encodeURIComponent(connectionId)}?mode=${mode}`,
      { method: 'DELETE' }
    ),

  restoreStorageProvider: (connectionId: string) =>
    apiFetch<{ connection: StorageConnectionView }>(
      `/api/v1/admin/providers/storage/${encodeURIComponent(connectionId)}/restore`,
      { method: 'POST' }
    ),

  testStorageProvider: (connectionId: string) =>
    apiFetch<{ ok: boolean; message: string; testedAt: string }>(
      `/api/v1/admin/providers/storage/${encodeURIComponent(connectionId)}/test`,
      { method: 'POST' }
    ),

  setDefaultStorageProvider: (connectionId: string) =>
    apiFetch<{ connection: StorageConnectionView }>(
      `/api/v1/admin/providers/storage/${encodeURIComponent(connectionId)}/default`,
      { method: 'POST' }
    ),

  // ---------- Admin Language Registry CRUD ----------
  listAdminLanguages: (options?: { includeArchived?: boolean }) =>
    apiFetch<{ languages: LocaleConfig[] }>(
      `/api/v1/admin/languages${options?.includeArchived ? '?includeArchived=1' : ''}`
    ),

  createAdminLanguage: (payload: Omit<LocaleConfig, 'archivedAt'>) =>
    apiFetch<{ language: LocaleConfig }>('/api/v1/admin/languages', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAdminLanguage: (
    locale: string,
    patch: Partial<Omit<LocaleConfig, 'locale' | 'languageCode' | 'archivedAt'>>
  ) =>
    apiFetch<{ language: LocaleConfig }>(
      `/api/v1/admin/languages/${encodeURIComponent(locale)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }
    ),

  deleteAdminLanguage: (locale: string, mode: DeleteMode = 'soft') =>
    apiFetch<{ removed: boolean; mode: DeleteMode }>(
      `/api/v1/admin/languages/${encodeURIComponent(locale)}?mode=${mode}`,
      { method: 'DELETE' }
    ),

  restoreAdminLanguage: (locale: string) =>
    apiFetch<{ language: LocaleConfig }>(
      `/api/v1/admin/languages/${encodeURIComponent(locale)}/restore`,
      { method: 'POST' }
    ),

  // ---------- CMS & AI Content Studio ----------
  listCmsPackages: (options?: { includeArchived?: boolean }) =>
    apiFetch<{ packages: CmsLearningPackage[] }>(
      `/api/v1/admin/cms/packages${options?.includeArchived ? '?includeArchived=1' : ''}`
    ),

  createCmsPackage: (payload: {
    topicId: string;
    ageBand?: string[];
    learningLevel?: LearningLevel;
    learningLocales: string[];
    explanationLocales: string[];
    titles: Record<string, string>;
    summaries: Record<string, string>;
    concepts: CmsLearningPackage['concepts'];
  }) =>
    apiFetch<{ package: CmsLearningPackage }>('/api/v1/admin/cms/packages', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCmsPackage: (
    packageId: string,
    patch: Partial<
      Pick<
        CmsLearningPackage,
        | 'titles'
        | 'summaries'
        | 'ageBand'
        | 'learningLevel'
        | 'learningLocales'
        | 'explanationLocales'
        | 'concepts'
      >
    >
  ) =>
    apiFetch<{ package: CmsLearningPackage }>(
      `/api/v1/admin/cms/packages/${encodeURIComponent(packageId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }
    ),

  transitionCmsPackage: (
    packageId: string,
    status: PublicationWorkflowStatus
  ) =>
    apiFetch<{
      package: CmsLearningPackage;
      snapshot: PublicationSnapshotRecord | null;
    }>(`/api/v1/admin/cms/packages/${encodeURIComponent(packageId)}/publish`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),

  deleteCmsPackage: (packageId: string, mode: DeleteMode = 'soft') =>
    apiFetch<{ removed: boolean; mode: DeleteMode }>(
      `/api/v1/admin/cms/packages/${encodeURIComponent(packageId)}?mode=${mode}`,
      { method: 'DELETE' }
    ),

  restoreCmsPackage: (packageId: string) =>
    apiFetch<{ package: CmsLearningPackage }>(
      `/api/v1/admin/cms/packages/${encodeURIComponent(packageId)}/restore`,
      { method: 'POST' }
    ),

  listCmsStories: (options?: { includeArchived?: boolean }) =>
    apiFetch<{ stories: StoryBook[] }>(
      `/api/v1/admin/cms/stories${options?.includeArchived ? '?includeArchived=1' : ''}`
    ),

  updateCmsStory: (
    storyId: string,
    patch: Partial<
      Pick<
        StoryBook,
        'titles' | 'summaries' | 'ageBands' | 'coverAssetRef' | 'segments'
      >
    >
  ) =>
    apiFetch<{ story: StoryBook }>(
      `/api/v1/admin/cms/stories/${encodeURIComponent(storyId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }
    ),

  transitionCmsStory: (storyId: string, status: PublicationWorkflowStatus) =>
    apiFetch<{
      story: StoryBook;
      snapshot: PublicationSnapshotRecord | null;
    }>(`/api/v1/admin/cms/stories/${encodeURIComponent(storyId)}/publish`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),

  deleteCmsStory: (storyId: string, mode: DeleteMode = 'soft') =>
    apiFetch<{ removed: boolean; mode: DeleteMode }>(
      `/api/v1/admin/cms/stories/${encodeURIComponent(storyId)}?mode=${mode}`,
      { method: 'DELETE' }
    ),

  restoreCmsStory: (storyId: string) =>
    apiFetch<{ story: StoryBook }>(
      `/api/v1/admin/cms/stories/${encodeURIComponent(storyId)}/restore`,
      { method: 'POST' }
    ),

  listGenerationJobs: () =>
    apiFetch<{ jobs: GenerationJobRecord[] }>('/api/v1/admin/cms/generate'),

  generateCmsDraft: (payload: {
    kind: 'package' | 'story';
    topic: string;
    learningLocale: string;
    explanationLocale: string;
    ageBand?: string;
    learningPackageId?: string;
    connectionId?: string;
    modelOverride?: string;
  }) =>
    apiFetch<{
      kind: 'package' | 'story';
      package?: CmsLearningPackage;
      story?: StoryBook;
      providerUsed: string;
      modelUsed: string;
    }>('/api/v1/admin/cms/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generateCmsTts: (payload: {
    text: string;
    locale: string;
    title?: string;
    voiceName?: 'Kore' | 'Puck' | 'Zephyr' | 'Charon' | 'Fenrir';
  }) =>
    apiFetch<{
      asset: MediaAssetRecord;
      providerUsed: string;
      modelUsed: string;
    }>('/api/v1/admin/cms/tts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listCmsSnapshots: (params: {
    entityType: 'package' | 'story';
    entityId: string;
    limit?: number;
  }) => {
    const qs = new URLSearchParams({
      entityType: params.entityType,
      entityId: params.entityId,
      limit: String(params.limit ?? 20),
    });
    return apiFetch<{ snapshots: PublicationSnapshotRecord[] }>(
      `/api/v1/admin/cms/snapshots?${qs.toString()}`
    );
  },

  rollbackCmsSnapshot: (payload: {
    entityType: 'package' | 'story';
    entityId: string;
    snapshotId: string;
  }) =>
    apiFetch<{
      package?: CmsLearningPackage;
      story?: StoryBook;
      snapshot: PublicationSnapshotRecord;
      restoredFromVersion: number;
    }>('/api/v1/admin/cms/snapshots/rollback', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adaptCmsLocale: (payload: {
    entityType: 'package' | 'story';
    entityId: string;
    sourceLocale: string;
    targetLocale: string;
    connectionId?: string;
    modelOverride?: string;
  }) =>
    apiFetch<{
      entityType: 'package' | 'story';
      package?: CmsLearningPackage;
      story?: StoryBook;
      providerUsed: string;
      modelUsed: string;
    }>('/api/v1/admin/cms/adapt', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  runCmsSafetyReview: (payload: {
    entityType: 'package' | 'story';
    entityId: string;
    responseLocale?: string;
    connectionId?: string;
    modelOverride?: string;
  }) =>
    apiFetch<{ review: SafetyReviewResult }>('/api/v1/admin/cms/safety-review', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ---------- Admin Voice Registry CRUD ----------
  listAdminVoices: (options?: { includeArchived?: boolean; locale?: string }) => {
    const qs = new URLSearchParams();
    if (options?.includeArchived) qs.set('includeArchived', '1');
    if (options?.locale) qs.set('locale', options.locale);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<{ voices: VoiceProfile[] }>(`/api/v1/admin/voices${suffix}`);
  },

  createAdminVoice: (payload: Omit<VoiceProfile, 'archivedAt'>) =>
    apiFetch<{ voice: VoiceProfile }>('/api/v1/admin/voices', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAdminVoice: (
    voiceId: string,
    patch: Partial<Omit<VoiceProfile, 'voiceId' | 'archivedAt'>>
  ) =>
    apiFetch<{ voice: VoiceProfile }>(
      `/api/v1/admin/voices/${encodeURIComponent(voiceId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }
    ),

  deleteAdminVoice: (voiceId: string, mode: DeleteMode = 'soft') =>
    apiFetch<{ removed: boolean; mode: DeleteMode }>(
      `/api/v1/admin/voices/${encodeURIComponent(voiceId)}?mode=${mode}`,
      { method: 'DELETE' }
    ),

  restoreAdminVoice: (voiceId: string) =>
    apiFetch<{ voice: VoiceProfile }>(
      `/api/v1/admin/voices/${encodeURIComponent(voiceId)}/restore`,
      { method: 'POST' }
    ),

  // ---------- Admin Age Groups & Grade Levels (Pre-K to Grade 12) ----------
  listAdminAgeGroups: (options?: { includeArchived?: boolean }) =>
    apiFetch<{ ageGroups: AgeGroupConfig[] }>(
      `/api/v1/admin/age-groups${options?.includeArchived ? '?includeArchived=1' : ''}`
    ),

  createAdminAgeGroup: (payload: Omit<AgeGroupConfig, 'archivedAt' | 'updatedAt' | 'isSystem'>) =>
    apiFetch<{ ageGroup: AgeGroupConfig }>('/api/v1/admin/age-groups', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAdminAgeGroup: (
    id: string,
    patch: Partial<Omit<AgeGroupConfig, 'id' | 'archivedAt' | 'updatedAt' | 'isSystem'>>
  ) =>
    apiFetch<{ ageGroup: AgeGroupConfig }>(
      `/api/v1/admin/age-groups/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }
    ),

  deleteAdminAgeGroup: (id: string, mode: DeleteMode = 'soft') =>
    apiFetch<{ removed: boolean; mode: DeleteMode }>(
      `/api/v1/admin/age-groups/${encodeURIComponent(id)}?mode=${mode}`,
      { method: 'DELETE' }
    ),

  restoreAdminAgeGroup: (id: string) =>
    apiFetch<{ ageGroup: AgeGroupConfig }>(
      `/api/v1/admin/age-groups/${encodeURIComponent(id)}/restore`,
      { method: 'POST' }
    ),

  // ---------- Public Story Sources Discovery & Download ----------
  listStorySources: () =>
    apiFetch<{
      sources: StorySourceConfig[];
      categories: Array<{
        key: StoryCategoryKey;
        labelVi: string;
        labelEn: string;
      }>;
    }>('/api/v1/story-sources'),

  browseStorySourcesCatalog: (params?: {
    sourceId?: string;
    category?: StoryCategoryKey | 'all';
    q?: string;
    ageBand?: string;
    locale?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.sourceId && params.sourceId !== 'all') {
      qs.set('sourceId', params.sourceId);
    }
    if (params?.category && params.category !== 'all') {
      qs.set('category', params.category);
    }
    if (params?.q?.trim()) {
      qs.set('q', params.q.trim());
    }
    if (params?.ageBand && params.ageBand !== 'all') {
      qs.set('ageBand', params.ageBand);
    }
    if (params?.locale && params.locale !== 'all') {
      qs.set('locale', params.locale);
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<{
      items: ExternalStoryCatalogItem[];
      sources: StorySourceConfig[];
      categories: Array<{
        key: StoryCategoryKey;
        labelVi: string;
        labelEn: string;
      }>;
      warnings: Array<{ sourceId: string; sourceName: string; message: string }>;
    }>(`/api/v1/story-sources/catalog${suffix}`);
  },

  importStoryFromSource: (payload: { sourceId: string; externalId: string }) =>
    apiFetch<{ story: StoryBook; alreadyExisted: boolean }>(
      '/api/v1/story-sources/import',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  // ---------- Admin Story Sources Management ----------
  listAdminStorySources: (options?: { includeArchived?: boolean }) =>
    apiFetch<{
      sources: StorySourceConfig[];
      categories: Array<{
        key: StoryCategoryKey;
        labelVi: string;
        labelEn: string;
      }>;
    }>(
      `/api/v1/admin/story-sources${options?.includeArchived ? '?includeArchived=1' : ''}`
    ),

  createAdminStorySource: (payload: {
    id: string;
    name: { vi: string; en: string };
    description: { vi: string; en: string };
    adapterType: StorySourceAdapterType;
    baseUrl: string;
    categories: StoryCategoryKey[];
    ageBands: string[];
    defaultLocale: string;
    supportedLocales: string[];
    enabled: boolean;
    sortOrder: number;
  }) =>
    apiFetch<{ source: StorySourceConfig }>('/api/v1/admin/story-sources', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAdminStorySource: (
    id: string,
    patch: Partial<{
      name: { vi: string; en: string };
      description: { vi: string; en: string };
      adapterType: StorySourceAdapterType;
      baseUrl: string;
      categories: StoryCategoryKey[];
      ageBands: string[];
      defaultLocale: string;
      supportedLocales: string[];
      enabled: boolean;
      sortOrder: number;
    }>
  ) =>
    apiFetch<{ source: StorySourceConfig }>(
      `/api/v1/admin/story-sources/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }
    ),

  deleteAdminStorySource: (id: string, mode: DeleteMode = 'soft') =>
    apiFetch<{ removed: boolean; mode: DeleteMode }>(
      `/api/v1/admin/story-sources/${encodeURIComponent(id)}?mode=${mode}`,
      { method: 'DELETE' }
    ),

  restoreAdminStorySource: (id: string) =>
    apiFetch<{ source: StorySourceConfig }>(
      `/api/v1/admin/story-sources/${encodeURIComponent(id)}/restore`,
      { method: 'POST' }
    ),

  testAdminStorySource: (id: string) =>
    apiFetch<{
      ok: boolean;
      itemCount: number;
      message: string;
      durationMs: number;
      source: StorySourceConfig | null;
    }>(`/api/v1/admin/story-sources/${encodeURIComponent(id)}/test`, {
      method: 'POST',
    }),
};

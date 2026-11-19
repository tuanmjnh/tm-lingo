import type {
  ActivityAnswerResponse,
  AuthUserProfile,
  ExperienceMode,
  LearnerPreferences,
  LearnerProfile,
  LearningPackageSummary,
  LessonProgressRecord,
  LocaleConfig,
  ManagedUserRecord,
  MediaAssetRecord,
  NotificationCampaign,
  NotificationCategory,
  NotificationDeliveryLog,
  NotificationStatus,
  PushSubscriptionSummary,
  ResolvedLessonPayload,
  StoryBook,
  StoryReadingPosition,
  UserRole,
  VoiceProfile,
} from '../../packages/contracts/types';
import { getSupabaseAccessToken } from '../lib/supabase';

async function buildAuthHeaders(extra?: HeadersInit): Promise<Headers> {
  const headers = new Headers(extra);
  const token = await getSupabaseAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = await buildAuthHeaders(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  getCurrentUser: () =>
    apiFetch<{ user: AuthUserProfile | null }>('/api/v1/auth/me'),

  getLanguages: () => apiFetch<{ languages: LocaleConfig[] }>('/api/v1/languages'),

  getVoices: (locale?: string) => {
    const query = locale ? `?locale=${encodeURIComponent(locale)}` : '';
    return apiFetch<{ voices: VoiceProfile[] }>(`/api/v1/voices${query}`);
  },

  getLearners: () => apiFetch<{ learners: LearnerProfile[] }>('/api/v1/learners'),

  createLearner: (payload: {
    nickname: string;
    ageYears: number;
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

  getPackages: () =>
    apiFetch<{ packages: LearningPackageSummary[] }>('/api/v1/packages'),

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

  getStories: () => apiFetch<{ stories: StoryBook[] }>('/api/v1/stories'),

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

  listMedia: () =>
    apiFetch<{ assets: MediaAssetRecord[]; bucket: string }>('/api/v1/media'),

  uploadMedia: (payload: { file: File; title: string; locale: string }) => {
    const form = new FormData();
    form.append('file', payload.file);
    form.append('title', payload.title);
    form.append('locale', payload.locale);
    return apiFetch<{ asset: MediaAssetRecord }>('/api/v1/media/upload', {
      method: 'POST',
      body: form,
    });
  },

  deleteMedia: (assetId: string) =>
    apiFetch<{ removed: boolean }>(
      `/api/v1/media/${encodeURIComponent(assetId)}`,
      { method: 'DELETE' }
    ),

  getVapidPublicKey: () =>
    apiFetch<{ publicKey: string; configured: boolean }>(
      '/api/v1/notifications/vapid-public-key'
    ),

  getNotificationInbox: () =>
    apiFetch<{ notifications: NotificationCampaign[] }>(
      '/api/v1/notifications/inbox'
    ),

  getPushSubscriptions: () =>
    apiFetch<{ subscriptions: PushSubscriptionSummary[] }>(
      '/api/v1/notifications/subscriptions'
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

  unsubscribePush: (subscriptionId: string) =>
    apiFetch<{ removed: boolean }>(
      `/api/v1/notifications/subscriptions/${encodeURIComponent(subscriptionId)}`,
      { method: 'DELETE' }
    ),

  getNotificationCampaigns: () =>
    apiFetch<{
      campaigns: NotificationCampaign[];
      logs: NotificationDeliveryLog[];
    }>('/api/v1/notifications/campaigns'),

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
      '/api/v1/notifications/campaigns',
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
      `/api/v1/notifications/campaigns/${encodeURIComponent(campaignId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }
    ),

  deleteNotificationCampaign: (campaignId: string) =>
    apiFetch<{ removed: boolean }>(
      `/api/v1/notifications/campaigns/${encodeURIComponent(campaignId)}`,
      { method: 'DELETE' }
    ),

  sendNotificationCampaign: (campaignId: string) =>
    apiFetch<{
      campaign: NotificationCampaign;
      log: NotificationDeliveryLog;
    }>(
      `/api/v1/notifications/campaigns/${encodeURIComponent(campaignId)}/send`,
      { method: 'POST' }
    ),

  listAdminUsers: () =>
    apiFetch<{ users: ManagedUserRecord[] }>('/api/v1/admin/users'),

  updateUserRole: (userId: string, role: UserRole) =>
    apiFetch<{ user: ManagedUserRecord }>(
      `/api/v1/admin/users/${encodeURIComponent(userId)}/role`,
      {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }
    ),
};

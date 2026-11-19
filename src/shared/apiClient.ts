import type {
  ActivityAnswerResponse,
  ExperienceMode,
  LearnerPreferences,
  LearnerProfile,
  LearningPackageSummary,
  LessonProgressRecord,
  LocaleConfig,
  NotificationCampaign,
  NotificationCategory,
  NotificationDeliveryLog,
  NotificationStatus,
  PushSubscriptionSummary,
  ResolvedLessonPayload,
  StoryBook,
  StoryReadingPosition,
  VoiceProfile,
} from '../../packages/contracts/types';

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
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

  getVapidPublicKey: () =>
    apiFetch<{ publicKey: string; configured: boolean }>(
      '/api/v1/notifications/vapid-public-key'
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
};

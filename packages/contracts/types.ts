export type Direction = 'ltr' | 'rtl';

export type ContentStatus = 'ready' | 'partial' | 'planned';

export interface LocaleConfig {
  locale: string;
  languageCode: string;
  displayName: string;
  nativeName: string;
  direction: Direction;
  enabled: boolean;
  learningEnabled: boolean;
  explanationEnabled: boolean;
  uiEnabled: boolean;
  ttsEnabled: boolean;
  speechRecognitionEnabled: boolean;
  contentStatus: ContentStatus;
  fallbackLocale: string | null;
}

export type ExperienceMode =
  | 'guided'
  | 'flashcards'
  | 'listening'
  | 'game'
  | 'story'
  | 'explore';

export interface ExperiencePreset {
  id: string;
  mode: ExperienceMode;
  visualDensity: 'low' | 'medium';
  animationLevel: 'none' | 'gentle' | 'moderate';
  audioGuidance: boolean;
  showCaptions: boolean;
  allowReplay: boolean;
  reducedMotionCompatible: boolean;
  interactionPacing: 'child-led';
}

export interface LearnerPreferences {
  interfaceLocale: string;
  learningLocale: string;
  explanationLocale: string;
  narrationLocale: string;
  reducedMotion: boolean;
  dailyMinutesLimit: number;
  audioSpeed: number;
}

export interface LearnerProfile {
  id: string;
  schemaVersion: number;
  parentAccountId: string;
  nickname: string;
  ageYears: number;
  ageBand: '3-5';
  avatarTone: 'sky' | 'amber' | 'emerald' | 'rose';
  preferences: LearnerPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface ConceptLocalization {
  term: string;
  example: string;
  explanation: string;
  pronunciationGuide?: string;
}

export interface VocabularyConcept {
  conceptId: string;
  schemaVersion: number;
  assetRef: string;
  localizations: Record<string, ConceptLocalization>;
}

export type ActivityRendererType =
  | 'flashcard'
  | 'listen-and-select'
  | 'picture-choice'
  | 'match-pair';

export interface ActivityOption {
  id: string;
  conceptId: string;
  label: string;
  explanationLabel: string;
  assetRef: string;
}

export interface PublicActivity {
  id: string;
  type: ActivityRendererType;
  schemaVersion: number;
  promptText: string;
  promptExplanation: string;
  spokenText: string;
  spokenLocale: string;
  conceptId?: string;
  options: ActivityOption[];
  pairs?: Array<{
    id: string;
    conceptId: string;
    term: string;
    assetRef: string;
  }>;
}

export interface LearningPackageSummary {
  id: string;
  schemaVersion: number;
  topicId: string;
  ageBand: string[];
  learningLevel: 'starter';
  learningLocales: string[];
  explanationLocales: string[];
  availableExperienceModes: ExperienceMode[];
  titles: Record<string, string>;
  summaries: Record<string, string>;
  conceptCount: number;
  status: 'published' | 'draft';
}

export interface ResolvedLessonPayload {
  lessonId: string;
  learningPackageId: string;
  mode: ExperienceMode;
  preset: ExperiencePreset;
  learningLocale: string;
  explanationLocale: string;
  title: string;
  explanationSummary: string;
  availableExperienceModes: ExperienceMode[];
  activities: PublicActivity[];
}

export interface ActivityAnswerRequest {
  learnerId: string;
  lessonId: string;
  learningLocale: string;
  selectedId?: string;
  matchedPairs?: Array<{ wordId: string; imageId: string }>;
}

export interface ActivityAnswerResponse {
  activityId: string;
  correct: boolean;
  encouragementKey: 'great_job' | 'try_again' | 'completed';
  revealedConcept?: {
    term: string;
    example: string;
    explanation: string;
  };
}

export interface LessonProgressRecord {
  learnerId: string;
  lessonId: string;
  learningLocale: string;
  mode: ExperienceMode;
  completedActivityIds: string[];
  totalActivities: number;
  lastActivityIndex: number;
  completed: boolean;
  updatedAt: string;
}

export interface VoiceProfile {
  voiceId: string;
  providerId: string;
  supportedLocales: string[];
  displayName: string;
  voiceStyleTags: Array<'warm' | 'playful' | 'calm' | 'teacher-like'>;
  ageAppropriate: boolean;
  pitch: number;
  defaultRate: number;
}

export interface StorySegment {
  id: string;
  order: number;
  assetRef: string;
  conceptRef?: string;
  textByLocale: Record<string, string>;
  explanationByLocale: Record<string, string>;
}

export interface StoryBook {
  id: string;
  schemaVersion: number;
  learningPackageId: string;
  ageBands: string[];
  coverAssetRef: string;
  availableLocales: string[];
  availableExplanationLocales: string[];
  titles: Record<string, string>;
  summaries: Record<string, string>;
  segments: StorySegment[];
  status: 'published' | 'draft';
}

export interface StoryReadingPosition {
  learnerId: string;
  storyId: string;
  narrationLocale: string;
  segmentIndex: number;
  updatedAt: string;
}

export type NotificationCategory =
  | 'reminder'
  | 'story'
  | 'progress'
  | 'announcement';

export type NotificationStatus = 'draft' | 'scheduled' | 'sent';

export interface NotificationCampaign {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  locale: string;
  targetUrl: string;
  status: NotificationStatus;
  scheduledFor: string | null;
  sentCount: number;
  failedCount: number;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PushSubscriptionSummary {
  id: string;
  endpointPreview: string;
  deviceLabel: string;
  locale: string;
  topics: NotificationCategory[];
  createdAt: string;
}

export interface NotificationDeliveryLog {
  id: string;
  campaignId: string;
  campaignTitle: string;
  category: NotificationCategory;
  locale: string;
  sentCount: number;
  failedCount: number;
  mode: 'web-push' | 'no-subscribers';
  sentAt: string;
}


export type Direction = 'ltr' | 'rtl';

export type ContentStatus = 'ready' | 'partial' | 'planned';

export type DeleteMode = 'soft' | 'hard';

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
  archivedAt?: string | null;
}

export type ExperienceMode =
  | 'guided'
  | 'flashcards'
  | 'listening'
  | 'game'
  | 'story'
  | 'explore';

export type AgeGroupStage =
  | 'preschool'
  | 'primary_lower'
  | 'primary_upper'
  | 'middle_school'
  | 'high_school'
  | 'custom';

export type LearningLevel =
  | 'starter'
  | 'foundation'
  | 'elementary'
  | 'intermediate'
  | 'upper_intermediate'
  | 'advanced';

export interface AgeGroupUiProfile {
  visualDensity: 'low' | 'medium' | 'high';
  typographyScale: 'large' | 'comfortable' | 'standard';
  touchTarget: 'xl' | 'lg' | 'md';
  accentTone: 'sky' | 'emerald' | 'amber' | 'indigo' | 'violet';
  illustrationEmphasis: 'picture-first' | 'balanced' | 'text-focused';
  showPhoneticsByDefault: boolean;
  showBilingualExplanation: boolean;
  defaultAudioSpeed: number;
  defaultDailyMinutes: number;
  recommendedModes: ExperienceMode[];
  interactionPacing: 'child-led' | 'guided-step' | 'self-paced';
  gamificationStyle: 'gentle-stars' | 'badges-streaks' | 'progress-metrics';
}

export interface AgeGroupConfig {
  id: string;
  stage: AgeGroupStage;
  minAge: number;
  maxAge: number;
  grades: number[];
  gradeRange: {
    vi: string;
    en: string;
  };
  displayNames: {
    vi: string;
    en: string;
  };
  shortLabels: {
    vi: string;
    en: string;
  };
  descriptions: {
    vi: string;
    en: string;
  };
  cefrRange: string;
  defaultLearningLevel: LearningLevel;
  contentStatus: ContentStatus;
  enabled: boolean;
  sortOrder: number;
  uiProfile: AgeGroupUiProfile;
  isSystem?: boolean;
  archivedAt?: string | null;
  updatedAt?: string;
}

export interface ExperiencePreset {
  id: string;
  mode: ExperienceMode;
  visualDensity: 'low' | 'medium' | 'high';
  animationLevel: 'none' | 'gentle' | 'moderate';
  audioGuidance: boolean;
  showCaptions: boolean;
  allowReplay: boolean;
  reducedMotionCompatible: boolean;
  interactionPacing: 'child-led' | 'guided-step' | 'self-paced';
}

export interface LearnerPreferences {
  interfaceLocale: string;
  learningLocale: string;
  explanationLocale: string;
  narrationLocale: string;
  reducedMotion: boolean;
  dailyMinutesLimit: number;
  storyDailyMinutesLimit?: number;
  audioSpeed: number;
}

export interface LearnerProfile {
  id: string;
  schemaVersion: number;
  parentAccountId: string;
  nickname: string;
  ageYears: number;
  ageBand: string;
  gradeLevel?: number | null;
  avatarTone: 'sky' | 'amber' | 'emerald' | 'rose';
  preferences: LearnerPreferences;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConceptLocalization {
  term: string;
  example: string;
  explanation: string;
  pronunciationGuide?: string;
  audioUrl?: string;
}

export interface VocabularyConcept {
  conceptId: string;
  schemaVersion: number;
  assetRef: string;
  localizations: Record<string, ConceptLocalization>;
}

export type ActivityRendererType =
  | 'flashcard'
  | 'repeat-after-me'
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
  pronunciationGuide?: string;
  spokenText: string;
  spokenLocale: string;
  spokenAudioUrl?: string;
  conceptId?: string;
  options: ActivityOption[];
  pairs?: Array<{
    id: string;
    conceptId: string;
    term: string;
    assetRef: string;
  }>;
}

export type PublicationWorkflowStatus =
  | 'draft'
  | 'in_review'
  | 'published'
  | 'archived';

export interface LearningPackageSummary {
  id: string;
  schemaVersion: number;
  topicId: string;
  ageBand: string[];
  learningLevel: LearningLevel;
  learningLocales: string[];
  explanationLocales: string[];
  availableExperienceModes: ExperienceMode[];
  titles: Record<string, string>;
  summaries: Record<string, string>;
  conceptCount: number;
  status: PublicationWorkflowStatus;
  publishedVersion?: number;
  archivedAt?: string | null;
  updatedAt?: string;
}

export interface CmsLearningPackage extends LearningPackageSummary {
  concepts: VocabularyConcept[];
  createdAt: string;
  updatedAt: string;
  publishedSnapshotId?: string | null;
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
  archivedAt?: string | null;
}

export interface StorySegment {
  id: string;
  order: number;
  assetRef: string;
  conceptRef?: string;
  chapterTitle?: string;
  durationSec?: number;
  textByLocale: Record<string, string>;
  explanationByLocale: Record<string, string>;
  audioUrlByLocale?: Record<string, string>;
}

export type StoryFormat = 'picture_book' | 'audiobook' | 'long_story';

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
  status: PublicationWorkflowStatus;
  publishedVersion?: number;
  storyFormat?: StoryFormat;
  chapterCount?: number;
  totalDurationSec?: number;
  category?: StoryCategoryKey;
  sourceId?: string;
  sourceName?: string;
  externalId?: string;
  author?: string;
  archivedAt?: string | null;
  updatedAt?: string;
}

export interface StoryReadingPosition {
  learnerId: string;
  storyId: string;
  narrationLocale: string;
  segmentIndex: number;
  updatedAt: string;
}

export interface PublicationSnapshotRecord {
  snapshotId: string;
  entityType: 'package' | 'story';
  entityId: string;
  version: number;
  publishedBy: string;
  publishedAt: string;
  payload: CmsLearningPackage | StoryBook;
}

export interface GenerationJobRecord {
  id: string;
  kind: 'package' | 'story';
  operationType?: 'origin' | 'translate' | 'adapt' | 'safety_review';
  topic: string;
  learningLocale: string;
  explanationLocale: string;
  providerUsed: string;
  modelUsed: string;
  status: 'completed' | 'failed';
  createdEntityId?: string;
  errorMessage?: string;
  createdBy: string;
  createdAt: string;
}

export interface SafetyReviewCheck {
  criterion: string;
  passed: boolean;
  note: string;
}

export interface SafetyReviewResult {
  passed: boolean;
  score: number;
  ageReadiness: 'excellent' | 'good' | 'needs_revision';
  summary: string;
  checks: SafetyReviewCheck[];
  suggestions: string[];
  providerUsed: string;
  modelUsed: string;
  reviewedAt: string;
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
  archivedAt?: string | null;
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

export type UserRole = 'parent' | 'teacher' | 'admin';

export type AccountType = 'parent' | 'student';

export interface AuthUserProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  accountType?: AccountType;
  emailVerified?: boolean;
  provider: 'firebase' | 'tm-hub' | 'local-staff';
  roles?: string[];
  capabilities?: string[];
}

export interface FamilyInviteRecord {
  inviteCode: string;
  studentUid: string;
  studentName: string;
  ageYears: number;
  ageBand: string;
  gradeLevel: number;
  status: 'active' | 'claimed' | 'revoked';
  claimedByParentUid: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ObserverLinkRecord {
  linkId: string;
  parentUid: string;
  studentUid: string;
  parentDisplayName: string;
  studentName: string;
  ageYears: number;
  ageBand: string;
  gradeLevel: number;
  avatarTone: LearnerProfile['avatarTone'];
  inviteCode: string;
  completedLessonsCount: number;
  totalActivitiesCompleted: number;
  currentStreakDays: number;
  dailyMinutesGoal: number;
  status: 'active' | 'revoked';
  createdAt: string;
  updatedAt: string;
}

export interface ManagedUserRecord {
  userId: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  roles?: string[];
  isActive?: boolean;
  source?: 'tm-hub' | 'local';
  createdAt: string;
  updatedAt: string;
}

export interface StaffRoleRecord {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem?: boolean;
}

export interface StaffAuditLogEntry {
  id: string;
  action: string;
  modelName: string;
  docId: string;
  actorName: string;
  actorEmail?: string;
  summary: string;
  source: 'tm-hub' | 'tm-lingo-local';
  at: string;
}

export interface MediaAssetRecord {
  id: string;
  parentAccountId: string;
  title: string;
  kind: 'image' | 'audio';
  locale: string;
  mimeType: string;
  sizeBytes: number;
  storageBucket: string;
  storagePath: string;
  publicUrl: string;
  storageProvider?: string;
  storageConnectionId?: string;
  archivedAt?: string | null;
  createdAt: string;
}

export interface AIProviderModelView {
  modelId: string;
  displayName: string;
  enabled: boolean;
  isPrimary?: boolean;
  discoveredAt?: string;
}

export interface AIProviderConnectionView {
  connectionId: string;
  providerKey: string;
  providerName: string;
  baseUrl: string;
  hasKey: boolean;
  enabled: boolean;
  models: AIProviderModelView[];
  source: 'mongodb' | 'env-fallback';
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type StorageProviderKind = 'cloudflare_r2' | 'aws_s3' | 's3_compatible';

export interface StorageConnectionView {
  connectionId: string;
  name: string;
  provider: StorageProviderKind;
  endpoint: string;
  region: string;
  bucket: string;
  publicBaseUrl: string;
  pathPrefix: string;
  hasCredentials: boolean;
  isDefault: boolean;
  enabled: boolean;
  lastTestOk: boolean | null;
  lastTestAt: string | null;
  lastTestMessage?: string | null;
  source: 'mongodb' | 'env-fallback';
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ParentConsentPurpose =
  | 'child_profile_storage'
  | 'learning_progress_sync'
  | 'web_push_reminders';

export interface ParentConsentRecord {
  purpose: ParentConsentPurpose;
  granted: boolean;
  policyVersion: string;
  recordedAt: string;
}

export interface ParentPrivacySummary {
  parentAccountId: string;
  policyVersion: string;
  consents: ParentConsentRecord[];
  consentHistoryCount: number;
  learnerCount: number;
  progressCount: number;
  storyPositionCount: number;
  archivedAt: string | null;
}

export interface ParentDataExportPayload {
  exportedAt: string;
  policyVersion: string;
  parentAccountId: string;
  consents: ParentConsentRecord[];
  learners: LearnerProfile[];
  lessonProgress: LessonProgressRecord[];
  storyPositions: StoryReadingPosition[];
}

export type StoryCategoryKey =
  | 'fables'
  | 'animals'
  | 'bedtime'
  | 'adventure'
  | 'science'
  | 'life-skills'
  | 'classics';

export type StorySourceAdapterType =
  | 'curated_library'
  | 'librivox'
  | 'wikisource'
  | 'archive_org'
  | 'gutendex'
  | 'rss'
  | 'json_catalog';

export interface StorySourceConfig {
  id: string;
  name: {
    vi: string;
    en: string;
  };
  description: {
    vi: string;
    en: string;
  };
  adapterType: StorySourceAdapterType;
  baseUrl: string;
  categories: StoryCategoryKey[];
  ageBands: string[];
  defaultLocale: string;
  supportedLocales: string[];
  enabled: boolean;
  sortOrder: number;
  isSystem?: boolean;
  lastTestedAt?: string | null;
  lastTestStatus?: 'ok' | 'error' | null;
  lastTestMessage?: string | null;
  lastItemCount?: number | null;
  archivedAt?: string | null;
  updatedAt?: string;
}

export interface ExternalStoryCatalogItem {
  externalId: string;
  sourceId: string;
  sourceName: {
    vi: string;
    en: string;
  };
  adapterType: StorySourceAdapterType;
  title: string;
  titleVi?: string;
  author?: string;
  summary: string;
  summaryVi?: string;
  category: StoryCategoryKey;
  ageBands: string[];
  locale: string;
  availableLocales: string[];
  coverAssetRef: string;
  storyFormat?: StoryFormat;
  chapterCount?: number;
  totalDurationSec?: number;
  hasAudio?: boolean;
  estimatedMinutes?: number;
  alreadyImportedStoryId?: string | null;
}

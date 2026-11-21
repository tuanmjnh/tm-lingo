import type {
  DeleteMode,
  LearnerProfile,
  LessonProgressRecord,
  ParentConsentPurpose,
  ParentConsentRecord,
  ParentDataExportPayload,
  ParentPrivacySummary,
  StoryReadingPosition,
} from '../../packages/contracts/types';
import { getMongoCollection } from '../db/mongo';
import { lingoStore } from '../data/seedStore';

interface AccountConsentDoc {
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
  role: 'parent';
  consents?: ParentConsentRecord[];
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const memoryConsents = new Map<string, ParentConsentRecord[]>();
const CURRENT_POLICY_VERSION = '2026.11';

const DEFAULT_CONSENT_PURPOSES: ParentConsentPurpose[] = [
  'child_profile_storage',
  'learning_progress_sync',
  'web_push_reminders',
];

export async function getParentPrivacySummary(
  parentAccountId: string
): Promise<ParentPrivacySummary> {
  const accountCol = await getMongoCollection<AccountConsentDoc>('accounts');
  let consents: ParentConsentRecord[] = [];
  let archivedAt: string | null = null;

  if (accountCol) {
    const doc = await accountCol.findOne(
      { firebaseUid: parentAccountId },
      { projection: { _id: 0 } }
    );
    consents = doc?.consents ?? [];
    archivedAt = doc?.archivedAt ?? null;
  } else {
    consents = memoryConsents.get(parentAccountId) ?? [];
  }

  // Ensure every consent purpose has an explicit latest state
  const latestByPurpose = new Map<ParentConsentPurpose, ParentConsentRecord>();
  for (const record of consents) {
    latestByPurpose.set(record.purpose, record);
  }
  for (const purpose of DEFAULT_CONSENT_PURPOSES) {
    if (!latestByPurpose.has(purpose)) {
      latestByPurpose.set(purpose, {
        purpose,
        granted: purpose !== 'web_push_reminders',
        policyVersion: CURRENT_POLICY_VERSION,
        recordedAt: new Date().toISOString(),
      });
    }
  }

  const learners = await lingoStore.listLearners(parentAccountId);
  let progressCount = 0;
  let storyPositionCount = 0;

  const progressCol = await getMongoCollection<LessonProgressRecord>('lesson_progress');
  const storyPosCol = await getMongoCollection<StoryReadingPosition>('story_positions');

  if (progressCol) {
    progressCount = await progressCol.countDocuments({ parentAccountId });
  } else {
    for (const learner of learners) {
      const p = await lingoStore.getProgressForLearner(parentAccountId, learner.id);
      progressCount += p.length;
    }
  }

  if (storyPosCol) {
    storyPositionCount = await storyPosCol.countDocuments({ parentAccountId });
  }

  return {
    parentAccountId,
    policyVersion: CURRENT_POLICY_VERSION,
    consents: Array.from(latestByPurpose.values()),
    consentHistoryCount: consents.length,
    learnerCount: learners.length,
    progressCount,
    storyPositionCount,
    archivedAt,
  };
}

export async function recordParentConsent(input: {
  parentAccountId: string;
  purpose: ParentConsentPurpose;
  granted: boolean;
}): Promise<ParentConsentRecord> {
  const entry: ParentConsentRecord = {
    purpose: input.purpose,
    granted: input.granted,
    policyVersion: CURRENT_POLICY_VERSION,
    recordedAt: new Date().toISOString(),
  };

  const existingMem = memoryConsents.get(input.parentAccountId) ?? [];
  memoryConsents.set(input.parentAccountId, [...existingMem, entry]);

  const accountCol = await getMongoCollection<AccountConsentDoc>('accounts');
  if (accountCol) {
    await accountCol.updateOne(
      { firebaseUid: input.parentAccountId },
      {
        $push: { consents: entry },
        $set: { updatedAt: entry.recordedAt },
        $setOnInsert: {
          firebaseUid: input.parentAccountId,
          email: null,
          displayName: null,
          role: 'parent',
          createdAt: entry.recordedAt,
        },
      },
      { upsert: true }
    );
  }

  return entry;
}

export async function exportParentData(
  parentAccountId: string
): Promise<ParentDataExportPayload> {
  const summary = await getParentPrivacySummary(parentAccountId);
  const learners = await lingoStore.listLearners(parentAccountId);

  const progressCol = await getMongoCollection<
    LessonProgressRecord & { parentAccountId: string }
  >('lesson_progress');
  const storyPosCol = await getMongoCollection<
    StoryReadingPosition & { parentAccountId: string }
  >('story_positions');

  let progress: LessonProgressRecord[] = [];
  if (progressCol) {
    progress = (await progressCol
      .find({ parentAccountId }, { projection: { _id: 0, parentAccountId: 0 } })
      .toArray()) as LessonProgressRecord[];
  } else {
    for (const learner of learners) {
      const items = await lingoStore.getProgressForLearner(
        parentAccountId,
        learner.id
      );
      progress.push(...items);
    }
  }

  let storyPositions: StoryReadingPosition[] = [];
  if (storyPosCol) {
    storyPositions = (await storyPosCol
      .find({ parentAccountId }, { projection: { _id: 0, parentAccountId: 0 } })
      .toArray()) as StoryReadingPosition[];
  }

  return {
    exportedAt: new Date().toISOString(),
    policyVersion: CURRENT_POLICY_VERSION,
    parentAccountId,
    consents: summary.consents,
    learners,
    lessonProgress: progress,
    storyPositions,
  };
}

export async function deleteParentData(input: {
  parentAccountId: string;
  mode: DeleteMode;
}): Promise<{
  mode: DeleteMode;
  affectedLearners: number;
  deletedProgress: number;
  deletedStoryPositions: number;
  archivedAt?: string | null;
}> {
  const now = new Date().toISOString();
  const learnersCol = await getMongoCollection<LearnerProfile>('learners');
  const progressCol = await getMongoCollection('lesson_progress');
  const storyPosCol = await getMongoCollection('story_positions');
  const accountCol = await getMongoCollection<AccountConsentDoc>('accounts');

  if (input.mode === 'soft') {
    let affectedLearners = 0;
    if (learnersCol) {
      const res = await learnersCol.updateMany(
        { parentAccountId: input.parentAccountId },
        { $set: { archivedAt: now, updatedAt: now } }
      );
      affectedLearners = res.modifiedCount;
    }
    if (accountCol) {
      await accountCol.updateOne(
        { firebaseUid: input.parentAccountId },
        { $set: { archivedAt: now, updatedAt: now } },
        { upsert: true }
      );
    }
    return {
      mode: 'soft',
      affectedLearners,
      deletedProgress: 0,
      deletedStoryPositions: 0,
      archivedAt: now,
    };
  }

  // Hard delete: permanently purge child profiles, progress, story positions, and consent records
  let affectedLearners = 0;
  let deletedProgress = 0;
  let deletedStoryPositions = 0;

  if (learnersCol) {
    const res = await learnersCol.deleteMany({
      parentAccountId: input.parentAccountId,
    });
    affectedLearners = res.deletedCount;
  }
  if (progressCol) {
    const res = await progressCol.deleteMany({
      parentAccountId: input.parentAccountId,
    });
    deletedProgress = res.deletedCount;
  }
  if (storyPosCol) {
    const res = await storyPosCol.deleteMany({
      parentAccountId: input.parentAccountId,
    });
    deletedStoryPositions = res.deletedCount;
  }
  if (accountCol) {
    await accountCol.deleteOne({ firebaseUid: input.parentAccountId });
  }
  memoryConsents.delete(input.parentAccountId);

  return {
    mode: 'hard',
    affectedLearners,
    deletedProgress,
    deletedStoryPositions,
    archivedAt: null,
  };
}

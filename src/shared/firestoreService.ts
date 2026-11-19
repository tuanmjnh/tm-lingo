import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  ExperienceMode,
  LearnerPreferences,
  LearnerProfile,
  LessonProgressRecord,
  StoryReadingPosition,
} from '../../packages/contracts/types';
import { db, handleFirestoreError, OperationType } from '../firebase';

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

function sanitizeId(raw: string, maxLen: number): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, maxLen);
  if (!cleaned || !VALID_ID_REGEX.test(cleaned)) {
    return `id-${Date.now().toString(36)}`;
  }
  return cleaned;
}

function sanitizeText(raw: string, maxLen: number, fallback: string): string {
  const trimmed = raw.trim().slice(0, maxLen);
  return trimmed.length > 0 ? trimmed : fallback;
}

function sanitizeLocale(raw: string, fallback: string): string {
  const cleaned = raw.replace(/[^a-zA-Z-]/g, '').slice(0, 10);
  return cleaned.length >= 2 ? cleaned : fallback;
}

function toIsoString(val: unknown): string {
  if (val && typeof val === 'object' && 'toDate' in val) {
    return (val as Timestamp).toDate().toISOString();
  }
  return new Date().toISOString();
}

export async function ensureParentAccount(
  parentId: string,
  displayName: string
): Promise<void> {
  const safeParentId = sanitizeId(parentId, 128);
  const docPath = `parents/${safeParentId}`;
  const ref = doc(db, 'parents', safeParentId);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        parentId: safeParentId,
        displayName: sanitizeText(displayName, 80, 'Parent'),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function seedStarterLearnerIfEmpty(
  parentId: string
): Promise<void> {
  const safeParentId = sanitizeId(parentId, 128);
  const colPath = `parents/${safeParentId}/learners`;
  try {
    const q = query(
      collection(db, 'parents', safeParentId, 'learners'),
      where('parentId', '==', safeParentId)
    );
    const snap = await getDocs(q);
    if (!snap.empty) return;

    const learnerId = 'learner-min';
    await setDoc(doc(db, 'parents', safeParentId, 'learners', learnerId), {
      learnerId,
      parentId: safeParentId,
      nickname: 'Bé Min',
      ageYears: 4,
      avatarTone: 'sky',
      interfaceLocale: 'vi',
      learningLocale: 'en',
      explanationLocale: 'vi',
      narrationLocale: 'en',
      reducedMotion: false,
      dailyMinutesLimit: 15,
      audioSpeed: 0.9,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, colPath);
  }
}

export function subscribeLearners(
  parentId: string,
  onChange: (learners: LearnerProfile[]) => void
): Unsubscribe {
  const safeParentId = sanitizeId(parentId, 128);
  const colPath = `parents/${safeParentId}/learners`;
  const q = query(
    collection(db, 'parents', safeParentId, 'learners'),
    where('parentId', '==', safeParentId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: LearnerProfile[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: String(d.learnerId ?? docSnap.id),
          schemaVersion: 1,
          parentAccountId: String(d.parentId ?? safeParentId),
          nickname: String(d.nickname ?? 'Bé'),
          ageYears: Number(d.ageYears ?? 4),
          ageBand: '3-5',
          avatarTone: (d.avatarTone as LearnerProfile['avatarTone']) ?? 'sky',
          preferences: {
            interfaceLocale: String(d.interfaceLocale ?? 'vi'),
            learningLocale: String(d.learningLocale ?? 'en'),
            explanationLocale: String(d.explanationLocale ?? 'vi'),
            narrationLocale: String(d.narrationLocale ?? 'en'),
            reducedMotion: Boolean(d.reducedMotion),
            dailyMinutesLimit: Number(d.dailyMinutesLimit ?? 15),
            audioSpeed: Number(d.audioSpeed ?? 0.9),
          },
          createdAt: toIsoString(d.createdAt),
          updatedAt: toIsoString(d.updatedAt),
        };
      });
      onChange(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, colPath);
    }
  );
}

export async function createFirestoreLearner(
  parentId: string,
  input: {
    nickname: string;
    ageYears: number;
    avatarTone: LearnerProfile['avatarTone'];
    interfaceLocale: string;
    learningLocale: string;
    explanationLocale: string;
    narrationLocale: string;
  }
): Promise<string> {
  const safeParentId = sanitizeId(parentId, 128);
  const learnerId = sanitizeId(`learner-${Date.now().toString(36)}`, 64);
  const docPath = `parents/${safeParentId}/learners/${learnerId}`;
  try {
    await setDoc(doc(db, 'parents', safeParentId, 'learners', learnerId), {
      learnerId,
      parentId: safeParentId,
      nickname: sanitizeText(input.nickname, 32, 'Bé'),
      ageYears: Math.min(5, Math.max(3, Math.round(input.ageYears))),
      avatarTone: input.avatarTone,
      interfaceLocale: sanitizeLocale(input.interfaceLocale, 'vi'),
      learningLocale: sanitizeLocale(input.learningLocale, 'en'),
      explanationLocale: sanitizeLocale(input.explanationLocale, 'vi'),
      narrationLocale: sanitizeLocale(input.narrationLocale, 'en'),
      reducedMotion: false,
      dailyMinutesLimit: 15,
      audioSpeed: 0.9,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return learnerId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function updateFirestoreLearnerPreferences(
  parentId: string,
  learnerId: string,
  patch: Partial<LearnerPreferences>
): Promise<void> {
  const safeParentId = sanitizeId(parentId, 128);
  const safeLearnerId = sanitizeId(learnerId, 64);
  const docPath = `parents/${safeParentId}/learners/${safeLearnerId}`;

  const updatePayload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (patch.interfaceLocale !== undefined) {
    updatePayload.interfaceLocale = sanitizeLocale(patch.interfaceLocale, 'vi');
  }
  if (patch.learningLocale !== undefined) {
    updatePayload.learningLocale = sanitizeLocale(patch.learningLocale, 'en');
  }
  if (patch.explanationLocale !== undefined) {
    updatePayload.explanationLocale = sanitizeLocale(
      patch.explanationLocale,
      'vi'
    );
  }
  if (patch.narrationLocale !== undefined) {
    updatePayload.narrationLocale = sanitizeLocale(patch.narrationLocale, 'en');
  }
  if (patch.reducedMotion !== undefined) {
    updatePayload.reducedMotion = Boolean(patch.reducedMotion);
  }
  if (patch.dailyMinutesLimit !== undefined) {
    updatePayload.dailyMinutesLimit = Math.min(
      60,
      Math.max(5, Math.round(patch.dailyMinutesLimit))
    );
  }
  if (patch.audioSpeed !== undefined) {
    updatePayload.audioSpeed = Math.min(
      1.25,
      Math.max(0.65, Number(patch.audioSpeed))
    );
  }

  try {
    await updateDoc(
      doc(db, 'parents', safeParentId, 'learners', safeLearnerId),
      updatePayload
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export function subscribeProgress(
  parentId: string,
  learnerId: string,
  onChange: (records: LessonProgressRecord[]) => void
): Unsubscribe {
  const safeParentId = sanitizeId(parentId, 128);
  const safeLearnerId = sanitizeId(learnerId, 64);
  const colPath = `parents/${safeParentId}/progress`;
  const q = query(
    collection(db, 'parents', safeParentId, 'progress'),
    where('parentId', '==', safeParentId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const records: LessonProgressRecord[] = snapshot.docs
        .map((docSnap) => {
          const d = docSnap.data();
          return {
            learnerId: String(d.learnerId ?? ''),
            lessonId: String(d.lessonId ?? ''),
            learningLocale: String(d.learningLocale ?? 'en'),
            mode: (d.mode as ExperienceMode) ?? 'guided',
            completedActivityIds: Array.isArray(d.completedActivityIds)
              ? d.completedActivityIds.map(String)
              : [],
            totalActivities: Number(d.totalActivities ?? 1),
            lastActivityIndex: Number(d.lastActivityIndex ?? 0),
            completed: Boolean(d.completed),
            updatedAt: toIsoString(d.updatedAt),
          };
        })
        .filter((r) => r.learnerId === safeLearnerId);
      onChange(records);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, colPath);
    }
  );
}

export async function saveFirestoreProgress(
  parentId: string,
  record: Omit<LessonProgressRecord, 'updatedAt'>
): Promise<void> {
  const safeParentId = sanitizeId(parentId, 128);
  const safeLearnerId = sanitizeId(record.learnerId, 64);
  const safeLessonId = sanitizeId(record.lessonId, 64);
  const safeLocale = sanitizeLocale(record.learningLocale, 'en');
  const progressId = sanitizeId(
    `${safeLearnerId}_${safeLessonId}_${safeLocale}_${record.mode}`,
    128
  );
  const docPath = `parents/${safeParentId}/progress/${progressId}`;
  const ref = doc(db, 'parents', safeParentId, 'progress', progressId);

  const safeActivityIds = record.completedActivityIds
    .slice(0, 20)
    .map((id) => sanitizeId(id, 64));

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        completedActivityIds: safeActivityIds,
        totalActivities: Math.min(50, Math.max(1, Math.round(record.totalActivities))),
        lastActivityIndex: Math.min(
          50,
          Math.max(0, Math.round(record.lastActivityIndex))
        ),
        completed: Boolean(record.completed),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        progressId,
        parentId: safeParentId,
        learnerId: safeLearnerId,
        lessonId: safeLessonId,
        learningLocale: safeLocale,
        mode: record.mode,
        completedActivityIds: safeActivityIds,
        totalActivities: Math.min(50, Math.max(1, Math.round(record.totalActivities))),
        lastActivityIndex: Math.min(
          50,
          Math.max(0, Math.round(record.lastActivityIndex))
        ),
        completed: Boolean(record.completed),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function getFirestoreStoryPosition(
  parentId: string,
  learnerId: string,
  storyId: string
): Promise<StoryReadingPosition | null> {
  const safeParentId = sanitizeId(parentId, 128);
  const safeLearnerId = sanitizeId(learnerId, 64);
  const safeStoryId = sanitizeId(storyId, 64);
  const positionId = sanitizeId(`${safeLearnerId}_${safeStoryId}`, 128);
  const docPath = `parents/${safeParentId}/storyPositions/${positionId}`;

  try {
    const snap = await getDoc(
      doc(db, 'parents', safeParentId, 'storyPositions', positionId)
    );
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      learnerId: String(d.learnerId ?? safeLearnerId),
      storyId: String(d.storyId ?? safeStoryId),
      narrationLocale: String(d.narrationLocale ?? 'en'),
      segmentIndex: Number(d.segmentIndex ?? 0),
      updatedAt: toIsoString(d.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }
}

export async function saveFirestoreStoryPosition(
  parentId: string,
  input: {
    learnerId: string;
    storyId: string;
    narrationLocale: string;
    segmentIndex: number;
  }
): Promise<void> {
  const safeParentId = sanitizeId(parentId, 128);
  const safeLearnerId = sanitizeId(input.learnerId, 64);
  const safeStoryId = sanitizeId(input.storyId, 64);
  const positionId = sanitizeId(`${safeLearnerId}_${safeStoryId}`, 128);
  const docPath = `parents/${safeParentId}/storyPositions/${positionId}`;
  const ref = doc(db, 'parents', safeParentId, 'storyPositions', positionId);

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        narrationLocale: sanitizeLocale(input.narrationLocale, 'en'),
        segmentIndex: Math.min(100, Math.max(0, Math.round(input.segmentIndex))),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        positionId,
        parentId: safeParentId,
        learnerId: safeLearnerId,
        storyId: safeStoryId,
        narrationLocale: sanitizeLocale(input.narrationLocale, 'en'),
        segmentIndex: Math.min(100, Math.max(0, Math.round(input.segmentIndex))),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

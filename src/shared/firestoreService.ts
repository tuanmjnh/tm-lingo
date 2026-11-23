import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  AccountType,
  ExperienceMode,
  FamilyInviteRecord,
  LearnerPreferences,
  LearnerProfile,
  LessonProgressRecord,
  ObserverLinkRecord,
  StoryReadingPosition,
} from '../../packages/contracts/types';
import { db, handleFirestoreError, OperationType } from '../firebase';

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const VALID_AGE_BAND_REGEX = /^[a-zA-Z0-9_-]+$/;
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

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

function inferAgeBandFromYears(ageYears: number): string {
  if (ageYears <= 5) return '3-5';
  if (ageYears <= 8) return '6-8';
  if (ageYears <= 11) return '9-11';
  if (ageYears <= 14) return '12-14';
  return '15-18';
}

function sanitizeAgeBand(raw: string | undefined, ageYears: number): string {
  const cleaned = (raw ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
  if (cleaned.length >= 1 && VALID_AGE_BAND_REGEX.test(cleaned)) {
    return cleaned;
  }
  return inferAgeBandFromYears(ageYears);
}

function inferGradeFromAge(ageYears: number): number {
  if (ageYears <= 5) return 0;
  return Math.min(12, Math.max(1, ageYears - 5));
}

function clampInt(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(val)));
}

function clampSpeed(val: number): number {
  const rounded = Math.round(Number(val) * 100) / 100;
  if (!Number.isFinite(rounded)) return 0.95;
  return Math.min(1.5, Math.max(0.65, rounded));
}

function toIsoString(val: unknown): string {
  if (val && typeof val === 'object' && 'toDate' in val) {
    return (val as Timestamp).toDate().toISOString();
  }
  return new Date().toISOString();
}

function generateSixCharCode(): string {
  const chars: string[] = [];
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 6; i += 1) {
      chars.push(INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length]);
    }
  } else {
    for (let i = 0; i < 6; i += 1) {
      chars.push(
        INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)]
      );
    }
  }
  return chars.join('');
}

export interface ConsumerAccountDoc {
  parentId: string;
  displayName: string;
  accountType: AccountType;
  createdAt: string;
  updatedAt: string;
}

export async function getAccountDoc(
  uid: string
): Promise<ConsumerAccountDoc | null> {
  const safeUid = sanitizeId(uid, 128);
  const docPath = `parents/${safeUid}`;
  try {
    const snap = await getDoc(doc(db, 'parents', safeUid));
    if (!snap.exists()) return null;
    const d = snap.data();
    const rawType = d.accountType;
    const accountType: AccountType =
      rawType === 'student' ? 'student' : 'parent';
    return {
      parentId: String(d.parentId ?? safeUid),
      displayName: String(d.displayName ?? 'User'),
      accountType,
      createdAt: toIsoString(d.createdAt),
      updatedAt: toIsoString(d.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }
}

export async function upsertAccountDoc(
  uid: string,
  displayName: string,
  accountType: AccountType
): Promise<ConsumerAccountDoc> {
  const safeUid = sanitizeId(uid, 128);
  const safeName = sanitizeText(displayName, 80, accountType === 'student' ? 'Student' : 'Parent');
  const docPath = `parents/${safeUid}`;
  const ref = doc(db, 'parents', safeUid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        parentId: safeUid,
        displayName: safeName,
        accountType,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = snap.data();
      if (
        existingData.accountType !== accountType ||
        !existingData.accountType ||
        existingData.displayName !== safeName
      ) {
        await updateDoc(ref, {
          displayName: safeName,
          accountType,
          updatedAt: serverTimestamp(),
        });
      }
    }
    const nowIso = new Date().toISOString();
    return {
      parentId: safeUid,
      displayName: safeName,
      accountType,
      createdAt: snap.exists() ? toIsoString(snap.data().createdAt) : nowIso,
      updatedAt: nowIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function ensureParentAccount(
  parentId: string,
  displayName: string,
  defaultAccountType: AccountType = 'parent'
): Promise<ConsumerAccountDoc> {
  const existing = await getAccountDoc(parentId);
  if (existing) {
    // Backfill accountType if legacy doc existed without it
    const safeUid = sanitizeId(parentId, 128);
    const snap = await getDoc(doc(db, 'parents', safeUid));
    if (snap.exists() && !snap.data().accountType) {
      return upsertAccountDoc(safeUid, existing.displayName, defaultAccountType);
    }
    return existing;
  }
  return upsertAccountDoc(parentId, displayName, defaultAccountType);
}

function mapLearnerDoc(
  safeParentId: string,
  docId: string,
  d: Record<string, unknown>
): LearnerProfile {
  const ageYears = clampInt(Number(d.ageYears ?? 4), 3, 18);
  const ageBand = sanitizeAgeBand(
    typeof d.ageBand === 'string' ? d.ageBand : undefined,
    ageYears
  );
  const gradeLevel =
    typeof d.gradeLevel === 'number'
      ? clampInt(d.gradeLevel, 0, 12)
      : inferGradeFromAge(ageYears);

  return {
    id: String(d.learnerId ?? docId),
    schemaVersion: 2,
    parentAccountId: String(d.parentId ?? safeParentId),
    nickname: String(d.nickname ?? 'Learner'),
    ageYears,
    ageBand,
    gradeLevel,
    avatarTone: (d.avatarTone as LearnerProfile['avatarTone']) ?? 'sky',
    preferences: {
      interfaceLocale: String(d.interfaceLocale ?? 'vi'),
      learningLocale: String(d.learningLocale ?? 'en'),
      explanationLocale: String(d.explanationLocale ?? 'vi'),
      narrationLocale: String(d.narrationLocale ?? 'en'),
      reducedMotion: Boolean(d.reducedMotion),
      dailyMinutesLimit: clampInt(Number(d.dailyMinutesLimit ?? 15), 5, 180),
      storyDailyMinutesLimit: clampInt(
        Number(d.storyDailyMinutesLimit ?? 15),
        5,
        120
      ),
      audioSpeed: clampSpeed(Number(d.audioSpeed ?? 0.95)),
    },
    createdAt: toIsoString(d.createdAt),
    updatedAt: toIsoString(d.updatedAt),
  };
}

export function subscribeLearners(
  parentId: string,
  onChange: (learners: LearnerProfile[]) => void,
  onError?: (error: Error) => void
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
        const d = docSnap.data() as Record<string, unknown>;
        const mapped = mapLearnerDoc(safeParentId, docSnap.id, d);
        // Silently backfill legacy docs missing K-12 fields so future updates satisfy strict rules
        if (
          typeof d.ageBand !== 'string' ||
          typeof d.gradeLevel !== 'number' ||
          typeof d.storyDailyMinutesLimit !== 'number'
        ) {
          void updateDoc(doc(db, 'parents', safeParentId, 'learners', docSnap.id), {
            ageBand: mapped.ageBand,
            gradeLevel: mapped.gradeLevel ?? 0,
            storyDailyMinutesLimit: mapped.preferences.storyDailyMinutesLimit ?? 15,
            updatedAt: serverTimestamp(),
          }).catch(() => undefined);
        }
        return mapped;
      });
      items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      onChange(items);
    },
    (error) => {
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      handleFirestoreError(error, OperationType.LIST, colPath);
    }
  );
}

export async function listFirestoreLearners(
  parentId: string
): Promise<LearnerProfile[]> {
  const safeParentId = sanitizeId(parentId, 128);
  const colPath = `parents/${safeParentId}/learners`;
  try {
    const q = query(
      collection(db, 'parents', safeParentId, 'learners'),
      where('parentId', '==', safeParentId)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((docSnap) =>
        mapLearnerDoc(safeParentId, docSnap.id, docSnap.data() as Record<string, unknown>)
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, colPath);
  }
}

export async function createFirestoreLearner(
  parentId: string,
  input: {
    nickname: string;
    ageYears: number;
    ageBand?: string;
    gradeLevel?: number | null;
    avatarTone: LearnerProfile['avatarTone'];
    interfaceLocale: string;
    learningLocale: string;
    explanationLocale: string;
    narrationLocale: string;
    dailyMinutesLimit?: number;
    storyDailyMinutesLimit?: number;
    audioSpeed?: number;
  }
): Promise<LearnerProfile> {
  const safeParentId = sanitizeId(parentId, 128);
  const learnerId = sanitizeId(
    `learner-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    64
  );
  const docPath = `parents/${safeParentId}/learners/${learnerId}`;
  const safeAgeYears = clampInt(input.ageYears, 3, 18);
  const safeAgeBand = sanitizeAgeBand(input.ageBand, safeAgeYears);
  const safeGradeLevel =
    typeof input.gradeLevel === 'number'
      ? clampInt(input.gradeLevel, 0, 12)
      : inferGradeFromAge(safeAgeYears);
  const defaultDailyMinutes =
    safeAgeYears >= 15 ? 40 : safeAgeYears >= 12 ? 30 : safeAgeYears >= 9 ? 25 : safeAgeYears >= 6 ? 20 : 15;
  const defaultAudioSpeed =
    safeAgeYears >= 12 ? 1.0 : safeAgeYears >= 6 ? 0.95 : 0.9;

  const payload = {
    learnerId,
    parentId: safeParentId,
    nickname: sanitizeText(input.nickname, 32, 'Learner'),
    ageYears: safeAgeYears,
    ageBand: safeAgeBand,
    gradeLevel: safeGradeLevel,
    avatarTone: input.avatarTone,
    interfaceLocale: sanitizeLocale(input.interfaceLocale, 'vi'),
    learningLocale: sanitizeLocale(input.learningLocale, 'en'),
    explanationLocale: sanitizeLocale(input.explanationLocale, 'vi'),
    narrationLocale: sanitizeLocale(input.narrationLocale, 'en'),
    reducedMotion: false,
    dailyMinutesLimit: clampInt(
      input.dailyMinutesLimit ?? defaultDailyMinutes,
      5,
      180
    ),
    storyDailyMinutesLimit: clampInt(
      input.storyDailyMinutesLimit ?? 15,
      5,
      120
    ),
    audioSpeed: clampSpeed(input.audioSpeed ?? defaultAudioSpeed),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'parents', safeParentId, 'learners', learnerId), payload);
    const nowIso = new Date().toISOString();
    return {
      id: learnerId,
      schemaVersion: 2,
      parentAccountId: safeParentId,
      nickname: payload.nickname,
      ageYears: payload.ageYears,
      ageBand: payload.ageBand,
      gradeLevel: payload.gradeLevel,
      avatarTone: payload.avatarTone,
      preferences: {
        interfaceLocale: payload.interfaceLocale,
        learningLocale: payload.learningLocale,
        explanationLocale: payload.explanationLocale,
        narrationLocale: payload.narrationLocale,
        reducedMotion: payload.reducedMotion,
        dailyMinutesLimit: payload.dailyMinutesLimit,
        storyDailyMinutesLimit: payload.storyDailyMinutesLimit,
        audioSpeed: payload.audioSpeed,
      },
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function updateFirestoreLearnerProfile(
  parentId: string,
  learnerId: string,
  patch: {
    nickname?: string;
    ageYears?: number;
    ageBand?: string;
    gradeLevel?: number | null;
    avatarTone?: LearnerProfile['avatarTone'];
    dailyMinutesLimit?: number;
    storyDailyMinutesLimit?: number;
    audioSpeed?: number;
  }
): Promise<void> {
  const safeParentId = sanitizeId(parentId, 128);
  const safeLearnerId = sanitizeId(learnerId, 64);
  const docPath = `parents/${safeParentId}/learners/${safeLearnerId}`;

  const updatePayload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (patch.nickname !== undefined) {
    updatePayload.nickname = sanitizeText(patch.nickname, 32, 'Learner');
  }
  if (patch.ageYears !== undefined) {
    updatePayload.ageYears = clampInt(patch.ageYears, 3, 18);
  }
  if (patch.ageBand !== undefined) {
    updatePayload.ageBand = sanitizeAgeBand(
      patch.ageBand,
      patch.ageYears ?? 12
    );
  }
  if (patch.gradeLevel !== undefined && patch.gradeLevel !== null) {
    updatePayload.gradeLevel = clampInt(patch.gradeLevel, 0, 12);
  }
  if (patch.avatarTone !== undefined) {
    updatePayload.avatarTone = patch.avatarTone;
  }
  if (patch.dailyMinutesLimit !== undefined) {
    updatePayload.dailyMinutesLimit = clampInt(patch.dailyMinutesLimit, 5, 180);
  }
  if (patch.storyDailyMinutesLimit !== undefined) {
    updatePayload.storyDailyMinutesLimit = clampInt(
      patch.storyDailyMinutesLimit,
      5,
      120
    );
  }
  if (patch.audioSpeed !== undefined) {
    updatePayload.audioSpeed = clampSpeed(patch.audioSpeed);
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
    updatePayload.dailyMinutesLimit = clampInt(patch.dailyMinutesLimit, 5, 180);
  }
  if (patch.storyDailyMinutesLimit !== undefined) {
    updatePayload.storyDailyMinutesLimit = clampInt(
      patch.storyDailyMinutesLimit,
      5,
      120
    );
  }
  if (patch.audioSpeed !== undefined) {
    updatePayload.audioSpeed = clampSpeed(patch.audioSpeed);
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

function mapProgressDoc(d: Record<string, unknown>): LessonProgressRecord {
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
}

export function subscribeProgress(
  parentId: string,
  learnerId: string,
  onChange: (records: LessonProgressRecord[]) => void,
  onError?: (error: Error) => void
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
      const records = snapshot.docs
        .map((docSnap) => mapProgressDoc(docSnap.data() as Record<string, unknown>))
        .filter((r) => r.learnerId === safeLearnerId);
      onChange(records);
    },
    (error) => {
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      handleFirestoreError(error, OperationType.LIST, colPath);
    }
  );
}

export async function listAllFirestoreProgress(
  parentId: string
): Promise<LessonProgressRecord[]> {
  const safeParentId = sanitizeId(parentId, 128);
  const colPath = `parents/${safeParentId}/progress`;
  try {
    const q = query(
      collection(db, 'parents', safeParentId, 'progress'),
      where('parentId', '==', safeParentId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) =>
      mapProgressDoc(docSnap.data() as Record<string, unknown>)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, colPath);
  }
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
    .slice(0, 50)
    .map((id) => sanitizeId(id, 64));

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        completedActivityIds: safeActivityIds,
        totalActivities: clampInt(record.totalActivities, 1, 100),
        lastActivityIndex: clampInt(record.lastActivityIndex, 0, 100),
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
        totalActivities: clampInt(record.totalActivities, 1, 100),
        lastActivityIndex: clampInt(record.lastActivityIndex, 0, 100),
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
        segmentIndex: clampInt(input.segmentIndex, 0, 200),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        positionId,
        parentId: safeParentId,
        learnerId: safeLearnerId,
        storyId: safeStoryId,
        narrationLocale: sanitizeLocale(input.narrationLocale, 'en'),
        segmentIndex: clampInt(input.segmentIndex, 0, 200),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

// ---------- Teen Student -> Parent Read-Only Observer Linking ----------

function mapInviteDoc(d: Record<string, unknown>): FamilyInviteRecord {
  return {
    inviteCode: String(d.inviteCode ?? ''),
    studentUid: String(d.studentUid ?? ''),
    studentName: String(d.studentName ?? 'Student'),
    ageYears: Number(d.ageYears ?? 13),
    ageBand: String(d.ageBand ?? '12-14'),
    gradeLevel: Number(d.gradeLevel ?? 7),
    status: (d.status as FamilyInviteRecord['status']) ?? 'active',
    claimedByParentUid: String(d.claimedByParentUid ?? ''),
    expiresAt: toIsoString(d.expiresAt),
    createdAt: toIsoString(d.createdAt),
    updatedAt: toIsoString(d.updatedAt),
  };
}

function mapObserverLinkDoc(d: Record<string, unknown>): ObserverLinkRecord {
  return {
    linkId: String(d.linkId ?? ''),
    parentUid: String(d.parentUid ?? ''),
    studentUid: String(d.studentUid ?? ''),
    parentDisplayName: String(d.parentDisplayName ?? 'Parent'),
    studentName: String(d.studentName ?? 'Student'),
    ageYears: Number(d.ageYears ?? 13),
    ageBand: String(d.ageBand ?? '12-14'),
    gradeLevel: Number(d.gradeLevel ?? 7),
    avatarTone: (d.avatarTone as LearnerProfile['avatarTone']) ?? 'sky',
    inviteCode: String(d.inviteCode ?? ''),
    completedLessonsCount: Number(d.completedLessonsCount ?? 0),
    totalActivitiesCompleted: Number(d.totalActivitiesCompleted ?? 0),
    currentStreakDays: Number(d.currentStreakDays ?? 0),
    dailyMinutesGoal: Number(d.dailyMinutesGoal ?? 30),
    status: (d.status as ObserverLinkRecord['status']) ?? 'active',
    createdAt: toIsoString(d.createdAt),
    updatedAt: toIsoString(d.updatedAt),
  };
}

export async function createStudentInviteCode(
  studentUid: string,
  studentProfile: LearnerProfile
): Promise<FamilyInviteRecord> {
  const safeStudentUid = sanitizeId(studentUid, 128);
  const code = generateSixCharCode();
  const docPath = `familyInvites/${code}`;
  const expiresMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const expiresAtTs = Timestamp.fromMillis(expiresMs);

  const safeAge = clampInt(studentProfile.ageYears, 3, 18);
  const safeBand = sanitizeAgeBand(studentProfile.ageBand, safeAge);
  const safeGrade =
    typeof studentProfile.gradeLevel === 'number'
      ? clampInt(studentProfile.gradeLevel, 0, 12)
      : inferGradeFromAge(safeAge);

  try {
    await setDoc(doc(db, 'familyInvites', code), {
      inviteCode: code,
      studentUid: safeStudentUid,
      studentName: sanitizeText(studentProfile.nickname, 32, 'Student'),
      ageYears: safeAge,
      ageBand: safeBand,
      gradeLevel: safeGrade,
      status: 'active',
      claimedByParentUid: '',
      expiresAt: expiresAtTs,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const nowIso = new Date().toISOString();
    return {
      inviteCode: code,
      studentUid: safeStudentUid,
      studentName: sanitizeText(studentProfile.nickname, 32, 'Student'),
      ageYears: safeAge,
      ageBand: safeBand,
      gradeLevel: safeGrade,
      status: 'active',
      claimedByParentUid: '',
      expiresAt: new Date(expiresMs).toISOString(),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export function subscribeStudentInvites(
  studentUid: string,
  onChange: (invites: FamilyInviteRecord[]) => void
): Unsubscribe {
  const safeStudentUid = sanitizeId(studentUid, 128);
  const q = query(
    collection(db, 'familyInvites'),
    where('studentUid', '==', safeStudentUid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((s) => mapInviteDoc(s.data() as Record<string, unknown>))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onChange(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'familyInvites');
    }
  );
}

export async function revokeStudentInvite(inviteCode: string): Promise<void> {
  const code = inviteCode.trim().toUpperCase();
  const docPath = `familyInvites/${code}`;
  try {
    await updateDoc(doc(db, 'familyInvites', code), {
      status: 'revoked',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function redeemStudentInviteCode(
  parentUid: string,
  parentDisplayName: string,
  rawCode: string
): Promise<ObserverLinkRecord> {
  const safeParentUid = sanitizeId(parentUid, 128);
  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    throw new Error('Mã liên kết phải gồm đúng 6 ký tự chữ/số (ví dụ: AB3K9P).');
  }

  const inviteRef = doc(db, 'familyInvites', code);
  const inviteSnap = await getDoc(inviteRef);
  if (!inviteSnap.exists()) {
    throw new Error('Không tìm thấy mã liên kết này. Vui lòng kiểm tra lại với con.');
  }

  const invite = mapInviteDoc(inviteSnap.data() as Record<string, unknown>);
  if (invite.status !== 'active') {
    throw new Error('Mã liên kết này đã được sử dụng hoặc đã bị thu hồi.');
  }
  if (new Date(invite.expiresAt).getTime() <= Date.now()) {
    throw new Error('Mã liên kết đã hết hạn. Con có thể tạo mã mới trong mục Tự học.');
  }
  if (invite.studentUid === safeParentUid) {
    throw new Error('Bạn không thể tự liên kết với chính tài khoản đang đăng nhập.');
  }

  const linkId = `${safeParentUid}_${invite.studentUid}`;
  const linkRef = doc(db, 'observerLinks', linkId);
  const safeParentName = sanitizeText(parentDisplayName, 80, 'Parent');

  try {
    const batch = writeBatch(db);
    batch.update(inviteRef, {
      status: 'claimed',
      claimedByParentUid: safeParentUid,
      updatedAt: serverTimestamp(),
    });
    batch.set(linkRef, {
      linkId,
      parentUid: safeParentUid,
      studentUid: invite.studentUid,
      parentDisplayName: safeParentName,
      studentName: invite.studentName,
      ageYears: clampInt(invite.ageYears, 3, 18),
      ageBand: sanitizeAgeBand(invite.ageBand, invite.ageYears),
      gradeLevel: clampInt(invite.gradeLevel, 0, 12),
      avatarTone: 'sky',
      inviteCode: code,
      completedLessonsCount: 0,
      totalActivitiesCompleted: 0,
      currentStreakDays: 0,
      dailyMinutesGoal: 30,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    const nowIso = new Date().toISOString();
    return {
      linkId,
      parentUid: safeParentUid,
      studentUid: invite.studentUid,
      parentDisplayName: safeParentName,
      studentName: invite.studentName,
      ageYears: invite.ageYears,
      ageBand: invite.ageBand,
      gradeLevel: invite.gradeLevel,
      avatarTone: 'sky',
      inviteCode: code,
      completedLessonsCount: 0,
      totalActivitiesCompleted: 0,
      currentStreakDays: 0,
      dailyMinutesGoal: 30,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `observerLinks/${linkId}`);
  }
}

export function subscribeObserverLinksForParent(
  parentUid: string,
  onChange: (links: ObserverLinkRecord[]) => void
): Unsubscribe {
  const safeParentUid = sanitizeId(parentUid, 128);
  const q = query(
    collection(db, 'observerLinks'),
    where('parentUid', '==', safeParentUid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((s) => mapObserverLinkDoc(s.data() as Record<string, unknown>))
        .filter((l) => l.status === 'active')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      onChange(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'observerLinks');
    }
  );
}

export function subscribeObserverLinksForStudent(
  studentUid: string,
  onChange: (links: ObserverLinkRecord[]) => void
): Unsubscribe {
  const safeStudentUid = sanitizeId(studentUid, 128);
  const q = query(
    collection(db, 'observerLinks'),
    where('studentUid', '==', safeStudentUid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((s) => mapObserverLinkDoc(s.data() as Record<string, unknown>))
        .filter((l) => l.status === 'active')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      onChange(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'observerLinks');
    }
  );
}

export async function syncStudentObserverSnapshots(
  studentUid: string,
  snapshot: {
    studentName: string;
    ageYears: number;
    ageBand: string;
    gradeLevel: number;
    avatarTone: LearnerProfile['avatarTone'];
    completedLessonsCount: number;
    totalActivitiesCompleted: number;
    currentStreakDays: number;
    dailyMinutesGoal: number;
  }
): Promise<void> {
  const safeStudentUid = sanitizeId(studentUid, 128);
  try {
    const q = query(
      collection(db, 'observerLinks'),
      where('studentUid', '==', safeStudentUid)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const batch = writeBatch(db);
    let activeCount = 0;
    for (const docSnap of snap.docs) {
      const d = docSnap.data();
      if (d.status !== 'active') continue;
      activeCount += 1;
      batch.update(docSnap.ref, {
        studentName: sanitizeText(snapshot.studentName, 32, 'Student'),
        ageYears: clampInt(snapshot.ageYears, 3, 18),
        ageBand: sanitizeAgeBand(snapshot.ageBand, snapshot.ageYears),
        gradeLevel: clampInt(snapshot.gradeLevel, 0, 12),
        avatarTone: snapshot.avatarTone,
        completedLessonsCount: clampInt(snapshot.completedLessonsCount, 0, 5000),
        totalActivitiesCompleted: clampInt(
          snapshot.totalActivitiesCompleted,
          0,
          50000
        ),
        currentStreakDays: clampInt(snapshot.currentStreakDays, 0, 3650),
        dailyMinutesGoal: clampInt(snapshot.dailyMinutesGoal, 5, 180),
        updatedAt: serverTimestamp(),
      });
    }
    if (activeCount > 0) {
      await batch.commit();
    }
  } catch {
    // Non-blocking background sync to observer links
  }
}

export async function unlinkObserverLink(linkId: string): Promise<void> {
  const safeLinkId = sanitizeId(linkId, 128);
  const docPath = `observerLinks/${safeLinkId}`;
  try {
    await deleteDoc(doc(db, 'observerLinks', safeLinkId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

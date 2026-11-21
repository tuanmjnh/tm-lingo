import type { AgeGroupConfig, DeleteMode } from '../../packages/contracts/types';
import { getMongoCollection } from '../db/mongo';

const PROTECTED_AGE_GROUPS = new Set(['3-5']);

export const DEFAULT_AGE_GROUPS: AgeGroupConfig[] = [
  {
    id: '3-5',
    stage: 'preschool',
    minAge: 3,
    maxAge: 5,
    grades: [],
    gradeRange: {
      vi: 'Mầm non',
      en: 'Preschool',
    },
    displayNames: {
      vi: 'Mầm non (3–5 tuổi)',
      en: 'Early Childhood (Ages 3–5)',
    },
    shortLabels: {
      vi: '3–5 tuổi · Mầm non',
      en: 'Ages 3–5 · Preschool',
    },
    descriptions: {
      vi: 'Làm quen âm thanh, từ vựng đời sống và truyện tranh minh họa lớn với nhịp độ nhẹ nhàng, không áp lực.',
      en: 'Gentle picture-first vocabulary, everyday sounds, and calm read-aloud picture stories.',
    },
    cefrRange: 'Pre-A1',
    defaultLearningLevel: 'starter',
    contentStatus: 'ready',
    enabled: true,
    sortOrder: 1,
    isSystem: true,
    uiProfile: {
      visualDensity: 'low',
      typographyScale: 'large',
      touchTarget: 'xl',
      accentTone: 'sky',
      illustrationEmphasis: 'picture-first',
      showPhoneticsByDefault: false,
      showBilingualExplanation: true,
      defaultAudioSpeed: 0.85,
      defaultDailyMinutes: 15,
      recommendedModes: ['guided', 'flashcards', 'listening', 'game', 'explore', 'story'],
      interactionPacing: 'child-led',
      gamificationStyle: 'gentle-stars',
    },
  },
  {
    id: '6-8',
    stage: 'primary_lower',
    minAge: 6,
    maxAge: 8,
    grades: [1, 2, 3],
    gradeRange: {
      vi: 'Lớp 1 – Lớp 3',
      en: 'Grades 1–3',
    },
    displayNames: {
      vi: 'Tiểu học nền tảng · Lớp 1–3 (6–8 tuổi)',
      en: 'Lower Primary · Grades 1–3 (Ages 6–8)',
    },
    shortLabels: {
      vi: '6–8 tuổi · Lớp 1–3',
      en: 'Ages 6–8 · Grades 1–3',
    },
    descriptions: {
      vi: 'Phát triển ngữ âm, mẫu câu giao tiếp ngắn và ghép từ – câu quen thuộc ở trường và gia đình.',
      en: 'Phonics foundations, short conversational patterns, and school-and-home vocabulary.',
    },
    cefrRange: 'Pre-A1 – A1',
    defaultLearningLevel: 'foundation',
    contentStatus: 'partial',
    enabled: true,
    sortOrder: 2,
    isSystem: true,
    uiProfile: {
      visualDensity: 'low',
      typographyScale: 'large',
      touchTarget: 'lg',
      accentTone: 'emerald',
      illustrationEmphasis: 'picture-first',
      showPhoneticsByDefault: true,
      showBilingualExplanation: true,
      defaultAudioSpeed: 0.92,
      defaultDailyMinutes: 20,
      recommendedModes: ['guided', 'flashcards', 'listening', 'game', 'explore', 'story'],
      interactionPacing: 'guided-step',
      gamificationStyle: 'gentle-stars',
    },
  },
  {
    id: '9-11',
    stage: 'primary_upper',
    minAge: 9,
    maxAge: 11,
    grades: [4, 5],
    gradeRange: {
      vi: 'Lớp 4 – Lớp 5',
      en: 'Grades 4–5',
    },
    displayNames: {
      vi: 'Tiểu học nâng cao · Lớp 4–5 (9–11 tuổi)',
      en: 'Upper Primary · Grades 4–5 (Ages 9–11)',
    },
    shortLabels: {
      vi: '9–11 tuổi · Lớp 4–5',
      en: 'Ages 9–11 · Grades 4–5',
    },
    descriptions: {
      vi: 'Mở rộng vốn từ theo chủ đề khoa học – đời sống, luyện đọc hiểu đoạn ngắn và phát âm rõ ngữ điệu.',
      en: 'Expanded thematic vocabulary, short reading comprehension, and clear pronunciation fluency.',
    },
    cefrRange: 'A1 – A2',
    defaultLearningLevel: 'elementary',
    contentStatus: 'partial',
    enabled: true,
    sortOrder: 3,
    isSystem: true,
    uiProfile: {
      visualDensity: 'medium',
      typographyScale: 'comfortable',
      touchTarget: 'lg',
      accentTone: 'amber',
      illustrationEmphasis: 'balanced',
      showPhoneticsByDefault: true,
      showBilingualExplanation: true,
      defaultAudioSpeed: 0.98,
      defaultDailyMinutes: 25,
      recommendedModes: ['guided', 'flashcards', 'listening', 'game', 'explore', 'story'],
      interactionPacing: 'guided-step',
      gamificationStyle: 'badges-streaks',
    },
  },
  {
    id: '12-14',
    stage: 'middle_school',
    minAge: 12,
    maxAge: 14,
    grades: [6, 7, 8, 9],
    gradeRange: {
      vi: 'Lớp 6 – Lớp 9',
      en: 'Grades 6–9',
    },
    displayNames: {
      vi: 'Trung học cơ sở · Lớp 6–9 (12–14 tuổi)',
      en: 'Middle School · Grades 6–9 (Ages 12–14)',
    },
    shortLabels: {
      vi: '12–14 tuổi · Lớp 6–9',
      en: 'Ages 12–14 · Grades 6–9',
    },
    descriptions: {
      vi: 'Luyện giao tiếp tự nhiên, ngữ pháp ứng dụng, từ vựng học thuật cơ bản và đọc truyện song ngữ theo ngữ cảnh.',
      en: 'Natural conversation, applied grammar, foundational academic vocabulary, and contextual bilingual reading.',
    },
    cefrRange: 'A2 – B1',
    defaultLearningLevel: 'intermediate',
    contentStatus: 'planned',
    enabled: true,
    sortOrder: 4,
    isSystem: true,
    uiProfile: {
      visualDensity: 'medium',
      typographyScale: 'standard',
      touchTarget: 'md',
      accentTone: 'indigo',
      illustrationEmphasis: 'balanced',
      showPhoneticsByDefault: true,
      showBilingualExplanation: true,
      defaultAudioSpeed: 1.0,
      defaultDailyMinutes: 30,
      recommendedModes: ['guided', 'flashcards', 'listening', 'explore', 'game', 'story'],
      interactionPacing: 'self-paced',
      gamificationStyle: 'badges-streaks',
    },
  },
  {
    id: '15-18',
    stage: 'high_school',
    minAge: 15,
    maxAge: 18,
    grades: [10, 11, 12],
    gradeRange: {
      vi: 'Lớp 10 – Lớp 12',
      en: 'Grades 10–12',
    },
    displayNames: {
      vi: 'Trung học phổ thông · Lớp 10–12 (15–18 tuổi)',
      en: 'High School · Grades 10–12 (Ages 15–18)',
    },
    shortLabels: {
      vi: '15–18 tuổi · Lớp 10–12',
      en: 'Ages 15–18 · Grades 10–12',
    },
    descriptions: {
      vi: 'Tập trung từ vựng học thuật, diễn đạt chuẩn xác, nghe hiểu tốc độ tự nhiên và chuẩn bị tốt nghiệp / chứng chỉ quốc tế.',
      en: 'Academic vocabulary, precision expression, natural-pace listening, and exam/certification readiness.',
    },
    cefrRange: 'B1 – B2+',
    defaultLearningLevel: 'upper_intermediate',
    contentStatus: 'planned',
    enabled: true,
    sortOrder: 5,
    isSystem: true,
    uiProfile: {
      visualDensity: 'high',
      typographyScale: 'standard',
      touchTarget: 'md',
      accentTone: 'violet',
      illustrationEmphasis: 'text-focused',
      showPhoneticsByDefault: true,
      showBilingualExplanation: false,
      defaultAudioSpeed: 1.05,
      defaultDailyMinutes: 40,
      recommendedModes: ['flashcards', 'listening', 'explore', 'guided', 'story'],
      interactionPacing: 'self-paced',
      gamificationStyle: 'progress-metrics',
    },
  },
];

const memoryAgeGroups = new Map<string, AgeGroupConfig>();
let mongoSeeded = false;

function initMemory(): void {
  if (memoryAgeGroups.size === 0) {
    const now = new Date().toISOString();
    for (const group of DEFAULT_AGE_GROUPS) {
      memoryAgeGroups.set(group.id, {
        ...group,
        archivedAt: null,
        updatedAt: now,
      });
    }
  }
}

async function ensureAgeGroupsSeeded(): Promise<void> {
  initMemory();
  if (mongoSeeded) return;
  mongoSeeded = true;

  const col = await getMongoCollection<AgeGroupConfig>('age_groups');
  if (!col) return;

  const now = new Date().toISOString();
  // Seed any missing system defaults idempotently without overwriting admin customizations
  for (const group of DEFAULT_AGE_GROUPS) {
    await col.updateOne(
      { id: group.id },
      {
        $setOnInsert: {
          ...group,
          archivedAt: null,
          updatedAt: now,
        },
      },
      { upsert: true }
    );
  }
}

export async function listAgeGroups(options?: {
  includeArchived?: boolean;
  enabledOnly?: boolean;
}): Promise<AgeGroupConfig[]> {
  await ensureAgeGroupsSeeded();
  const includeArchived = Boolean(options?.includeArchived);
  const enabledOnly = Boolean(options?.enabledOnly);
  const col = await getMongoCollection<AgeGroupConfig>('age_groups');

  let items: AgeGroupConfig[];
  if (col) {
    const filter: Record<string, unknown> = {};
    if (!includeArchived) {
      filter.$or = [{ archivedAt: null }, { archivedAt: { $exists: false } }];
    }
    if (enabledOnly) {
      filter.enabled = true;
    }
    items = await col
      .find(filter, { projection: { _id: 0 } })
      .sort({ sortOrder: 1, minAge: 1 })
      .toArray();
  } else {
    items = Array.from(memoryAgeGroups.values())
      .filter((g) => (includeArchived ? true : !g.archivedAt))
      .filter((g) => (enabledOnly ? g.enabled : true))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.minAge - b.minAge);
  }

  return items;
}

export async function getAgeGroupById(
  id: string
): Promise<AgeGroupConfig | null> {
  await ensureAgeGroupsSeeded();
  const col = await getMongoCollection<AgeGroupConfig>('age_groups');
  if (col) {
    return col.findOne({ id }, { projection: { _id: 0 } });
  }
  return memoryAgeGroups.get(id) ?? null;
}

export async function resolveAgeGroupForAge(
  ageYears: number,
  gradeLevel?: number | null
): Promise<AgeGroupConfig> {
  const groups = await listAgeGroups({ includeArchived: false });

  if (typeof gradeLevel === 'number' && gradeLevel >= 1) {
    const byGrade = groups.find(
      (g) => g.enabled && g.grades.includes(gradeLevel)
    );
    if (byGrade) return byGrade;
  }

  const byAge = groups.find(
    (g) => g.enabled && ageYears >= g.minAge && ageYears <= g.maxAge
  );
  if (byAge) return byAge;

  const fallbackAny = groups.find(
    (g) => ageYears >= g.minAge && ageYears <= g.maxAge
  );
  return fallbackAny ?? groups[0] ?? DEFAULT_AGE_GROUPS[0];
}

export async function upsertAgeGroup(
  input: AgeGroupConfig
): Promise<AgeGroupConfig> {
  await ensureAgeGroupsSeeded();
  const normalizedId = input.id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const normalized: AgeGroupConfig = {
    ...input,
    id: normalizedId,
    grades: Array.from(
      new Set(
        (input.grades ?? []).filter(
          (g) => Number.isInteger(g) && g >= 1 && g <= 12
        )
      )
    ).sort((a, b) => a - b),
    gradeRange: {
      vi: input.gradeRange.vi.trim(),
      en: input.gradeRange.en.trim(),
    },
    displayNames: {
      vi: input.displayNames.vi.trim(),
      en: input.displayNames.en.trim(),
    },
    shortLabels: {
      vi: input.shortLabels.vi.trim(),
      en: input.shortLabels.en.trim(),
    },
    descriptions: {
      vi: input.descriptions.vi.trim(),
      en: input.descriptions.en.trim(),
    },
    cefrRange: input.cefrRange.trim() || 'Pre-A1',
    archivedAt: input.archivedAt ?? null,
    updatedAt: new Date().toISOString(),
  };

  memoryAgeGroups.set(normalized.id, normalized);
  const col = await getMongoCollection<AgeGroupConfig>('age_groups');
  if (col) {
    await col.updateOne(
      { id: normalized.id },
      { $set: normalized },
      { upsert: true }
    );
  }
  return normalized;
}

export async function deleteAgeGroup(
  id: string,
  mode: DeleteMode = 'soft'
): Promise<{ ok: boolean; mode: DeleteMode; ageGroup?: AgeGroupConfig }> {
  await ensureAgeGroupsSeeded();
  if (mode === 'hard' && PROTECTED_AGE_GROUPS.has(id)) {
    throw new Error(
      `Core age group "${id}" cannot be permanently deleted. You may archive or disable it instead.`
    );
  }

  const existing = await getAgeGroupById(id);
  if (!existing) {
    return { ok: false, mode };
  }

  const col = await getMongoCollection<AgeGroupConfig>('age_groups');

  if (mode === 'hard') {
    memoryAgeGroups.delete(id);
    if (col) {
      await col.deleteOne({ id });
    }
    return { ok: true, mode: 'hard' };
  }

  const archived: AgeGroupConfig = {
    ...existing,
    enabled: false,
    archivedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  memoryAgeGroups.set(id, archived);
  if (col) {
    await col.updateOne({ id }, { $set: archived });
  }
  return { ok: true, mode: 'soft', ageGroup: archived };
}

export async function restoreAgeGroup(
  id: string
): Promise<AgeGroupConfig | null> {
  await ensureAgeGroupsSeeded();
  const existing = await getAgeGroupById(id);
  if (!existing) return null;

  const restored: AgeGroupConfig = {
    ...existing,
    enabled: true,
    archivedAt: null,
    updatedAt: new Date().toISOString(),
  };
  memoryAgeGroups.set(id, restored);
  const col = await getMongoCollection<AgeGroupConfig>('age_groups');
  if (col) {
    await col.updateOne({ id }, { $set: restored });
  }
  return restored;
}

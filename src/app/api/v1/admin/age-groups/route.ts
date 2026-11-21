import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../server/auth/hubClient';
import {
  listAgeGroups,
  upsertAgeGroup,
} from '../../../../../../server/data/ageGroupRepository';

const uiProfileSchema = z.object({
  visualDensity: z.enum(['low', 'medium', 'high']).default('medium'),
  typographyScale: z.enum(['large', 'comfortable', 'standard']).default('comfortable'),
  touchTarget: z.enum(['xl', 'lg', 'md']).default('lg'),
  accentTone: z.enum(['sky', 'emerald', 'amber', 'indigo', 'violet']).default('sky'),
  illustrationEmphasis: z
    .enum(['picture-first', 'balanced', 'text-focused'])
    .default('balanced'),
  showPhoneticsByDefault: z.boolean().default(true),
  showBilingualExplanation: z.boolean().default(true),
  defaultAudioSpeed: z.number().min(0.65).max(1.25).default(0.95),
  defaultDailyMinutes: z.number().int().min(5).max(120).default(20),
  recommendedModes: z
    .array(
      z.enum(['guided', 'flashcards', 'listening', 'game', 'story', 'explore'])
    )
    .min(1)
    .default(['guided', 'flashcards', 'listening', 'game', 'explore', 'story']),
  interactionPacing: z
    .enum(['child-led', 'guided-step', 'self-paced'])
    .default('guided-step'),
  gamificationStyle: z
    .enum(['gentle-stars', 'badges-streaks', 'progress-metrics'])
    .default('gentle-stars'),
});

const ageGroupSchema = z.object({
  id: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9-]+$/),
  stage: z
    .enum([
      'preschool',
      'primary_lower',
      'primary_upper',
      'middle_school',
      'high_school',
      'custom',
    ])
    .default('custom'),
  minAge: z.number().int().min(2).max(25),
  maxAge: z.number().int().min(2).max(99),
  grades: z.array(z.number().int().min(1).max(12)).default([]),
  gradeRange: z.object({
    vi: z.string().min(1).max(80),
    en: z.string().min(1).max(80),
  }),
  displayNames: z.object({
    vi: z.string().min(1).max(100),
    en: z.string().min(1).max(100),
  }),
  shortLabels: z.object({
    vi: z.string().min(1).max(60),
    en: z.string().min(1).max(60),
  }),
  descriptions: z.object({
    vi: z.string().min(1).max(280),
    en: z.string().min(1).max(280),
  }),
  cefrRange: z.string().min(1).max(32).default('Pre-A1'),
  defaultLearningLevel: z
    .enum([
      'starter',
      'foundation',
      'elementary',
      'intermediate',
      'upper_intermediate',
      'advanced',
    ])
    .default('starter'),
  contentStatus: z.enum(['ready', 'partial', 'planned']).default('planned'),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().min(1).max(99).default(10),
  uiProfile: uiProfileSchema,
});

export async function GET(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.content.read',
    async () => {
      const includeArchived =
        request.nextUrl.searchParams.get('includeArchived') === '1';
      const ageGroups = await listAgeGroups({ includeArchived });
      return NextResponse.json({ ageGroups });
    }
  );
}

export async function POST(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.content.publish',
    async ({ staff }) => {
      const body = await request.json().catch(() => ({}));
      const parsed = ageGroupSchema.safeParse(body);
      if (!parsed.success || parsed.data.maxAge < parsed.data.minAge) {
        return jsonError('Invalid age group configuration payload', 400);
      }

      const saved = await upsertAgeGroup({
        ...parsed.data,
        isSystem: false,
        archivedAt: null,
      });

      await recordStaffAudit({
        action: 'age_group.upsert',
        modelName: 'age_groups',
        docId: saved.id,
        actorName: staff.displayName || staff.email || 'Admin',
        actorEmail: staff.email || undefined,
        summary: `Saved age group ${saved.id} (${saved.displayNames.en})`,
      });

      return NextResponse.json({ ageGroup: saved }, { status: 201 });
    }
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  enforceHardDeleteRootGuard,
  jsonError,
  withStaffCapability,
} from '../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../server/auth/hubClient';
import {
  deleteAgeGroup,
  getAgeGroupById,
  upsertAgeGroup,
} from '../../../../../../../server/data/ageGroupRepository';

const patchUiProfileSchema = z
  .object({
    visualDensity: z.enum(['low', 'medium', 'high']).optional(),
    typographyScale: z.enum(['large', 'comfortable', 'standard']).optional(),
    touchTarget: z.enum(['xl', 'lg', 'md']).optional(),
    accentTone: z
      .enum(['sky', 'emerald', 'amber', 'indigo', 'violet'])
      .optional(),
    illustrationEmphasis: z
      .enum(['picture-first', 'balanced', 'text-focused'])
      .optional(),
    showPhoneticsByDefault: z.boolean().optional(),
    showBilingualExplanation: z.boolean().optional(),
    defaultAudioSpeed: z.number().min(0.65).max(1.25).optional(),
    defaultDailyMinutes: z.number().int().min(5).max(120).optional(),
    recommendedModes: z
      .array(
        z.enum([
          'guided',
          'flashcards',
          'listening',
          'game',
          'story',
          'explore',
        ])
      )
      .min(1)
      .optional(),
    interactionPacing: z
      .enum(['child-led', 'guided-step', 'self-paced'])
      .optional(),
    gamificationStyle: z
      .enum(['gentle-stars', 'badges-streaks', 'progress-metrics'])
      .optional(),
  })
  .optional();

const patchAgeGroupSchema = z.object({
  stage: z
    .enum([
      'preschool',
      'primary_lower',
      'primary_upper',
      'middle_school',
      'high_school',
      'custom',
    ])
    .optional(),
  minAge: z.number().int().min(2).max(25).optional(),
  maxAge: z.number().int().min(2).max(99).optional(),
  grades: z.array(z.number().int().min(1).max(12)).optional(),
  gradeRange: z
    .object({
      vi: z.string().min(1).max(80),
      en: z.string().min(1).max(80),
    })
    .optional(),
  displayNames: z
    .object({
      vi: z.string().min(1).max(100),
      en: z.string().min(1).max(100),
    })
    .optional(),
  shortLabels: z
    .object({
      vi: z.string().min(1).max(60),
      en: z.string().min(1).max(60),
    })
    .optional(),
  descriptions: z
    .object({
      vi: z.string().min(1).max(280),
      en: z.string().min(1).max(280),
    })
    .optional(),
  cefrRange: z.string().min(1).max(32).optional(),
  defaultLearningLevel: z
    .enum([
      'starter',
      'foundation',
      'elementary',
      'intermediate',
      'upper_intermediate',
      'advanced',
    ])
    .optional(),
  contentStatus: z.enum(['ready', 'partial', 'planned']).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(1).max(99).optional(),
  uiProfile: patchUiProfileSchema,
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.content.publish',
    async ({ staff }) => {
      const { id } = await context.params;
      const existing = await getAgeGroupById(id);
      if (!existing) {
        return jsonError('Age group configuration not found', 404);
      }

      const body = await request.json().catch(() => ({}));
      const parsed = patchAgeGroupSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid age group update payload', 400);
      }

      const updated = await upsertAgeGroup({
        ...existing,
        ...parsed.data,
        uiProfile: {
          ...existing.uiProfile,
          ...(parsed.data.uiProfile ?? {}),
        },
      });

      await recordStaffAudit({
        action: 'age_group.update',
        modelName: 'age_groups',
        docId: id,
        actorName: staff.displayName || staff.email || 'Admin',
        actorEmail: staff.email || undefined,
        summary: `Updated age group ${id}`,
      });

      return NextResponse.json({ ageGroup: updated });
    }
  );
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.content.publish',
    async ({ staff }) => {
      const { id } = await context.params;
      const mode =
        request.nextUrl.searchParams.get('mode') === 'hard' ? 'hard' : 'soft';
      const rootGuard = enforceHardDeleteRootGuard(staff, mode);
      if (rootGuard) return rootGuard;
      try {
        const result = await deleteAgeGroup(id, mode);
        if (!result.ok) {
          return jsonError('Age group configuration not found', 404);
        }
        await recordStaffAudit({
          action:
            mode === 'hard' ? 'age_group.hard_delete' : 'age_group.archive',
          modelName: 'age_groups',
          docId: id,
          actorName: staff.displayName || staff.email || 'Admin',
          actorEmail: staff.email || undefined,
          summary:
            mode === 'hard'
              ? `Permanently deleted age group ${id}`
              : `Archived age group ${id}`,
        });
        return NextResponse.json({
          removed: true,
          mode,
          ageGroup: result.ageGroup ?? null,
        });
      } catch (err) {
        return jsonError(
          err instanceof Error ? err.message : 'Unable to delete age group',
          400
        );
      }
    }
  );
}

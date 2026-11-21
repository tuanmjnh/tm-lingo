import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  enforceHardDeleteRootGuard,
  jsonError,
  withStaffCapability,
} from '../../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../../server/auth/hubClient';
import {
  deleteCmsPackage,
  getCmsPackageById,
  upsertCmsPackage,
} from '../../../../../../../../server/data/cmsRepository';

const patchPackageSchema = z.object({
  titles: z.record(z.string(), z.string().min(1).max(120)).optional(),
  summaries: z.record(z.string(), z.string().min(1).max(260)).optional(),
  ageBand: z.array(z.string().min(2).max(32)).min(1).optional(),
  learningLevel: z
    .enum([
      'starter',
      'foundation',
      'elementary',
      'intermediate',
      'upper_intermediate',
      'advanced',
    ])
    .optional(),
  learningLocales: z.array(z.string().min(2).max(10)).min(1).optional(),
  explanationLocales: z.array(z.string().min(2).max(10)).min(1).optional(),
  concepts: z
    .array(
      z.object({
        conceptId: z.string().min(2).max(60),
        schemaVersion: z.number().int().default(1),
        assetRef: z.string().min(2).max(240),
        localizations: z.record(
          z.string(),
          z.object({
            term: z.string().min(1).max(80),
            example: z.string().min(1).max(200),
            explanation: z.string().min(1).max(200),
            pronunciationGuide: z.string().max(80).optional(),
            audioUrl: z.string().max(400).optional(),
          })
        ),
      })
    )
    .min(1)
    .max(12)
    .optional(),
});

type RouteContext = { params: Promise<{ packageId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.content.write',
    async ({ staff }) => {
      const { packageId } = await context.params;
      const existing = await getCmsPackageById(packageId);
      if (!existing) {
        return jsonError('Learning package not found', 404);
      }

      const body = await request.json().catch(() => ({}));
      const parsed = patchPackageSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid package update payload', 400);
      }

      const updated = await upsertCmsPackage({
        ...existing,
        ...parsed.data,
        concepts: parsed.data.concepts ?? existing.concepts,
      });

      await recordStaffAudit({
        action: 'cms.package.update',
        modelName: 'learning_packages',
        docId: updated.id,
        actorName: staff.displayName || staff.email || 'Staff',
        actorEmail: staff.email || undefined,
        summary: `Updated learning package ${updated.id}`,
      });

      return NextResponse.json({ package: updated });
    }
  );
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.content.publish',
    async ({ staff }) => {
      const { packageId } = await context.params;
      const mode =
        request.nextUrl.searchParams.get('mode') === 'hard' ? 'hard' : 'soft';
      const rootGuard = enforceHardDeleteRootGuard(staff, mode);
      if (rootGuard) return rootGuard;
      try {
        const result = await deleteCmsPackage(packageId, mode);
        if (!result.ok) {
          return jsonError('Learning package not found', 404);
        }
        await recordStaffAudit({
          action: mode === 'hard' ? 'cms.package.hard_delete' : 'cms.package.archive',
          modelName: 'learning_packages',
          docId: packageId,
          actorName: staff.displayName || staff.email || 'Staff',
          actorEmail: staff.email || undefined,
          summary:
            mode === 'hard'
              ? `Permanently deleted learning package ${packageId}`
              : `Archived learning package ${packageId}`,
        });
        return NextResponse.json({
          removed: true,
          mode,
          package: result.pkg ?? null,
        });
      } catch (err) {
        return jsonError(
          err instanceof Error ? err.message : 'Unable to delete package',
          400
        );
      }
    }
  );
}

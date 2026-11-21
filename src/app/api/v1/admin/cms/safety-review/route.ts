import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../server/auth/hubClient';
import {
  getCmsPackageById,
  getCmsStoryById,
} from '../../../../../../../server/data/cmsRepository';
import { runChildSafetyReview } from '../../../../../../../server/providers/aiManager';

const safetySchema = z.object({
  entityType: z.enum(['package', 'story']),
  entityId: z.string().min(2).max(120),
  responseLocale: z.string().min(2).max(12).optional(),
  connectionId: z.string().optional(),
  modelOverride: z.string().optional(),
});

export async function POST(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.content.read',
    async ({ staff }) => {
      const body = await request.json().catch(() => ({}));
      const parsed = safetySchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid safety review payload', 400);
      }

      const item =
        parsed.data.entityType === 'package'
          ? await getCmsPackageById(parsed.data.entityId)
          : await getCmsStoryById(parsed.data.entityId);

      if (!item) {
        return jsonError('Content item not found', 404);
      }

      try {
        const review = await runChildSafetyReview({
          entityType: parsed.data.entityType,
          item,
          responseLocale: parsed.data.responseLocale,
          connectionId: parsed.data.connectionId,
          modelOverride: parsed.data.modelOverride,
        });

        await recordStaffAudit({
          action: 'cms.safety_review',
          modelName:
            parsed.data.entityType === 'package'
              ? 'learning_packages'
              : 'stories',
          docId: parsed.data.entityId,
          actorName: staff.displayName || staff.email || 'Staff',
          actorEmail: staff.email || undefined,
          summary: `Ran AI child-safety review on ${parsed.data.entityId}: ${
            review.passed ? 'PASSED' : 'NEEDS REVISION'
          } (${review.score}/100 via ${review.modelUsed})`,
        });

        return NextResponse.json({ review });
      } catch (err) {
        return jsonError(
          err instanceof Error ? err.message : 'Child safety review failed',
          500
        );
      }
    }
  );
}

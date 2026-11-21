import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, withParentAuth } from '../../../../../../server/auth/guards';
import { lingoStore } from '../../../../../../server/data/seedStore';

const patchLearnerSchema = z.object({
  nickname: z.string().min(1).max(32).optional(),
  ageYears: z.number().int().min(3).max(18).optional(),
  ageBand: z.string().min(2).max(32).optional(),
  gradeLevel: z.number().int().min(0).max(12).nullable().optional(),
  avatarTone: z.enum(['sky', 'amber', 'emerald', 'rose']).optional(),
  applyAgeGroupDefaults: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ learnerId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  return withParentAuth(
    request,
    context,
    { allowGuest: true },
    async ({ parentAccountId }) => {
      const { learnerId } = await context.params;
      const body = await request.json().catch(() => ({}));
      const parsed = patchLearnerSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid learner profile update', 400);
      }
      const updated = await lingoStore.updateLearnerProfile(
        parentAccountId,
        learnerId,
        parsed.data
      );
      if (!updated) {
        return jsonError('Learner not found', 404);
      }
      return NextResponse.json({ learner: updated });
    }
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, withParentAuth } from '../../../../../../../server/auth/guards';
import { lingoStore } from '../../../../../../../server/data/seedStore';

const patchPreferencesSchema = z.object({
  interfaceLocale: z.string().min(2).max(10).optional(),
  learningLocale: z.string().min(2).max(10).optional(),
  explanationLocale: z.string().min(2).max(10).optional(),
  narrationLocale: z.string().min(2).max(10).optional(),
  reducedMotion: z.boolean().optional(),
  dailyMinutesLimit: z.number().int().min(5).max(60).optional(),
  storyDailyMinutesLimit: z.number().int().min(5).max(60).optional(),
  audioSpeed: z.number().min(0.65).max(1.25).optional(),
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
      const parsed = patchPreferencesSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid preferences update', 400);
      }
      const updated = await lingoStore.updateLearnerPreferences(
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

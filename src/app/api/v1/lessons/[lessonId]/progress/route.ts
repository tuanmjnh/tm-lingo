import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, withParentAuth } from '../../../../../../../server/auth/guards';
import { lingoStore } from '../../../../../../../server/data/seedStore';

const saveProgressSchema = z.object({
  learnerId: z.string().min(1),
  learningLocale: z.string().min(2),
  mode: z.enum(['guided', 'flashcards', 'listening', 'game', 'story', 'explore']),
  completedActivityIds: z.array(z.string()),
  totalActivities: z.number().int().min(1),
  lastActivityIndex: z.number().int().min(0),
  completed: z.boolean(),
});

type RouteContext = { params: Promise<{ lessonId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  return withParentAuth(
    request,
    context,
    { allowGuest: true },
    async ({ parentAccountId }) => {
      const { lessonId } = await context.params;
      const body = await request.json().catch(() => ({}));
      const parsed = saveProgressSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid progress payload', 400);
      }
      const saved = await lingoStore.saveProgress(parentAccountId, {
        ...parsed.data,
        lessonId,
      });
      return NextResponse.json({ progress: saved });
    }
  );
}

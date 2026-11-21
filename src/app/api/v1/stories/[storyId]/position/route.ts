import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, withParentAuth } from '../../../../../../../server/auth/guards';
import { lingoStore } from '../../../../../../../server/data/seedStore';

const storyPositionSchema = z.object({
  learnerId: z.string().min(1),
  narrationLocale: z.string().min(2),
  segmentIndex: z.number().int().min(0),
});

type RouteContext = { params: Promise<{ storyId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  return withParentAuth(
    request,
    context,
    { allowGuest: true },
    async ({ parentAccountId }) => {
      const { storyId } = await context.params;
      const body = await request.json().catch(() => ({}));
      const parsed = storyPositionSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid reading position payload', 400);
      }
      const position = await lingoStore.saveStoryPosition(parentAccountId, {
        storyId,
        ...parsed.data,
      });
      return NextResponse.json({ readingPosition: position });
    }
  );
}

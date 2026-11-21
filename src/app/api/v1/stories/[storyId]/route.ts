import { NextRequest, NextResponse } from 'next/server';
import { jsonError, withParentAuth } from '../../../../../../server/auth/guards';
import { getCmsStoryById } from '../../../../../../server/data/cmsRepository';
import { lingoStore } from '../../../../../../server/data/seedStore';

type RouteContext = { params: Promise<{ storyId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return withParentAuth(
    request,
    context,
    { allowGuest: true },
    async ({ parentAccountId }) => {
      const { storyId } = await context.params;
      const story = await getCmsStoryById(storyId);
      if (!story || story.status !== 'published') {
        return jsonError('Story not found', 404);
      }
      const learnerId = request.nextUrl.searchParams.get('learnerId') || undefined;
      const readingPosition = learnerId
        ? await lingoStore.getStoryPosition(parentAccountId, learnerId, story.id)
        : null;
      return NextResponse.json({ story, readingPosition });
    }
  );
}

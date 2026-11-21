import { NextRequest, NextResponse } from 'next/server';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../../../server/auth/hubClient';
import { restoreCmsStory } from '../../../../../../../../../server/data/cmsRepository';

type RouteContext = { params: Promise<{ storyId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.content.write',
    async ({ staff }) => {
      const { storyId } = await context.params;
      const restored = await restoreCmsStory(storyId);
      if (!restored) {
        return jsonError('Story not found', 404);
      }
      await recordStaffAudit({
        action: 'cms.story.restore',
        modelName: 'stories',
        docId: storyId,
        actorName: staff.displayName || staff.email || 'Staff',
        actorEmail: staff.email || undefined,
        summary: `Restored archived story ${storyId} to draft`,
      });
      return NextResponse.json({ story: restored });
    }
  );
}

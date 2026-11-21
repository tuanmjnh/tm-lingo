import { NextRequest, NextResponse } from 'next/server';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../../server/auth/hubClient';
import { restoreStorySource } from '../../../../../../../../server/data/storySourceRepository';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.content.publish',
    async ({ staff }) => {
      const { id } = await context.params;
      const restored = await restoreStorySource(id);
      if (!restored) {
        return jsonError('Không tìm thấy nguồn truyện để khôi phục.', 404);
      }

      await recordStaffAudit({
        action: 'story_source.restore',
        modelName: 'story_sources',
        docId: id,
        actorName: staff.displayName || staff.email || 'Admin',
        actorEmail: staff.email || undefined,
        summary: `Restored story source ${id}`,
      });

      return NextResponse.json({ source: restored });
    }
  );
}

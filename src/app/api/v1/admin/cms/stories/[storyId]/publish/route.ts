import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../../../server/auth/hubClient';
import { transitionStoryStatus } from '../../../../../../../../../server/data/cmsRepository';

const transitionSchema = z.object({
  status: z.enum(['draft', 'in_review', 'published']).default('published'),
});

type RouteContext = { params: Promise<{ storyId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const body = await request.json().catch(() => ({}));
  const parsed = transitionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid workflow status', 400);
  }

  const requiredCapability =
    parsed.data.status === 'published'
      ? 'tm-lingo.content.publish'
      : 'tm-lingo.content.review';

  return withStaffCapability(
    request,
    context,
    requiredCapability,
    async ({ staff }) => {
      const { storyId } = await context.params;
      const result = await transitionStoryStatus({
        storyId,
        status: parsed.data.status,
        actor: staff.displayName || staff.email || staff.id,
      });
      if (!result) {
        return jsonError('Story not found', 404);
      }

      await recordStaffAudit({
        action: `cms.story.${parsed.data.status}`,
        modelName: 'stories',
        docId: storyId,
        actorName: staff.displayName || staff.email || 'Staff',
        actorEmail: staff.email || undefined,
        summary: `Transitioned story ${storyId} to ${parsed.data.status}${
          result.snapshot ? ` (snapshot v${result.snapshot.version})` : ''
        }`,
      });

      return NextResponse.json({
        story: result.story,
        snapshot: result.snapshot ?? null,
      });
    }
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../../server/auth/hubClient';
import {
  rollbackPackageToSnapshot,
  rollbackStoryToSnapshot,
} from '../../../../../../../../server/data/cmsRepository';

const rollbackSchema = z.object({
  entityType: z.enum(['package', 'story']),
  entityId: z.string().min(2).max(120),
  snapshotId: z.string().min(2).max(160),
});

export async function POST(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.content.publish',
    async ({ staff }) => {
      const body = await request.json().catch(() => ({}));
      const parsed = rollbackSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid rollback payload', 400);
      }

      const actor = staff.displayName || staff.email || staff.id;

      if (parsed.data.entityType === 'package') {
        const result = await rollbackPackageToSnapshot({
          packageId: parsed.data.entityId,
          snapshotId: parsed.data.snapshotId,
          actor,
        });
        if (!result) {
          return jsonError('Package or snapshot not found', 404);
        }

        await recordStaffAudit({
          action: 'cms.package.rollback',
          modelName: 'learning_packages',
          docId: parsed.data.entityId,
          actorName: actor,
          actorEmail: staff.email || undefined,
          summary: `Rolled back package ${parsed.data.entityId} to v${result.restoredFromVersion} (published v${result.snapshot.version})`,
        });

        return NextResponse.json({
          package: result.pkg,
          snapshot: result.snapshot,
          restoredFromVersion: result.restoredFromVersion,
        });
      }

      const result = await rollbackStoryToSnapshot({
        storyId: parsed.data.entityId,
        snapshotId: parsed.data.snapshotId,
        actor,
      });
      if (!result) {
        return jsonError('Story or snapshot not found', 404);
      }

      await recordStaffAudit({
        action: 'cms.story.rollback',
        modelName: 'stories',
        docId: parsed.data.entityId,
        actorName: actor,
        actorEmail: staff.email || undefined,
        summary: `Rolled back story ${parsed.data.entityId} to v${result.restoredFromVersion} (published v${result.snapshot.version})`,
      });

      return NextResponse.json({
        story: result.story,
        snapshot: result.snapshot,
        restoredFromVersion: result.restoredFromVersion,
      });
    }
  );
}

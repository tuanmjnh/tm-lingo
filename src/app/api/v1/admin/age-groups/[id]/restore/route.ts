import { NextRequest, NextResponse } from 'next/server';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../../server/auth/hubClient';
import { restoreAgeGroup } from '../../../../../../../../server/data/ageGroupRepository';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.content.publish',
    async ({ staff }) => {
      const { id } = await context.params;
      const restored = await restoreAgeGroup(id);
      if (!restored) {
        return jsonError('Age group configuration not found', 404);
      }

      await recordStaffAudit({
        action: 'age_group.restore',
        modelName: 'age_groups',
        docId: id,
        actorName: staff.displayName || staff.email || 'Admin',
        actorEmail: staff.email || undefined,
        summary: `Restored age group ${id}`,
      });

      return NextResponse.json({ ageGroup: restored });
    }
  );
}

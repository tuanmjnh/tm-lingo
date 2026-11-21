import { NextRequest, NextResponse } from 'next/server';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../../../server/auth/hubClient';
import { restoreCmsPackage } from '../../../../../../../../../server/data/cmsRepository';

type RouteContext = { params: Promise<{ packageId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.content.write',
    async ({ staff }) => {
      const { packageId } = await context.params;
      const restored = await restoreCmsPackage(packageId);
      if (!restored) {
        return jsonError('Learning package not found', 404);
      }
      await recordStaffAudit({
        action: 'cms.package.restore',
        modelName: 'learning_packages',
        docId: packageId,
        actorName: staff.displayName || staff.email || 'Staff',
        actorEmail: staff.email || undefined,
        summary: `Restored archived learning package ${packageId} to draft`,
      });
      return NextResponse.json({ package: restored });
    }
  );
}

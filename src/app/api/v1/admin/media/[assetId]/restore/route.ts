import { NextRequest, NextResponse } from 'next/server';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../../server/auth/hubClient';
import { restoreLearningMedia } from '../../../../../../../../server/modules/storage';

type RouteContext = { params: Promise<{ assetId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.media.write',
    async ({ staff }) => {
      const { assetId } = await context.params;
      const restored = await restoreLearningMedia(assetId);
      if (!restored) {
        return jsonError('Media asset not found', 404);
      }
      await recordStaffAudit({
        action: 'media.restore',
        modelName: 'media_assets',
        docId: assetId,
        actorName: staff.displayName || staff.email || 'Staff',
        actorEmail: staff.email || undefined,
        summary: `Restored archived media asset ${assetId}`,
      });
      return NextResponse.json({ asset: restored });
    }
  );
}

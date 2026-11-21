import { NextRequest, NextResponse } from 'next/server';
import {
  enforceHardDeleteRootGuard,
  jsonError,
  withStaffCapability,
} from '../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../server/auth/hubClient';
import { deleteLearningMedia } from '../../../../../../../server/modules/storage';

type RouteContext = { params: Promise<{ assetId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.media.write',
    async ({ staff }) => {
      const { assetId } = await context.params;
      const mode =
        request.nextUrl.searchParams.get('mode') === 'hard' ? 'hard' : 'soft';
      const rootGuard = enforceHardDeleteRootGuard(staff, mode);
      if (rootGuard) return rootGuard;
      const result = await deleteLearningMedia(assetId, mode);
      if (!result.ok) {
        return jsonError('Media asset not found', 404);
      }
      await recordStaffAudit({
        action: mode === 'hard' ? 'media.hard_delete' : 'media.archive',
        modelName: 'media_assets',
        docId: assetId,
        actorName: staff.displayName || staff.email || 'Staff',
        actorEmail: staff.email || undefined,
        summary:
          mode === 'hard'
            ? `Permanently deleted media asset ${assetId} from storage`
            : `Archived media asset ${assetId}`,
      });
      return NextResponse.json({
        removed: true,
        mode,
        asset: result.asset ?? null,
      });
    }
  );
}

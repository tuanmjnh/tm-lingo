import { NextRequest, NextResponse } from 'next/server';
import {
  enforceHardDeleteRootGuard,
  jsonError,
  withStaffCapability,
} from '../../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../../server/auth/hubClient';
import { deleteStorageConnection } from '../../../../../../../../server/providers/storageManager';

type RouteContext = { params: Promise<{ connectionId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.providers.manage',
    async ({ staff }) => {
      const { connectionId } = await context.params;
      const mode =
        request.nextUrl.searchParams.get('mode') === 'hard' ? 'hard' : 'soft';
      const rootGuard = enforceHardDeleteRootGuard(staff, mode);
      if (rootGuard) return rootGuard;
      const result = await deleteStorageConnection(connectionId, mode);
      if (!result.ok) {
        return jsonError('Storage connection not found', 404);
      }
      await recordStaffAudit({
        action:
          mode === 'hard'
            ? 'provider.storage.hard_delete'
            : 'provider.storage.archive',
        modelName: 'storage_connections',
        docId: connectionId,
        actorName: staff.displayName || staff.email || 'Admin',
        actorEmail: staff.email || undefined,
        summary:
          mode === 'hard'
            ? `Permanently deleted storage connection ${connectionId}`
            : `Archived storage connection ${connectionId}`,
      });
      return NextResponse.json({
        removed: true,
        mode,
        connection: result.connection ?? null,
      });
    }
  );
}

import { NextRequest, NextResponse } from 'next/server';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../../../server/auth/hubClient';
import { setDefaultStorageConnection } from '../../../../../../../../../server/providers/storageManager';

type RouteContext = { params: Promise<{ connectionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.providers.manage',
    async ({ staff }) => {
      const { connectionId } = await context.params;
      const updated = await setDefaultStorageConnection(connectionId);
      if (!updated) {
        return jsonError('Storage connection not found', 404);
      }
      await recordStaffAudit({
        action: 'provider.storage.default',
        modelName: 'storage_connections',
        docId: connectionId,
        actorName: staff.displayName || staff.email || 'Admin',
        actorEmail: staff.email || undefined,
        summary: `Set "${updated.name}" as default storage provider`,
      });
      return NextResponse.json({ connection: updated });
    }
  );
}

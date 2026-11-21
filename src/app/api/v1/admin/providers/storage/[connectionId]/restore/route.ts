import { NextRequest, NextResponse } from 'next/server';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../../../server/auth/hubClient';
import { restoreStorageConnection } from '../../../../../../../../../server/providers/storageManager';

type RouteContext = { params: Promise<{ connectionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.providers.manage',
    async ({ staff }) => {
      const { connectionId } = await context.params;
      const restored = await restoreStorageConnection(connectionId);
      if (!restored) {
        return jsonError('Storage connection not found', 404);
      }
      await recordStaffAudit({
        action: 'provider.storage.restore',
        modelName: 'storage_connections',
        docId: connectionId,
        actorName: staff.displayName || staff.email || 'Admin',
        actorEmail: staff.email || undefined,
        summary: `Restored archived storage connection ${connectionId}`,
      });
      return NextResponse.json({ connection: restored });
    }
  );
}

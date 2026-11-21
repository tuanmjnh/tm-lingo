import { NextRequest, NextResponse } from 'next/server';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../../../server/auth/hubClient';
import { restoreAIConnection } from '../../../../../../../../../server/providers/aiManager';

type RouteContext = { params: Promise<{ connectionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.providers.manage',
    async ({ staff }) => {
      const { connectionId } = await context.params;
      const restored = await restoreAIConnection(connectionId);
      if (!restored) {
        return jsonError('AI provider connection not found', 404);
      }
      await recordStaffAudit({
        action: 'provider.ai.restore',
        modelName: 'ai_connections',
        docId: connectionId,
        actorName: staff.displayName || staff.email || 'Admin',
        actorEmail: staff.email || undefined,
        summary: `Restored archived AI provider connection ${connectionId}`,
      });
      return NextResponse.json({ connection: restored });
    }
  );
}

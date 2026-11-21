import { NextRequest, NextResponse } from 'next/server';
import {
  enforceHardDeleteRootGuard,
  withStaffCapability,
} from '../../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../../server/auth/hubClient';
import { deleteAIConnection } from '../../../../../../../../server/providers/aiManager';

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
      const result = await deleteAIConnection(connectionId, mode);
      if (!result.ok) {
        return NextResponse.json(
          { error: 'AI provider connection not found' },
          { status: 404 }
        );
      }
      await recordStaffAudit({
        action:
          mode === 'hard' ? 'provider.ai.hard_delete' : 'provider.ai.archive',
        modelName: 'ai_connections',
        docId: connectionId,
        actorName: staff.displayName || staff.email || 'Admin',
        actorEmail: staff.email || undefined,
        summary:
          mode === 'hard'
            ? `Permanently deleted AI provider connection ${connectionId}`
            : `Archived AI provider connection ${connectionId}`,
      });
      return NextResponse.json({ removed: true, mode });
    }
  );
}

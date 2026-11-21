import { NextRequest, NextResponse } from 'next/server';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../../../server/auth/hubClient';
import { notificationService } from '../../../../../../../../../server/modules/notifications';

type RouteContext = { params: Promise<{ campaignId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.notifications.manage',
    async ({ staff }) => {
      const { campaignId } = await context.params;
      const restored = await notificationService.restoreCampaign(campaignId);
      if (!restored) {
        return jsonError('Campaign not found', 404);
      }
      await recordStaffAudit({
        action: 'notification.restore',
        modelName: 'notification_campaigns',
        docId: campaignId,
        actorName: staff.displayName || staff.email || 'Staff',
        actorEmail: staff.email || undefined,
        summary: `Restored archived notification campaign ${campaignId}`,
      });
      return NextResponse.json({ campaign: restored });
    }
  );
}

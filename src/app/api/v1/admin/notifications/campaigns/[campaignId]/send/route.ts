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
      const result = await notificationService.sendCampaign(campaignId);
      if (!result) {
        return jsonError('Campaign not found', 404);
      }
      await recordStaffAudit({
        action: 'notification.send',
        modelName: 'notification_campaigns',
        docId: campaignId,
        actorName: staff.displayName || staff.email || 'Staff',
        actorEmail: staff.email || undefined,
        summary: `Sent campaign "${result.campaign.title}" (${result.log.sentCount} delivered)`,
      });
      return NextResponse.json(result);
    }
  );
}

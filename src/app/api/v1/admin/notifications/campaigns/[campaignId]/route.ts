import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  enforceHardDeleteRootGuard,
  jsonError,
  withStaffCapability,
} from '../../../../../../../../server/auth/guards';
import { notificationService } from '../../../../../../../../server/modules/notifications';

const patchCampaignSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  body: z.string().min(1).max(280).optional(),
  category: z.enum(['reminder', 'story', 'progress', 'announcement']).optional(),
  locale: z.string().min(2).max(10).optional(),
  targetUrl: z.string().max(120).optional(),
  status: z.enum(['draft', 'scheduled', 'sent']).optional(),
  scheduledFor: z.string().max(32).nullable().optional(),
});

type RouteContext = { params: Promise<{ campaignId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.notifications.manage',
    async () => {
      const { campaignId } = await context.params;
      const body = await request.json().catch(() => ({}));
      const parsed = patchCampaignSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid campaign update payload', 400);
      }
      const updated = await notificationService.updateCampaign(
        campaignId,
        parsed.data
      );
      if (!updated) {
        return jsonError('Campaign not found', 404);
      }
      return NextResponse.json({ campaign: updated });
    }
  );
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.notifications.manage',
    async ({ staff }) => {
      const { campaignId } = await context.params;
      const mode =
        request.nextUrl.searchParams.get('mode') === 'hard' ? 'hard' : 'soft';
      const rootGuard = enforceHardDeleteRootGuard(staff, mode);
      if (rootGuard) return rootGuard;
      const result = await notificationService.deleteCampaign(campaignId, mode);
      if (!result.ok) {
        return jsonError('Campaign not found', 404);
      }
      const { recordStaffAudit } = await import(
        '../../../../../../../../server/auth/hubClient'
      );
      await recordStaffAudit({
        action:
          mode === 'hard' ? 'notification.hard_delete' : 'notification.archive',
        modelName: 'notification_campaigns',
        docId: campaignId,
        actorName: staff.displayName || staff.email || 'Staff',
        actorEmail: staff.email || undefined,
        summary:
          mode === 'hard'
            ? `Permanently deleted notification campaign ${campaignId}`
            : `Archived notification campaign ${campaignId}`,
      });
      return NextResponse.json({
        removed: true,
        mode,
        campaign: result.campaign ?? null,
      });
    }
  );
}

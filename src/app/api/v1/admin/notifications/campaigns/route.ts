import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../server/auth/hubClient';
import { notificationService } from '../../../../../../../server/modules/notifications';

const createCampaignSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(280),
  category: z
    .enum(['reminder', 'story', 'progress', 'announcement'])
    .default('reminder'),
  locale: z.string().min(2).max(10).default('vi'),
  targetUrl: z.string().max(120).default('/'),
  status: z.enum(['draft', 'scheduled', 'sent']).default('draft'),
  scheduledFor: z.string().max(32).nullable().default(null),
});

export async function GET(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.notifications.manage',
    async () => {
      const includeArchived =
        request.nextUrl.searchParams.get('includeArchived') === '1';
      const [campaigns, logs] = await Promise.all([
        notificationService.listCampaigns({ includeArchived }),
        notificationService.listDeliveryLogs(),
      ]);
      return NextResponse.json({ campaigns, logs });
    }
  );
}

export async function POST(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.notifications.manage',
    async ({ staff }) => {
      const body = await request.json().catch(() => ({}));
      const parsed = createCampaignSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid notification campaign payload', 400);
      }
      const campaign = await notificationService.createCampaign(parsed.data);
      await recordStaffAudit({
        action: 'notification.create',
        modelName: 'notification_campaigns',
        docId: campaign.id,
        actorName: staff.displayName || staff.email || 'Staff',
        actorEmail: staff.email || undefined,
        summary: `Created campaign "${campaign.title}"`,
      });
      return NextResponse.json({ campaign }, { status: 201 });
    }
  );
}

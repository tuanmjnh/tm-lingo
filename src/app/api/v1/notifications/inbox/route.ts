import { NextRequest, NextResponse } from 'next/server';
import { ensureServerInit, jsonError } from '../../../../../../server/auth/guards';
import { getParentUserFromRequest } from '../../../../../../server/auth/firebaseAuth';
import { resolveStaffSessionFromRequest } from '../../../../../../server/auth/hubClient';
import { notificationService } from '../../../../../../server/modules/notifications';

export async function GET(request: NextRequest) {
  await ensureServerInit();
  const [parent, staff] = await Promise.all([
    getParentUserFromRequest(request),
    resolveStaffSessionFromRequest(request),
  ]);

  if (!parent && !staff) {
    return jsonError('Authentication required. Please sign in first.', 401);
  }

  const campaigns = await notificationService.listCampaigns();
  const inbox = campaigns
    .filter((c) => c.status === 'sent' || c.status === 'scheduled')
    .slice(0, 12);
  return NextResponse.json({ notifications: inbox });
}

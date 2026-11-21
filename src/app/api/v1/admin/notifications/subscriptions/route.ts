import { NextRequest, NextResponse } from 'next/server';
import { withStaffCapability } from '../../../../../../../server/auth/guards';
import { notificationService } from '../../../../../../../server/modules/notifications';

export async function GET(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.notifications.manage',
    async () => {
      const subscriptions = await notificationService.listSubscriptions();
      return NextResponse.json({ subscriptions });
    }
  );
}

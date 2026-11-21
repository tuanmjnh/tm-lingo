import { NextRequest, NextResponse } from 'next/server';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../../server/auth/guards';
import { notificationService } from '../../../../../../../../server/modules/notifications';

type RouteContext = { params: Promise<{ subscriptionId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.notifications.manage',
    async () => {
      const { subscriptionId } = await context.params;
      const removed = await notificationService.unsubscribe(subscriptionId);
      if (!removed) {
        return jsonError('Subscription not found', 404);
      }
      return NextResponse.json({ removed: true });
    }
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../../server/auth/guards';
import { updateStaffUserRole } from '../../../../../../../../server/auth/hubClient';

const updateRoleSchema = z.object({
  role: z.enum(['parent', 'teacher', 'admin']),
});

type RouteContext = { params: Promise<{ userId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'users.update',
    async ({ staff, accessToken }) => {
      const { userId } = await context.params;
      const body = await request.json().catch(() => ({}));
      const parsed = updateRoleSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid role value', 400);
      }
      if (userId === staff.id && parsed.data.role !== 'admin') {
        return jsonError(
          'Cannot remove admin role from your own active account.',
          400
        );
      }
      try {
        const updated = await updateStaffUserRole({
          accessToken,
          targetUserId: userId,
          role: parsed.data.role,
          actor: staff,
        });
        if (!updated) {
          return jsonError('Staff user not found', 404);
        }
        return NextResponse.json({ user: updated });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to update staff role';
        const status = message.toLowerCase().includes('forbidden') ? 403 : 400;
        return jsonError(message, status);
      }
    }
  );
}

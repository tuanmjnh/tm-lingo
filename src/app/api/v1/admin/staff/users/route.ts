import { NextRequest, NextResponse } from 'next/server';
import { withStaffCapability } from '../../../../../../../server/auth/guards';
import { listStaffUsers } from '../../../../../../../server/auth/hubClient';

export async function GET(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'users.read',
    async ({ accessToken }) => {
      const result = await listStaffUsers(accessToken);
      return NextResponse.json(result);
    }
  );
}

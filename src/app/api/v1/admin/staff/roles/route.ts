import { NextRequest, NextResponse } from 'next/server';
import { withStaffCapability } from '../../../../../../../server/auth/guards';
import { listStaffRoles } from '../../../../../../../server/auth/hubClient';

export async function GET(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'roles.read',
    async ({ accessToken }) => {
      const result = await listStaffRoles(accessToken);
      return NextResponse.json(result);
    }
  );
}

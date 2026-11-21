import { NextRequest, NextResponse } from 'next/server';
import { withStaffCapability } from '../../../../../../../server/auth/guards';
import { isTmHubConfigured } from '../../../../../../../server/config/env';

export async function GET(request: NextRequest) {
  return withStaffCapability(request, {}, undefined, async ({ staff }) => {
    return NextResponse.json({
      user: staff,
      iamMode: isTmHubConfigured() ? 'tm-hub' : 'local-dev',
    });
  });
}

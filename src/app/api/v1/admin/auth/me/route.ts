import { NextRequest, NextResponse } from 'next/server';
import { withStaffCapability } from '../../../../../../../server/auth/guards';
import { isTmHubConfigured } from '../../../../../../../server/config/env';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    undefined,
    async ({ staff, accessToken }) => {
      return NextResponse.json(
        {
          user: staff,
          iamMode: isTmHubConfigured() ? 'tm-hub' : 'local-dev',
          accessToken,
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }
  );
}

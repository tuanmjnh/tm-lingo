import { NextRequest, NextResponse } from 'next/server';
import { withStaffCapability } from '../../../../../../server/auth/guards';
import { listStaffAuditLogs } from '../../../../../../server/auth/hubClient';

export async function GET(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'logs.read',
    async ({ accessToken }) => {
      const limitParam = Number(request.nextUrl.searchParams.get('limit') || '40');
      const limit = Number.isFinite(limitParam)
        ? Math.min(Math.max(Math.trunc(limitParam), 1), 100)
        : 40;
      const result = await listStaffAuditLogs(accessToken, limit);
      return NextResponse.json(result);
    }
  );
}

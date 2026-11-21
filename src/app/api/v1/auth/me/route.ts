import { NextRequest, NextResponse } from 'next/server';
import { withParentAuth } from '../../../../../../server/auth/guards';

export async function GET(request: NextRequest) {
  return withParentAuth(request, {}, { allowGuest: true }, async ({ parent }) => {
    return NextResponse.json({ user: parent });
  });
}

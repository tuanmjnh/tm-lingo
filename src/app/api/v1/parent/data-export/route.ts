import { NextRequest, NextResponse } from 'next/server';
import { withParentAuth } from '../../../../../../server/auth/guards';
import { exportParentData } from '../../../../../../server/modules/privacy';

export async function POST(request: NextRequest) {
  return withParentAuth(
    request,
    {},
    { allowGuest: false },
    async ({ parentAccountId }) => {
      const bundle = await exportParentData(parentAccountId);
      return NextResponse.json({ exportData: bundle });
    }
  );
}

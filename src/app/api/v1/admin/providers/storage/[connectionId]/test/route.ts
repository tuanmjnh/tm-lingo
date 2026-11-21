import { NextRequest, NextResponse } from 'next/server';
import { withStaffCapability } from '../../../../../../../../../server/auth/guards';
import { testStorageConnection } from '../../../../../../../../../server/providers/storageManager';

type RouteContext = { params: Promise<{ connectionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.providers.manage',
    async () => {
      const { connectionId } = await context.params;
      const result = await testStorageConnection(connectionId);
      return NextResponse.json(result);
    }
  );
}

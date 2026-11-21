import { NextRequest, NextResponse } from 'next/server';
import { withStaffCapability } from '../../../../../../../../../server/auth/guards';
import { testAIConnection } from '../../../../../../../../../server/providers/aiManager';

type RouteContext = { params: Promise<{ connectionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.providers.manage',
    async () => {
      const { connectionId } = await context.params;
      const result = await testAIConnection(connectionId);
      return NextResponse.json(result);
    }
  );
}

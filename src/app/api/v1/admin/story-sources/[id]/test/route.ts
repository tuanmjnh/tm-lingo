import { NextRequest, NextResponse } from 'next/server';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../../server/auth/guards';
import { testStorySourceConnection } from '../../../../../../../../server/services/storySourceService';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.content.read',
    async () => {
      const { id } = await context.params;
      try {
        const result = await testStorySourceConnection(id);
        return NextResponse.json(result);
      } catch (err) {
        return jsonError(
          err instanceof Error
            ? err.message
            : 'Không thể kiểm tra nguồn truyện.',
          404
        );
      }
    }
  );
}

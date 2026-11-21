import { NextRequest, NextResponse } from 'next/server';
import { withStaffCapability } from '../../../../../../../server/auth/guards';
import { listPublicationSnapshots } from '../../../../../../../server/data/cmsRepository';

export async function GET(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.content.read',
    async () => {
      const rawType = request.nextUrl.searchParams.get('entityType');
      const entityType =
        rawType === 'package' || rawType === 'story' ? rawType : undefined;
      const entityId =
        request.nextUrl.searchParams.get('entityId')?.trim() || undefined;
      const limitParam = Number(request.nextUrl.searchParams.get('limit') || 20);
      const limit = Number.isFinite(limitParam) ? limitParam : 20;

      const snapshots = await listPublicationSnapshots({
        entityType,
        entityId,
        limit,
      });
      return NextResponse.json({ snapshots });
    }
  );
}

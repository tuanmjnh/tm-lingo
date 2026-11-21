import { NextRequest, NextResponse } from 'next/server';
import { jsonError, withParentAuth } from '../../../../../server/auth/guards';
import { lingoStore } from '../../../../../server/data/seedStore';

export async function GET(request: NextRequest) {
  return withParentAuth(
    request,
    {},
    { allowGuest: true },
    async ({ parentAccountId }) => {
      const learnerId = request.nextUrl.searchParams.get('learnerId');
      if (!learnerId) {
        return jsonError('learnerId is required', 400);
      }
      const progress = await lingoStore.getProgressForLearner(
        parentAccountId,
        learnerId
      );
      return NextResponse.json({ progress });
    }
  );
}

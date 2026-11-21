import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  jsonError,
  withParentAuth,
} from '../../../../../../server/auth/guards';
import { deleteParentData } from '../../../../../../server/modules/privacy';

const deletionSchema = z.object({
  mode: z.enum(['soft', 'hard']).default('soft'),
  confirmPhrase: z.string().optional(),
});

export async function POST(request: NextRequest) {
  return withParentAuth(
    request,
    {},
    { allowGuest: false },
    async ({ parentAccountId }) => {
      const body = await request.json().catch(() => ({}));
      const parsed = deletionSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid data deletion request', 400);
      }

      if (
        parsed.data.mode === 'hard' &&
        parsed.data.confirmPhrase?.trim().toUpperCase() !== 'DELETE'
      ) {
        return jsonError(
          'Permanent deletion requires confirmPhrase set to "DELETE".',
          400
        );
      }

      const result = await deleteParentData({
        parentAccountId,
        mode: parsed.data.mode,
      });

      return NextResponse.json({ result });
    }
  );
}

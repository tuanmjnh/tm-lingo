import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  jsonError,
  withParentAuth,
} from '../../../../../../server/auth/guards';
import {
  getParentPrivacySummary,
  recordParentConsent,
} from '../../../../../../server/modules/privacy';

const consentSchema = z.object({
  purpose: z.enum([
    'child_profile_storage',
    'learning_progress_sync',
    'web_push_reminders',
  ]),
  granted: z.boolean(),
});

export async function GET(request: NextRequest) {
  return withParentAuth(
    request,
    {},
    { allowGuest: false },
    async ({ parentAccountId }) => {
      const summary = await getParentPrivacySummary(parentAccountId);
      return NextResponse.json({ privacy: summary });
    }
  );
}

export async function POST(request: NextRequest) {
  return withParentAuth(
    request,
    {},
    { allowGuest: false },
    async ({ parentAccountId }) => {
      const body = await request.json().catch(() => ({}));
      const parsed = consentSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid consent update payload', 400);
      }

      const recorded = await recordParentConsent({
        parentAccountId,
        purpose: parsed.data.purpose,
        granted: parsed.data.granted,
      });
      const summary = await getParentPrivacySummary(parentAccountId);

      return NextResponse.json({ consent: recorded, privacy: summary });
    }
  );
}

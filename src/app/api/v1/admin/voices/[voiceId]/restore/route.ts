import { NextRequest, NextResponse } from 'next/server';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../../server/auth/hubClient';
import { restoreVoiceProfile } from '../../../../../../../../server/data/voiceRepository';

type RouteContext = { params: Promise<{ voiceId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.content.publish',
    async ({ staff }) => {
      const { voiceId } = await context.params;
      const restored = await restoreVoiceProfile(voiceId);
      if (!restored) {
        return jsonError('Voice profile not found', 404);
      }

      await recordStaffAudit({
        action: 'voice.restore',
        modelName: 'voice_profiles',
        docId: voiceId,
        actorName: staff.displayName || staff.email || 'Admin',
        actorEmail: staff.email || undefined,
        summary: `Restored voice profile ${voiceId}`,
      });

      return NextResponse.json({ voice: restored });
    }
  );
}

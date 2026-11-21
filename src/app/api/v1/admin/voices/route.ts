import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../server/auth/hubClient';
import {
  listVoices,
  upsertVoiceProfile,
} from '../../../../../../server/data/voiceRepository';

const voiceSchema = z.object({
  voiceId: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-_]*$/),
  providerId: z.string().min(2).max(64).default('web-speech-adapter'),
  displayName: z.string().min(2).max(80),
  supportedLocales: z.array(z.string().min(2).max(16)).min(1),
  voiceStyleTags: z
    .array(z.enum(['warm', 'playful', 'calm', 'teacher-like']))
    .min(1)
    .default(['warm']),
  ageAppropriate: z.boolean().default(true),
  pitch: z.coerce.number().min(0.5).max(1.6).default(1.0),
  defaultRate: z.coerce.number().min(0.5).max(1.4).default(0.9),
});

export async function GET(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.content.read',
    async () => {
      const includeArchived =
        request.nextUrl.searchParams.get('includeArchived') === '1';
      const locale =
        request.nextUrl.searchParams.get('locale')?.trim() || undefined;
      const voices = await listVoices({ locale, includeArchived });
      return NextResponse.json({ voices });
    }
  );
}

export async function POST(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.content.publish',
    async ({ staff }) => {
      const body = await request.json().catch(() => ({}));
      const parsed = voiceSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid voice profile payload', 400);
      }

      const saved = await upsertVoiceProfile({
        ...parsed.data,
        archivedAt: null,
      });

      await recordStaffAudit({
        action: 'voice.upsert',
        modelName: 'voice_profiles',
        docId: saved.voiceId,
        actorName: staff.displayName || staff.email || 'Admin',
        actorEmail: staff.email || undefined,
        summary: `Saved voice profile ${saved.voiceId} (${saved.displayName})`,
      });

      return NextResponse.json({ voice: saved }, { status: 201 });
    }
  );
}

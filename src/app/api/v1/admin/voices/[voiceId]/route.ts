import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  enforceHardDeleteRootGuard,
  jsonError,
  withStaffCapability,
} from '../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../server/auth/hubClient';
import {
  deleteVoiceProfile,
  getVoiceById,
  upsertVoiceProfile,
} from '../../../../../../../server/data/voiceRepository';

const patchVoiceSchema = z.object({
  providerId: z.string().min(2).max(64).optional(),
  displayName: z.string().min(2).max(80).optional(),
  supportedLocales: z.array(z.string().min(2).max(16)).min(1).optional(),
  voiceStyleTags: z
    .array(z.enum(['warm', 'playful', 'calm', 'teacher-like']))
    .min(1)
    .optional(),
  ageAppropriate: z.boolean().optional(),
  pitch: z.coerce.number().min(0.5).max(1.6).optional(),
  defaultRate: z.coerce.number().min(0.5).max(1.4).optional(),
});

type RouteContext = { params: Promise<{ voiceId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.content.publish',
    async ({ staff }) => {
      const { voiceId } = await context.params;
      const existing = await getVoiceById(voiceId);
      if (!existing) {
        return jsonError('Voice profile not found', 404);
      }

      const body = await request.json().catch(() => ({}));
      const parsed = patchVoiceSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid voice profile update payload', 400);
      }

      const updated = await upsertVoiceProfile({
        ...existing,
        ...parsed.data,
      });

      await recordStaffAudit({
        action: 'voice.update',
        modelName: 'voice_profiles',
        docId: voiceId,
        actorName: staff.displayName || staff.email || 'Admin',
        actorEmail: staff.email || undefined,
        summary: `Updated voice profile ${voiceId}`,
      });

      return NextResponse.json({ voice: updated });
    }
  );
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.content.publish',
    async ({ staff }) => {
      const { voiceId } = await context.params;
      const mode =
        request.nextUrl.searchParams.get('mode') === 'hard' ? 'hard' : 'soft';
      const rootGuard = enforceHardDeleteRootGuard(staff, mode);
      if (rootGuard) return rootGuard;

      try {
        const result = await deleteVoiceProfile(voiceId, mode);
        if (!result.ok) {
          return jsonError('Voice profile not found', 404);
        }

        await recordStaffAudit({
          action: mode === 'hard' ? 'voice.hard_delete' : 'voice.archive',
          modelName: 'voice_profiles',
          docId: voiceId,
          actorName: staff.displayName || staff.email || 'Admin',
          actorEmail: staff.email || undefined,
          summary:
            mode === 'hard'
              ? `Permanently deleted voice profile ${voiceId}`
              : `Archived voice profile ${voiceId}`,
        });

        return NextResponse.json({
          removed: true,
          mode,
          voice: result.voice ?? null,
        });
      } catch (err) {
        return jsonError(
          err instanceof Error ? err.message : 'Unable to delete voice profile',
          400
        );
      }
    }
  );
}

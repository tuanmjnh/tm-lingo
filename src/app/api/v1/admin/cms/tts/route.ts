import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../server/auth/hubClient';
import { uploadLearningMedia } from '../../../../../../../server/modules/storage';
import { generateSpeechAudio } from '../../../../../../../server/providers/aiManager';

const ttsSchema = z.object({
  text: z.string().min(1).max(360),
  locale: z.string().min(2).max(12).default('en'),
  title: z.string().max(80).optional(),
  voiceName: z
    .enum(['Kore', 'Puck', 'Zephyr', 'Charon', 'Fenrir'])
    .default('Kore'),
});

export async function POST(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.content.write',
    async ({ staff }) => {
      const body = await request.json().catch(() => ({}));
      const parsed = ttsSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Please provide valid text and locale for TTS.', 400);
      }

      try {
        const speech = await generateSpeechAudio({
          text: parsed.data.text,
          locale: parsed.data.locale,
          voiceName: parsed.data.voiceName,
        });

        const safeBase = parsed.data.text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 32);

        const asset = await uploadLearningMedia({
          parentAccountId: staff.id,
          title:
            parsed.data.title?.trim() ||
            `TTS (${parsed.data.locale.toUpperCase()}): ${parsed.data.text.slice(0, 40)}`,
          locale: parsed.data.locale,
          fileBuffer: speech.wavBuffer,
          originalName: `${safeBase || 'narration'}.wav`,
          mimeType: speech.mimeType,
        });

        await recordStaffAudit({
          action: 'cms.tts.generate',
          modelName: 'media_assets',
          docId: asset.id,
          actorName: staff.displayName || staff.email || 'Staff',
          actorEmail: staff.email || undefined,
          summary: `Generated AI TTS audio (${speech.modelUsed}, ${parsed.data.voiceName}) for "${parsed.data.text.slice(0, 48)}"`,
        });

        return NextResponse.json(
          {
            asset,
            providerUsed: speech.providerUsed,
            modelUsed: speech.modelUsed,
          },
          { status: 201 }
        );
      } catch (err) {
        return jsonError(
          err instanceof Error ? err.message : 'TTS audio generation failed',
          500
        );
      }
    }
  );
}

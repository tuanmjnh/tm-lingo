import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../server/auth/hubClient';
import {
  listLanguages,
  upsertLanguageConfig,
} from '../../../../../../server/data/languageRepository';

const languageSchema = z.object({
  locale: z
    .string()
    .min(2)
    .max(12)
    .regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/),
  languageCode: z.string().min(2).max(8).optional(),
  displayName: z.string().min(2).max(60),
  nativeName: z.string().min(1).max(60),
  direction: z.enum(['ltr', 'rtl']).default('ltr'),
  enabled: z.boolean().default(true),
  learningEnabled: z.boolean().default(false),
  explanationEnabled: z.boolean().default(false),
  uiEnabled: z.boolean().default(false),
  ttsEnabled: z.boolean().default(false),
  speechRecognitionEnabled: z.boolean().default(false),
  contentStatus: z.enum(['ready', 'partial', 'planned']).default('planned'),
  fallbackLocale: z.string().max(12).nullable().default(null),
});

export async function GET(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.content.read',
    async () => {
      const includeArchived =
        request.nextUrl.searchParams.get('includeArchived') === '1';
      const languages = await listLanguages({ includeArchived });
      return NextResponse.json({ languages });
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
      const parsed = languageSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid language configuration payload', 400);
      }

      const saved = await upsertLanguageConfig({
        ...parsed.data,
        languageCode:
          parsed.data.languageCode || parsed.data.locale.split('-')[0],
        archivedAt: null,
      });

      await recordStaffAudit({
        action: 'language.upsert',
        modelName: 'language_configs',
        docId: saved.locale,
        actorName: staff.displayName || staff.email || 'Admin',
        actorEmail: staff.email || undefined,
        summary: `Saved language config ${saved.locale} (${saved.displayName})`,
      });

      return NextResponse.json({ language: saved }, { status: 201 });
    }
  );
}

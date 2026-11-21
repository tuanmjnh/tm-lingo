import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  enforceHardDeleteRootGuard,
  jsonError,
  withStaffCapability,
} from '../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../server/auth/hubClient';
import {
  deleteLanguageConfig,
  getLanguageByCode,
  upsertLanguageConfig,
} from '../../../../../../../server/data/languageRepository';

const patchLanguageSchema = z.object({
  displayName: z.string().min(2).max(60).optional(),
  nativeName: z.string().min(1).max(60).optional(),
  direction: z.enum(['ltr', 'rtl']).optional(),
  enabled: z.boolean().optional(),
  learningEnabled: z.boolean().optional(),
  explanationEnabled: z.boolean().optional(),
  uiEnabled: z.boolean().optional(),
  ttsEnabled: z.boolean().optional(),
  speechRecognitionEnabled: z.boolean().optional(),
  contentStatus: z.enum(['ready', 'partial', 'planned']).optional(),
  fallbackLocale: z.string().max(12).nullable().optional(),
});

type RouteContext = { params: Promise<{ locale: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.content.publish',
    async ({ staff }) => {
      const { locale } = await context.params;
      const existing = await getLanguageByCode(locale);
      if (!existing) {
        return jsonError('Language configuration not found', 404);
      }

      const body = await request.json().catch(() => ({}));
      const parsed = patchLanguageSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid language update payload', 400);
      }

      const updated = await upsertLanguageConfig({
        ...existing,
        ...parsed.data,
      });

      await recordStaffAudit({
        action: 'language.update',
        modelName: 'language_configs',
        docId: locale,
        actorName: staff.displayName || staff.email || 'Admin',
        actorEmail: staff.email || undefined,
        summary: `Updated language config ${locale}`,
      });

      return NextResponse.json({ language: updated });
    }
  );
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.content.publish',
    async ({ staff }) => {
      const { locale } = await context.params;
      const mode =
        request.nextUrl.searchParams.get('mode') === 'hard' ? 'hard' : 'soft';
      const rootGuard = enforceHardDeleteRootGuard(staff, mode);
      if (rootGuard) return rootGuard;
      try {
        const result = await deleteLanguageConfig(locale, mode);
        if (!result.ok) {
          return jsonError('Language configuration not found', 404);
        }
        await recordStaffAudit({
          action:
            mode === 'hard' ? 'language.hard_delete' : 'language.archive',
          modelName: 'language_configs',
          docId: locale,
          actorName: staff.displayName || staff.email || 'Admin',
          actorEmail: staff.email || undefined,
          summary:
            mode === 'hard'
              ? `Permanently deleted language ${locale}`
              : `Archived language ${locale}`,
        });
        return NextResponse.json({
          removed: true,
          mode,
          language: result.language ?? null,
        });
      } catch (err) {
        return jsonError(
          err instanceof Error ? err.message : 'Unable to delete language',
          400
        );
      }
    }
  );
}

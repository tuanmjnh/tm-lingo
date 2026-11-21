import { NextRequest, NextResponse } from 'next/server';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../../server/auth/hubClient';
import { restoreLanguageConfig } from '../../../../../../../../server/data/languageRepository';

type RouteContext = { params: Promise<{ locale: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.content.publish',
    async ({ staff }) => {
      const { locale } = await context.params;
      const restored = await restoreLanguageConfig(locale);
      if (!restored) {
        return jsonError('Language configuration not found', 404);
      }
      await recordStaffAudit({
        action: 'language.restore',
        modelName: 'language_configs',
        docId: locale,
        actorName: staff.displayName || staff.email || 'Admin',
        actorEmail: staff.email || undefined,
        summary: `Restored archived language ${locale}`,
      });
      return NextResponse.json({ language: restored });
    }
  );
}

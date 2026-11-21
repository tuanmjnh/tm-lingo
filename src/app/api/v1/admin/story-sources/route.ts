import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../server/auth/hubClient';
import {
  listStorySources,
  STORY_CATEGORIES,
  upsertStorySource,
} from '../../../../../../server/data/storySourceRepository';
import { validateExternalUrlSyntax } from '../../../../../../server/security/urlGuard';

const categoryEnum = z.enum([
  'fables',
  'animals',
  'bedtime',
  'adventure',
  'science',
  'life-skills',
  'classics',
]);

const storySourceCreateSchema = z.object({
  id: z
    .string()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9-]+$/),
  name: z.object({
    vi: z.string().min(2).max(120),
    en: z.string().min(2).max(120),
  }),
  description: z.object({
    vi: z.string().min(2).max(320),
    en: z.string().min(2).max(320),
  }),
  adapterType: z.enum(['curated_library', 'gutendex', 'rss', 'json_catalog']),
  baseUrl: z.string().min(4).max(500),
  categories: z.array(categoryEnum).min(1).max(7),
  ageBands: z.array(z.string().min(2).max(32)).min(1).max(12),
  defaultLocale: z.string().min(2).max(12).default('en'),
  supportedLocales: z.array(z.string().min(2).max(12)).min(1).default(['en']),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().min(1).max(99).default(10),
});

export async function GET(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.content.read',
    async () => {
      const includeArchived =
        request.nextUrl.searchParams.get('includeArchived') === '1';
      const sources = await listStorySources({ includeArchived });
      return NextResponse.json({
        sources,
        categories: STORY_CATEGORIES,
      });
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
      const parsed = storySourceCreateSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Thông tin nguồn truyện không hợp lệ.', 400);
      }

      if (parsed.data.adapterType !== 'curated_library') {
        try {
          validateExternalUrlSyntax(parsed.data.baseUrl);
        } catch (err) {
          return jsonError(
            err instanceof Error ? err.message : 'Địa chỉ nguồn không hợp lệ.',
            400
          );
        }
      }

      const saved = await upsertStorySource({
        ...parsed.data,
        isSystem: false,
        archivedAt: null,
      });

      await recordStaffAudit({
        action: 'story_source.create',
        modelName: 'story_sources',
        docId: saved.id,
        actorName: staff.displayName || staff.email || 'Admin',
        actorEmail: staff.email || undefined,
        summary: `Added story source ${saved.id} (${saved.name.vi})`,
      });

      return NextResponse.json({ source: saved }, { status: 201 });
    }
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  enforceHardDeleteRootGuard,
  jsonError,
  withStaffCapability,
} from '../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../server/auth/hubClient';
import {
  deleteStorySource,
  getStorySourceById,
  upsertStorySource,
} from '../../../../../../../server/data/storySourceRepository';
import { validateExternalUrlSyntax } from '../../../../../../../server/security/urlGuard';

const categoryEnum = z.enum([
  'fables',
  'animals',
  'bedtime',
  'adventure',
  'science',
  'life-skills',
  'classics',
]);

const patchStorySourceSchema = z.object({
  name: z
    .object({
      vi: z.string().min(2).max(120),
      en: z.string().min(2).max(120),
    })
    .optional(),
  description: z
    .object({
      vi: z.string().min(2).max(320),
      en: z.string().min(2).max(320),
    })
    .optional(),
  adapterType: z
    .enum([
      'curated_library',
      'librivox',
      'wikisource',
      'archive_org',
      'gutendex',
      'rss',
      'json_catalog',
    ])
    .optional(),
  baseUrl: z.string().min(4).max(500).optional(),
  categories: z.array(categoryEnum).min(1).max(7).optional(),
  ageBands: z.array(z.string().min(2).max(32)).min(1).max(12).optional(),
  defaultLocale: z.string().min(2).max(12).optional(),
  supportedLocales: z.array(z.string().min(2).max(12)).min(1).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(1).max(99).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.content.publish',
    async ({ staff }) => {
      const { id } = await context.params;
      const existing = await getStorySourceById(id);
      if (!existing) {
        return jsonError('Không tìm thấy nguồn truyện.', 404);
      }

      const body = await request.json().catch(() => ({}));
      const parsed = patchStorySourceSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Dữ liệu cập nhật nguồn truyện không hợp lệ.', 400);
      }

      const nextAdapter = parsed.data.adapterType ?? existing.adapterType;
      const nextUrl = parsed.data.baseUrl ?? existing.baseUrl;
      if (nextAdapter !== 'curated_library') {
        try {
          validateExternalUrlSyntax(nextUrl);
        } catch (err) {
          return jsonError(
            err instanceof Error ? err.message : 'Địa chỉ nguồn không hợp lệ.',
            400
          );
        }
      }

      const updated = await upsertStorySource({
        ...existing,
        ...parsed.data,
      });

      await recordStaffAudit({
        action: 'story_source.update',
        modelName: 'story_sources',
        docId: id,
        actorName: staff.displayName || staff.email || 'Admin',
        actorEmail: staff.email || undefined,
        summary: `Updated story source ${id}`,
      });

      return NextResponse.json({ source: updated });
    }
  );
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.content.publish',
    async ({ staff }) => {
      const { id } = await context.params;
      const mode =
        request.nextUrl.searchParams.get('mode') === 'hard' ? 'hard' : 'soft';
      const rootGuard = enforceHardDeleteRootGuard(staff, mode);
      if (rootGuard) return rootGuard;

      const result = await deleteStorySource(id, mode);
      if (!result.ok) {
        return jsonError('Không tìm thấy nguồn truyện.', 404);
      }

      await recordStaffAudit({
        action:
          mode === 'hard' ? 'story_source.hard_delete' : 'story_source.archive',
        modelName: 'story_sources',
        docId: id,
        actorName: staff.displayName || staff.email || 'Admin',
        actorEmail: staff.email || undefined,
        summary:
          mode === 'hard'
            ? `Permanently deleted story source ${id}`
            : `Archived story source ${id}`,
      });

      return NextResponse.json({
        removed: true,
        mode,
        source: result.source ?? null,
      });
    }
  );
}

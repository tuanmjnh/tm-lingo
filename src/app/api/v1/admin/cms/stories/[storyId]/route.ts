import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  enforceHardDeleteRootGuard,
  jsonError,
  withStaffCapability,
} from '../../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../../server/auth/hubClient';
import {
  deleteCmsStory,
  getCmsStoryById,
  upsertCmsStory,
} from '../../../../../../../../server/data/cmsRepository';

const patchStorySchema = z.object({
  titles: z.record(z.string(), z.string().min(1).max(120)).optional(),
  summaries: z.record(z.string(), z.string().min(1).max(260)).optional(),
  ageBands: z.array(z.string().min(2).max(32)).min(1).optional(),
  coverAssetRef: z.string().min(2).max(240).optional(),
  segments: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        order: z.number().int().min(1),
        assetRef: z.string().min(2).max(240),
        conceptRef: z.string().optional(),
        textByLocale: z.record(z.string(), z.string().min(1).max(320)),
        explanationByLocale: z.record(z.string(), z.string().min(1).max(320)),
        audioUrlByLocale: z.record(z.string(), z.string().max(400)).optional(),
      })
    )
    .min(1)
    .max(12)
    .optional(),
});

type RouteContext = { params: Promise<{ storyId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.content.write',
    async ({ staff }) => {
      const { storyId } = await context.params;
      const existing = await getCmsStoryById(storyId);
      if (!existing) {
        return jsonError('Story not found', 404);
      }

      const body = await request.json().catch(() => ({}));
      const parsed = patchStorySchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid story update payload', 400);
      }

      const updated = await upsertCmsStory({
        ...existing,
        ...parsed.data,
        segments: parsed.data.segments ?? existing.segments,
      });

      await recordStaffAudit({
        action: 'cms.story.update',
        modelName: 'stories',
        docId: updated.id,
        actorName: staff.displayName || staff.email || 'Staff',
        actorEmail: staff.email || undefined,
        summary: `Updated story ${updated.id}`,
      });

      return NextResponse.json({ story: updated });
    }
  );
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.content.publish',
    async ({ staff }) => {
      const { storyId } = await context.params;
      const mode =
        request.nextUrl.searchParams.get('mode') === 'hard' ? 'hard' : 'soft';
      const rootGuard = enforceHardDeleteRootGuard(staff, mode);
      if (rootGuard) return rootGuard;
      try {
        const result = await deleteCmsStory(storyId, mode);
        if (!result.ok) {
          return jsonError('Story not found', 404);
        }
        await recordStaffAudit({
          action: mode === 'hard' ? 'cms.story.hard_delete' : 'cms.story.archive',
          modelName: 'stories',
          docId: storyId,
          actorName: staff.displayName || staff.email || 'Staff',
          actorEmail: staff.email || undefined,
          summary:
            mode === 'hard'
              ? `Permanently deleted story ${storyId}`
              : `Archived story ${storyId}`,
        });
        return NextResponse.json({
          removed: true,
          mode,
          story: result.story ?? null,
        });
      } catch (err) {
        return jsonError(
          err instanceof Error ? err.message : 'Unable to delete story',
          400
        );
      }
    }
  );
}

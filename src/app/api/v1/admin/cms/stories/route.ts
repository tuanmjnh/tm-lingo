import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { StoryBook } from '../../../../../../../packages/contracts/types';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../server/auth/hubClient';
import {
  listCmsStories,
  upsertCmsStory,
} from '../../../../../../../server/data/cmsRepository';

const createStorySchema = z.object({
  id: z.string().max(80).optional(),
  learningPackageId: z.string().min(2).max(80).default('lp-fruits-a1'),
  coverAssetRef: z.string().min(2).max(240).default('img-story-fruit-market'),
  availableLocales: z.array(z.string().min(2).max(10)).min(1),
  availableExplanationLocales: z.array(z.string().min(2).max(10)).min(1),
  titles: z.record(z.string(), z.string().min(1).max(120)),
  summaries: z.record(z.string(), z.string().min(1).max(260)),
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
    .max(12),
});

export async function GET(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.content.read',
    async () => {
      const includeArchived =
        request.nextUrl.searchParams.get('includeArchived') === '1';
      const stories = await listCmsStories({ includeArchived });
      return NextResponse.json({ stories });
    }
  );
}

export async function POST(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.content.write',
    async ({ staff }) => {
      const body = await request.json().catch(() => ({}));
      const parsed = createStorySchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid story payload', 400);
      }

      const story: StoryBook = {
        id:
          parsed.data.id?.trim() ||
          `story-${Date.now().toString(36)}`,
        schemaVersion: 1,
        learningPackageId: parsed.data.learningPackageId,
        ageBands: ['3-5'],
        coverAssetRef: parsed.data.coverAssetRef,
        availableLocales: parsed.data.availableLocales,
        availableExplanationLocales: parsed.data.availableExplanationLocales,
        titles: parsed.data.titles,
        summaries: parsed.data.summaries,
        segments: parsed.data.segments,
        status: 'draft',
        updatedAt: new Date().toISOString(),
      };

      const saved = await upsertCmsStory(story);
      await recordStaffAudit({
        action: 'cms.story.create',
        modelName: 'stories',
        docId: saved.id,
        actorName: staff.displayName || staff.email || 'Staff',
        actorEmail: staff.email || undefined,
        summary: `Created draft story "${Object.values(saved.titles)[0] || saved.id}"`,
      });
      return NextResponse.json({ story: saved }, { status: 201 });
    }
  );
}

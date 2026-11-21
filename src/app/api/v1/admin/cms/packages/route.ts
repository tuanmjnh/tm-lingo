import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { CmsLearningPackage } from '../../../../../../../packages/contracts/types';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../server/auth/hubClient';
import {
  listCmsPackages,
  upsertCmsPackage,
} from '../../../../../../../server/data/cmsRepository';

const conceptSchema = z.object({
  conceptId: z.string().min(2).max(60),
  schemaVersion: z.number().int().default(1),
  assetRef: z.string().min(2).max(240).default('img-apple'),
  localizations: z.record(
    z.string(),
    z.object({
      term: z.string().min(1).max(80),
      example: z.string().min(1).max(200),
      explanation: z.string().min(1).max(200),
      pronunciationGuide: z.string().max(80).optional(),
      audioUrl: z.string().max(400).optional(),
    })
  ),
});

const createPackageSchema = z.object({
  id: z.string().max(80).optional(),
  topicId: z.string().min(2).max(80),
  ageBand: z.array(z.string().min(2).max(32)).min(1).optional(),
  learningLevel: z
    .enum([
      'starter',
      'foundation',
      'elementary',
      'intermediate',
      'upper_intermediate',
      'advanced',
    ])
    .optional(),
  learningLocales: z.array(z.string().min(2).max(10)).min(1),
  explanationLocales: z.array(z.string().min(2).max(10)).min(1),
  titles: z.record(z.string(), z.string().min(1).max(120)),
  summaries: z.record(z.string(), z.string().min(1).max(260)),
  concepts: z.array(conceptSchema).min(1).max(12),
});

export async function GET(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.content.read',
    async () => {
      const includeArchived =
        request.nextUrl.searchParams.get('includeArchived') === '1';
      const packages = await listCmsPackages({ includeArchived });
      return NextResponse.json({ packages });
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
      const parsed = createPackageSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid learning package payload', 400);
      }

      const now = new Date().toISOString();
      const slug = parsed.data.topicId
        .replace(/^topic\./, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 28);
      const id =
        parsed.data.id?.trim() || `lp-${slug || 'custom'}-${Date.now().toString(36).slice(-4)}`;

      const pkg: CmsLearningPackage = {
        id,
        schemaVersion: 1,
        topicId: parsed.data.topicId,
        ageBand: parsed.data.ageBand ?? ['3-5'],
        learningLevel: parsed.data.learningLevel ?? 'starter',
        learningLocales: parsed.data.learningLocales,
        explanationLocales: parsed.data.explanationLocales,
        availableExperienceModes: [
          'guided',
          'flashcards',
          'listening',
          'game',
          'story',
        ],
        titles: parsed.data.titles,
        summaries: parsed.data.summaries,
        conceptCount: parsed.data.concepts.length,
        concepts: parsed.data.concepts,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
        publishedSnapshotId: null,
      };

      const saved = await upsertCmsPackage(pkg);
      await recordStaffAudit({
        action: 'cms.package.create',
        modelName: 'learning_packages',
        docId: saved.id,
        actorName: staff.displayName || staff.email || 'Staff',
        actorEmail: staff.email || undefined,
        summary: `Created draft learning package "${Object.values(saved.titles)[0] || saved.id}"`,
      });
      return NextResponse.json({ package: saved }, { status: 201 });
    }
  );
}

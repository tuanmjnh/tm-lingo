import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../server/auth/hubClient';
import {
  getCmsPackageById,
  getCmsStoryById,
  recordGenerationJob,
  upsertCmsPackage,
  upsertCmsStory,
} from '../../../../../../../server/data/cmsRepository';
import {
  adaptPackageToLocale,
  adaptStoryToLocale,
} from '../../../../../../../server/providers/aiManager';

const adaptSchema = z.object({
  entityType: z.enum(['package', 'story']),
  entityId: z.string().min(2).max(120),
  sourceLocale: z.string().min(2).max(12).default('en'),
  targetLocale: z.string().min(2).max(12),
  connectionId: z.string().optional(),
  modelOverride: z.string().optional(),
});

export async function POST(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.content.write',
    async ({ staff }) => {
      const body = await request.json().catch(() => ({}));
      const parsed = adaptSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid locale adaptation payload', 400);
      }

      const {
        entityType,
        entityId,
        sourceLocale,
        targetLocale,
        connectionId,
        modelOverride,
      } = parsed.data;

      if (sourceLocale.toLowerCase() === targetLocale.toLowerCase()) {
        return jsonError(
          'Target locale must be different from source locale.',
          400
        );
      }

      const actor = staff.displayName || staff.email || staff.id;
      const jobId = `job-adapt-${Date.now().toString(36)}`;

      try {
        if (entityType === 'package') {
          const pkg = await getCmsPackageById(entityId);
          if (!pkg) return jsonError('Learning package not found', 404);

          const res = await adaptPackageToLocale({
            pkg,
            sourceLocale,
            targetLocale,
            connectionId,
            modelOverride,
          });
          const saved = await upsertCmsPackage(res.updated);

          await recordGenerationJob({
            id: jobId,
            kind: 'package',
            operationType: 'adapt',
            topic: `Adapt ${pkg.id} (${sourceLocale} -> ${targetLocale})`,
            learningLocale: targetLocale,
            explanationLocale: sourceLocale,
            providerUsed: res.providerUsed,
            modelUsed: res.modelUsed,
            status: 'completed',
            createdEntityId: saved.id,
            createdBy: actor,
            createdAt: new Date().toISOString(),
          });

          await recordStaffAudit({
            action: 'cms.package.adapt_locale',
            modelName: 'learning_packages',
            docId: saved.id,
            actorName: actor,
            actorEmail: staff.email || undefined,
            summary: `AI-adapted package ${saved.id} from ${sourceLocale} to ${targetLocale} (${res.modelUsed})`,
          });

          return NextResponse.json({
            entityType: 'package',
            package: saved,
            providerUsed: res.providerUsed,
            modelUsed: res.modelUsed,
          });
        }

        const story = await getCmsStoryById(entityId);
        if (!story) return jsonError('Story not found', 404);

        const res = await adaptStoryToLocale({
          story,
          sourceLocale,
          targetLocale,
          connectionId,
          modelOverride,
        });
        const saved = await upsertCmsStory(res.updated);

        await recordGenerationJob({
          id: jobId,
          kind: 'story',
          operationType: 'adapt',
          topic: `Adapt ${story.id} (${sourceLocale} -> ${targetLocale})`,
          learningLocale: targetLocale,
          explanationLocale: sourceLocale,
          providerUsed: res.providerUsed,
          modelUsed: res.modelUsed,
          status: 'completed',
          createdEntityId: saved.id,
          createdBy: actor,
          createdAt: new Date().toISOString(),
        });

        await recordStaffAudit({
          action: 'cms.story.adapt_locale',
          modelName: 'stories',
          docId: saved.id,
          actorName: actor,
          actorEmail: staff.email || undefined,
          summary: `AI-adapted story ${saved.id} from ${sourceLocale} to ${targetLocale} (${res.modelUsed})`,
        });

        return NextResponse.json({
          entityType: 'story',
          story: saved,
          providerUsed: res.providerUsed,
          modelUsed: res.modelUsed,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Locale adaptation failed';
        await recordGenerationJob({
          id: jobId,
          kind: entityType,
          operationType: 'adapt',
          topic: `Adapt ${entityId} (${sourceLocale} -> ${targetLocale})`,
          learningLocale: targetLocale,
          explanationLocale: sourceLocale,
          providerUsed: connectionId || 'default',
          modelUsed: modelOverride || 'default',
          status: 'failed',
          errorMessage: message,
          createdBy: actor,
          createdAt: new Date().toISOString(),
        });
        return jsonError(message, 500);
      }
    }
  );
}

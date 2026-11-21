import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../server/auth/hubClient';
import {
  listGenerationJobs,
  recordGenerationJob,
  upsertCmsPackage,
  upsertCmsStory,
} from '../../../../../../../server/data/cmsRepository';
import {
  generateLearningPackageDraft,
  generateStoryDraft,
} from '../../../../../../../server/providers/aiManager';

const generateSchema = z.object({
  kind: z.enum(['package', 'story']),
  topic: z.string().min(2).max(80),
  learningLocale: z.string().min(2).max(10).default('en'),
  explanationLocale: z.string().min(2).max(10).default('vi'),
  ageBand: z.string().min(2).max(32).optional(),
  learningPackageId: z.string().max(80).optional(),
  connectionId: z.string().max(80).optional(),
  modelOverride: z.string().max(120).optional(),
});

export async function GET(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.content.read',
    async () => {
      const jobs = await listGenerationJobs();
      return NextResponse.json({ jobs });
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
      const parsed = generateSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid AI generation request', 400);
      }

      const actorName = staff.displayName || staff.email || staff.id;
      const jobId = `job-${Date.now().toString(36)}`;

      try {
        if (parsed.data.kind === 'package') {
          const { draft, providerUsed, modelUsed } =
            await generateLearningPackageDraft(parsed.data);
          const saved = await upsertCmsPackage(draft);

          await recordGenerationJob({
            id: jobId,
            kind: 'package',
            topic: parsed.data.topic,
            learningLocale: parsed.data.learningLocale,
            explanationLocale: parsed.data.explanationLocale,
            providerUsed,
            modelUsed,
            status: 'completed',
            createdEntityId: saved.id,
            createdBy: actorName,
            createdAt: new Date().toISOString(),
          });

          await recordStaffAudit({
            action: 'cms.ai.generate_package',
            modelName: 'learning_packages',
            docId: saved.id,
            actorName,
            actorEmail: staff.email || undefined,
            summary: `AI generated draft package "${parsed.data.topic}" via ${providerUsed}/${modelUsed}`,
          });

          return NextResponse.json(
            {
              kind: 'package',
              package: saved,
              providerUsed,
              modelUsed,
            },
            { status: 201 }
          );
        }

        const { draft, providerUsed, modelUsed } = await generateStoryDraft(
          parsed.data
        );
        const saved = await upsertCmsStory(draft);

        await recordGenerationJob({
          id: jobId,
          kind: 'story',
          topic: parsed.data.topic,
          learningLocale: parsed.data.learningLocale,
          explanationLocale: parsed.data.explanationLocale,
          providerUsed,
          modelUsed,
          status: 'completed',
          createdEntityId: saved.id,
          createdBy: actorName,
          createdAt: new Date().toISOString(),
        });

        await recordStaffAudit({
          action: 'cms.ai.generate_story',
          modelName: 'stories',
          docId: saved.id,
          actorName,
          actorEmail: staff.email || undefined,
          summary: `AI generated draft story "${parsed.data.topic}" via ${providerUsed}/${modelUsed}`,
        });

        return NextResponse.json(
          {
            kind: 'story',
            story: saved,
            providerUsed,
            modelUsed,
          },
          { status: 201 }
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'AI content generation failed';
        await recordGenerationJob({
          id: jobId,
          kind: parsed.data.kind,
          topic: parsed.data.topic,
          learningLocale: parsed.data.learningLocale,
          explanationLocale: parsed.data.explanationLocale,
          providerUsed: parsed.data.connectionId || 'default',
          modelUsed: parsed.data.modelOverride || 'default',
          status: 'failed',
          errorMessage: message,
          createdBy: actorName,
          createdAt: new Date().toISOString(),
        });
        return jsonError(message, 400);
      }
    }
  );
}

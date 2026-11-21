import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureServerInit, jsonError } from '../../../../../../../server/auth/guards';
import { evaluateCmsActivity } from '../../../../../../../server/data/cmsRepository';

const activityAnswerSchema = z.object({
  learnerId: z.string().min(1),
  lessonId: z.string().min(1),
  learningLocale: z.string().min(2).default('en'),
  explanationLocale: z.string().min(2).default('vi'),
  selectedId: z.string().optional(),
  matchedPairs: z
    .array(
      z.object({
        wordId: z.string(),
        imageId: z.string(),
      })
    )
    .optional(),
});

type RouteContext = { params: Promise<{ activityId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  await ensureServerInit();
  const { activityId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = activityAnswerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid activity answer payload', 400);
  }

  const result = await evaluateCmsActivity({
    activityId,
    lessonId: parsed.data.lessonId,
    selectedId: parsed.data.selectedId,
    matchedPairs: parsed.data.matchedPairs,
    learningLocale: parsed.data.learningLocale,
    explanationLocale: parsed.data.explanationLocale,
  });

  return NextResponse.json(result);
}

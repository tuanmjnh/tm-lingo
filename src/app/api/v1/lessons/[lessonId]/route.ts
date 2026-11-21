import { NextRequest, NextResponse } from 'next/server';
import type { ExperienceMode } from '../../../../../../packages/contracts/types';
import { ensureServerInit, jsonError } from '../../../../../../server/auth/guards';
import { resolveLessonFromCms } from '../../../../../../server/data/cmsRepository';

const VALID_MODES: ExperienceMode[] = [
  'guided',
  'flashcards',
  'listening',
  'game',
  'story',
  'explore',
];

type RouteContext = { params: Promise<{ lessonId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  await ensureServerInit();
  const { lessonId } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const rawMode = searchParams.get('mode') || 'guided';
  const mode: ExperienceMode = VALID_MODES.includes(rawMode as ExperienceMode)
    ? (rawMode as ExperienceMode)
    : 'guided';
  const learningLocale = searchParams.get('learningLocale') || 'en';
  const explanationLocale = searchParams.get('explanationLocale') || 'vi';

  const lesson = await resolveLessonFromCms({
    lessonId,
    mode,
    learningLocale,
    explanationLocale,
  });

  if (!lesson) {
    return jsonError('Lesson not found', 404);
  }
  return NextResponse.json({ lesson });
}

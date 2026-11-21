import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, withParentAuth } from '../../../../../server/auth/guards';
import { lingoStore } from '../../../../../server/data/seedStore';

const createLearnerSchema = z.object({
  nickname: z.string().min(1).max(32),
  ageYears: z.number().int().min(3).max(18),
  ageBand: z.string().min(2).max(32).optional(),
  gradeLevel: z.number().int().min(0).max(12).nullable().optional(),
  avatarTone: z.enum(['sky', 'amber', 'emerald', 'rose']).default('sky'),
  interfaceLocale: z.string().min(2).max(10).default('vi'),
  learningLocale: z.string().min(2).max(10).default('en'),
  explanationLocale: z.string().min(2).max(10).default('vi'),
  narrationLocale: z.string().min(2).max(10).default('en'),
});

export async function GET(request: NextRequest) {
  return withParentAuth(
    request,
    {},
    { allowGuest: true },
    async ({ parent, parentAccountId }) => {
      if (!parent) {
        return NextResponse.json({ learners: [] });
      }
      const learners = await lingoStore.listLearners(parentAccountId);
      return NextResponse.json({ learners });
    }
  );
}

export async function POST(request: NextRequest) {
  return withParentAuth(
    request,
    {},
    { allowGuest: false },
    async ({ parentAccountId }) => {
      const body = await request.json().catch(() => ({}));
      const parsed = createLearnerSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid learner profile data', 400);
      }
      const created = await lingoStore.createLearner(parentAccountId, parsed.data);
      return NextResponse.json({ learner: created }, { status: 201 });
    }
  );
}

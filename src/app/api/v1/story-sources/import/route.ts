import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '../../../../../../server/auth/guards';
import { importStoryFromSource } from '../../../../../../server/services/storySourceService';

const importSchema = z.object({
  sourceId: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/),
  externalId: z.string().min(1).max(120),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Thông tin truyện cần tải không hợp lệ.', 400);
  }

  try {
    const result = await importStoryFromSource({
      sourceId: parsed.data.sourceId,
      externalId: parsed.data.externalId,
    });
    return NextResponse.json(result, { status: result.alreadyExisted ? 200 : 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Không thể tải truyện lúc này.';
    return jsonError(message, 400);
  }
}

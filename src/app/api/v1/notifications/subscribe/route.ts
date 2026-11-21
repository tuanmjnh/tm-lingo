import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureServerInit, jsonError } from '../../../../../../server/auth/guards';
import { notificationService } from '../../../../../../server/modules/notifications';

const notificationCategoryEnum = z.enum([
  'reminder',
  'story',
  'progress',
  'announcement',
]);

const pushSubscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(2048),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({
      p256dh: z.string().min(1).max(256),
      auth: z.string().min(1).max(128),
    }),
  }),
  deviceLabel: z.string().min(1).max(60).default('Browser device'),
  locale: z.string().min(2).max(10).default('vi'),
  topics: z
    .array(notificationCategoryEnum)
    .min(1)
    .max(4)
    .default(['reminder', 'story', 'progress', 'announcement']),
});

export async function POST(request: NextRequest) {
  await ensureServerInit();
  const body = await request.json().catch(() => ({}));
  const parsed = pushSubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid push subscription payload', 400);
  }
  const created = await notificationService.subscribe(parsed.data);
  return NextResponse.json({ subscription: created }, { status: 201 });
}

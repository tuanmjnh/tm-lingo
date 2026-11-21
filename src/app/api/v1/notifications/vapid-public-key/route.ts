import { NextResponse } from 'next/server';
import { ensureServerInit } from '../../../../../../server/auth/guards';
import { notificationService } from '../../../../../../server/modules/notifications';

export async function GET() {
  await ensureServerInit();
  return NextResponse.json({
    publicKey: notificationService.getPublicKey(),
    configured: true,
  });
}

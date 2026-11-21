import { NextRequest, NextResponse } from 'next/server';
import { ensureServerInit } from '../../../../../server/auth/guards';
import { listVoices } from '../../../../../server/data/voiceRepository';

export async function GET(request: NextRequest) {
  await ensureServerInit();
  const locale = request.nextUrl.searchParams.get('locale') || undefined;
  const voices = await listVoices({ locale, includeArchived: false });
  return NextResponse.json({ voices });
}

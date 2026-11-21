import { NextResponse } from 'next/server';
import { ensureServerInit } from '../../../../../server/auth/guards';
import { listLanguages } from '../../../../../server/data/languageRepository';

export async function GET() {
  await ensureServerInit();
  const languages = await listLanguages({ includeArchived: false });
  return NextResponse.json({ languages });
}

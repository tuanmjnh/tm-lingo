import { NextRequest, NextResponse } from 'next/server';
import { ensureServerInit } from '../../../../../server/auth/guards';
import { listCmsStories } from '../../../../../server/data/cmsRepository';

export async function GET(request: NextRequest) {
  await ensureServerInit();
  const ageBand = request.nextUrl.searchParams.get('ageBand')?.trim();
  const allStories = await listCmsStories({ publishedOnly: true });
  const stories = ageBand
    ? allStories.filter(
        (story) => story.ageBands.length === 0 || story.ageBands.includes(ageBand)
      )
    : allStories;
  return NextResponse.json({ stories });
}

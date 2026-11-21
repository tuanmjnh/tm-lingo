import { NextResponse } from 'next/server';
import {
  listStorySources,
  STORY_CATEGORIES,
} from '../../../../../server/data/storySourceRepository';

export async function GET() {
  const sources = await listStorySources({ enabledOnly: true });
  return NextResponse.json({
    sources,
    categories: STORY_CATEGORIES,
  });
}

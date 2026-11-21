import { NextRequest, NextResponse } from 'next/server';
import type { StoryCategoryKey } from '../../../../../../packages/contracts/types';
import { STORY_CATEGORIES } from '../../../../../../server/data/storySourceRepository';
import { browseStorySourcesCatalog } from '../../../../../../server/services/storySourceService';

const VALID_CATEGORIES = new Set<string>(STORY_CATEGORIES.map((c) => c.key));

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const sourceId = (params.get('sourceId') || 'all').trim().slice(0, 64);
  const rawCategory = (params.get('category') || '').trim();
  const category = VALID_CATEGORIES.has(rawCategory)
    ? (rawCategory as StoryCategoryKey)
    : undefined;
  const q = (params.get('q') || '').trim().slice(0, 100);
  const ageBand = (params.get('ageBand') || 'all').trim().slice(0, 32);
  const locale = (params.get('locale') || 'all').trim().slice(0, 16);

  const result = await browseStorySourcesCatalog({
    sourceId,
    category,
    q,
    ageBand,
    locale,
  });

  return NextResponse.json({
    items: result.items,
    sources: result.sources,
    categories: STORY_CATEGORIES,
    warnings: result.warnings,
  });
}

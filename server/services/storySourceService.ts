import crypto from 'node:crypto';
import type {
  ExternalStoryCatalogItem,
  StoryBook,
  StoryCategoryKey,
  StorySegment,
  StorySourceConfig,
} from '../../packages/contracts/types';
import {
  getCmsStoryById,
  listCmsStories,
  upsertCmsStory,
} from '../data/cmsRepository';
import {
  buildStoryBookFromCurated,
  CURATED_BILINGUAL_STORIES,
} from '../data/curatedStoriesCatalog';
import {
  getStorySourceById,
  listStorySources,
  recordStorySourceTestResult,
  STORY_CATEGORIES,
} from '../data/storySourceRepository';
import {
  safeExternalFetch,
  sanitizeExternalMediaUrl,
} from '../security/urlGuard';

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedFeedEntry {
  fetchedAt: number;
  items: ResolvedFeedItem[];
}

interface ResolvedFeedItem {
  catalog: ExternalStoryCatalogItem;
  fullText?: string;
  audioUrl?: string;
  segments?: Array<{
    text: string;
    translationVi?: string;
    note?: string;
    assetRef?: string;
    audioUrl?: string;
  }>;
}

const feedCache = new Map<string, CachedFeedEntry>();

const CATEGORY_FALLBACK_ART: Record<StoryCategoryKey, string> = {
  fables: 'img-story-sunny-farm',
  animals: 'img-cat',
  bedtime: 'img-duck',
  adventure: 'img-dog',
  science: 'img-apple',
  'life-skills': 'img-story-fruit-market',
  classics: 'img-orange',
};

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#8217;|&#x2019;/gi, '’')
    .replace(/&#8216;|&#x2018;/gi, '‘')
    .replace(/&#8220;|&#x201c;/gi, '“')
    .replace(/&#8221;|&#x201d;/gi, '”')
    .replace(/&#8211;|&#x2013;/gi, '–')
    .replace(/&#8212;|&#x2014;/gi, '—')
    .replace(/&#(\d+);/g, (_m, code) => {
      const n = Number(code);
      return Number.isFinite(n) && n >= 32 && n <= 0x10ffff
        ? String.fromCodePoint(n)
        : '';
    });
}

function stripHtmlToParagraphs(html: string): string {
  const withBreaks = decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|br|li|h[1-6]|blockquote)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return withBreaks
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function inferCategoryFromText(
  text: string,
  allowedCategories: StoryCategoryKey[]
): StoryCategoryKey {
  const lower = text.toLowerCase();
  const candidates: Array<{ key: StoryCategoryKey; keywords: string[] }> = [
    {
      key: 'bedtime',
      keywords: ['bedtime', 'sleep', 'goodnight', 'lullaby', 'moon', 'dream', 'ngủ ngon'],
    },
    {
      key: 'animals',
      keywords: ['animal', 'cat', 'dog', 'duck', 'rabbit', 'bear', 'fox', 'wolf', 'lion', 'bird', 'động vật', 'thú'],
    },
    {
      key: 'fables',
      keywords: ['fairy', 'fable', 'aesop', 'grimm', 'andersen', 'folk', 'princess', 'dragon', 'magic', 'cổ tích', 'ngụ ngôn'],
    },
    {
      key: 'science',
      keywords: ['science', 'space', 'planet', 'nature', 'water', 'experiment', 'earth', 'khoa học'],
    },
    {
      key: 'adventure',
      keywords: ['adventure', 'island', 'voyage', 'journey', 'pirate', 'explore', 'treasure', 'phiêu lưu'],
    },
    {
      key: 'life-skills',
      keywords: ['kindness', 'friend', 'school', 'family', 'manners', 'share', 'kỹ năng', 'cảm ơn'],
    },
    {
      key: 'classics',
      keywords: ['classic', 'novel', 'literature', 'tale', 'kinh điển', 'văn học'],
    },
  ];

  for (const item of candidates) {
    if (item.keywords.some((kw) => lower.includes(kw))) {
      if (allowedCategories.length === 0 || allowedCategories.includes(item.key)) {
        return item.key;
      }
    }
  }

  return allowedCategories[0] ?? 'fables';
}

function cleanGutenbergPlainText(raw: string): string {
  let text = raw.replace(/\r\n/g, '\n');
  const startMatch = text.match(/\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i);
  if (startMatch && startMatch.index !== undefined) {
    text = text.slice(startMatch.index + startMatch[0].length);
  }
  const endMatch = text.match(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i);
  if (endMatch && endMatch.index !== undefined) {
    text = text.slice(0, endMatch.index);
  }

  // Strip excessive front-matter lines (tables of contents / publisher credits)
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((p) => {
      if (p.length < 35) return false;
      if (/^(produced by|transcribed by|illustration:|contents|chapter\s+[ivx0-9]+\.?$)/i.test(p)) {
        return false;
      }
      return true;
    });

  return paragraphs.join('\n\n');
}

function splitPlainTextToSegments(params: {
  storyId: string;
  text: string;
  locale: string;
  coverAssetRef: string;
  category: StoryCategoryKey;
  audioUrl?: string;
  maxPages?: number;
}): StorySegment[] {
  const maxPages = params.maxPages ?? 10;
  const targetChars = 340;
  const rawParagraphs = params.text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0);

  const pages: string[] = [];
  let buffer = '';

  for (const para of rawParagraphs) {
    if (pages.length >= maxPages) break;

    if (para.length > targetChars * 1.45) {
      if (buffer) {
        pages.push(buffer.trim());
        buffer = '';
        if (pages.length >= maxPages) break;
      }
      // Split long paragraph by sentence boundaries
      const sentences = para.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [para];
      let chunk = '';
      for (const s of sentences) {
        if (chunk.length + s.length > targetChars && chunk.length > 80) {
          pages.push(chunk.trim());
          chunk = s.trim();
          if (pages.length >= maxPages) break;
        } else {
          chunk = chunk ? `${chunk} ${s.trim()}` : s.trim();
        }
      }
      if (chunk.trim() && pages.length < maxPages) {
        pages.push(chunk.trim());
      }
      continue;
    }

    if (buffer.length + para.length > targetChars && buffer.length > 90) {
      pages.push(buffer.trim());
      buffer = para;
    } else {
      buffer = buffer ? `${buffer} ${para}` : para;
    }
  }

  if (buffer.trim() && pages.length < maxPages) {
    pages.push(buffer.trim());
  }

  if (pages.length === 0) {
    pages.push(
      params.locale === 'vi'
        ? 'Mời bé cùng nghe câu chuyện thú vị này nhé.'
        : 'Welcome to this story! Press play to listen aloud.'
    );
  }

  const fallbackArt = CATEGORY_FALLBACK_ART[params.category] ?? 'img-story-sunny-farm';

  return pages.map((pageText, idx) => ({
    id: `${params.storyId}-seg-${String(idx + 1).padStart(2, '0')}`,
    order: idx + 1,
    assetRef: idx === 0 ? params.coverAssetRef : fallbackArt,
    textByLocale: {
      [params.locale]: pageText,
    },
    explanationByLocale: {
      vi: `Trang ${idx + 1}/${pages.length} — Chạm bất kỳ từ nào để nghe phát âm chậm.`,
      en: `Page ${idx + 1} of ${pages.length} — Tap any word to hear it read slowly.`,
    },
    ...(idx === 0 && params.audioUrl
      ? { audioUrlByLocale: { [params.locale]: params.audioUrl } }
      : {}),
  }));
}

function stableSlugId(input: string): string {
  const clean = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
  const hash = crypto.createHash('sha1').update(input).digest('hex').slice(0, 8);
  return clean ? `${clean}-${hash}` : hash;
}

export function buildImportedStoryId(sourceId: string, externalId: string): string {
  const safeExternal = /^[a-zA-Z0-9_-]{1,42}$/.test(externalId)
    ? externalId.toLowerCase()
    : stableSlugId(externalId);
  return `story-src-${sourceId}-${safeExternal}`;
}

// ---------- Adapter 1: Curated Bilingual Library ----------

function fetchCuratedSourceItems(
  source: StorySourceConfig
): ResolvedFeedItem[] {
  return CURATED_BILINGUAL_STORIES.map((story) => ({
    catalog: {
      externalId: story.externalId,
      sourceId: source.id,
      sourceName: source.name,
      adapterType: 'curated_library',
      title: story.titles.en,
      titleVi: story.titles.vi,
      author: story.author,
      summary: story.summaries.en,
      summaryVi: story.summaries.vi,
      category: story.category,
      ageBands: story.ageBands,
      locale: 'en',
      availableLocales: ['en', 'vi'],
      coverAssetRef: story.coverAssetRef,
      hasAudio: false,
      estimatedMinutes: story.estimatedMinutes,
    },
  }));
}

// ---------- Adapter 2: Gutendex (Project Gutenberg Open API) ----------

interface GutendexBook {
  id: number;
  title: string;
  authors?: Array<{ name: string }>;
  subjects?: string[];
  bookshelves?: string[];
  languages?: string[];
  formats?: Record<string, string>;
  summaries?: string[];
}

async function fetchGutendexItems(
  source: StorySourceConfig,
  options: { category?: StoryCategoryKey; q?: string; locale?: string }
): Promise<ResolvedFeedItem[]> {
  const url = new URL(source.baseUrl);
  const topicMeta = options.category
    ? STORY_CATEGORIES.find((c) => c.key === options.category)
    : null;

  if (options.q?.trim()) {
    url.searchParams.set('search', options.q.trim().slice(0, 80));
  } else if (topicMeta) {
    url.searchParams.set('topic', topicMeta.gutendexTopic);
  } else {
    url.searchParams.set('topic', 'children');
  }

  const lang = options.locale && options.locale !== 'all' && options.locale !== 'vi'
    ? options.locale.slice(0, 2)
    : source.defaultLocale || 'en';
  url.searchParams.set('languages', lang);

  const cacheKey = `gutendex:${source.id}:${url.toString()}`;
  const cached = feedCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.items;
  }

  const res = await safeExternalFetch(url.toString(), {
    timeoutMs: 9000,
    maxBytes: 1_200_000,
    accept: 'application/json',
  });

  const payload = JSON.parse(res.text) as { results?: GutendexBook[] };
  const books = Array.isArray(payload.results) ? payload.results.slice(0, 14) : [];

  const items: ResolvedFeedItem[] = books
    .filter((b) => typeof b.id === 'number' && typeof b.title === 'string')
    .map((book) => {
      const subjectsJoined = [
        ...(book.subjects ?? []),
        ...(book.bookshelves ?? []),
        book.title,
      ].join(' ');
      const inferredCategory =
        options.category || inferCategoryFromText(subjectsJoined, source.categories);
      const rawCover =
        book.formats?.['image/jpeg'] || book.formats?.['image/png'] || null;
      const safeCover =
        sanitizeExternalMediaUrl(rawCover) ||
        CATEGORY_FALLBACK_ART[inferredCategory] ||
        'img-story-sunny-farm';
      const authorName =
        book.authors?.map((a) => a.name).filter(Boolean).join(', ') ||
        'Classic Author';
      const summaryText =
        (Array.isArray(book.summaries) && book.summaries[0]) ||
        (book.subjects && book.subjects.length > 0
          ? book.subjects.slice(0, 3).join(' · ')
          : `Classic story by ${authorName}`);
      const bookLang = book.languages?.[0] || source.defaultLocale || 'en';
      const isKids = /children|juvenile|fairy|fable|nursery/i.test(subjectsJoined);

      return {
        catalog: {
          externalId: String(book.id),
          sourceId: source.id,
          sourceName: source.name,
          adapterType: 'gutendex',
          title: book.title.slice(0, 140),
          author: authorName.slice(0, 100),
          summary: summaryText.slice(0, 240),
          category: inferredCategory,
          ageBands: isKids ? ['6-8', '9-11'] : ['12-14', '15-18'],
          locale: bookLang,
          availableLocales: [bookLang],
          coverAssetRef: safeCover,
          hasAudio: false,
          estimatedMinutes: 6,
        },
      };
    });

  feedCache.set(cacheKey, { fetchedAt: Date.now(), items });
  return items;
}

// ---------- Adapter 3: RSS / Atom Storytelling Feed ----------

function extractTagValue(block: string, tagName: string): string {
  const escaped = tagName.replace(':', '\\:');
  const re = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i');
  const m = block.match(re);
  return m ? decodeHtmlEntities(m[1]).trim() : '';
}

function extractAttrFromTag(
  block: string,
  tagName: string,
  attrName: string
): string | null {
  const escaped = tagName.replace(':', '\\:');
  const re = new RegExp(
    `<${escaped}[^>]*\\b${attrName}=["']([^"']+)["'][^>]*>`,
    'i'
  );
  const m = block.match(re);
  return m ? decodeHtmlEntities(m[1]).trim() : null;
}

function parseRssOrAtomFeed(
  xml: string,
  source: StorySourceConfig
): ResolvedFeedItem[] {
  const itemMatches =
    xml.match(/<item\b[\s\S]*?<\/item>/gi) ??
    xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ??
    [];

  const results: ResolvedFeedItem[] = [];

  for (const block of itemMatches.slice(0, 20)) {
    const rawTitle = extractTagValue(block, 'title');
    const title = stripHtmlToParagraphs(rawTitle).slice(0, 140);
    if (!title) continue;

    const guid =
      extractTagValue(block, 'guid') ||
      extractTagValue(block, 'id') ||
      extractTagValue(block, 'link') ||
      extractAttrFromTag(block, 'link', 'href') ||
      title;
    const externalId = stableSlugId(guid);

    const contentEncoded =
      extractTagValue(block, 'content:encoded') ||
      extractTagValue(block, 'content');
    const description =
      extractTagValue(block, 'description') || extractTagValue(block, 'summary');

    const fullText = stripHtmlToParagraphs(contentEncoded || description);
    const summaryText =
      stripHtmlToParagraphs(description || contentEncoded).slice(0, 240) ||
      title;

    const categoryTags = Array.from(
      block.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)
    ).map((m) => stripHtmlToParagraphs(m[1]));

    const inferredCategory = inferCategoryFromText(
      [title, summaryText, ...categoryTags].join(' '),
      source.categories
    );

    // Try extracting cover image from media:content / media:thumbnail / enclosure image / first <img>
    const enclosureUrl = extractAttrFromTag(block, 'enclosure', 'url');
    const enclosureType = extractAttrFromTag(block, 'enclosure', 'type') || '';
    const mediaUrl =
      extractAttrFromTag(block, 'media:thumbnail', 'url') ||
      extractAttrFromTag(block, 'media:content', 'url') ||
      extractAttrFromTag(block, 'itunes:image', 'href');
    const imgMatch = (contentEncoded || description).match(
      /<img[^>]+src=["']([^"']+)["']/i
    );

    const candidateImage =
      mediaUrl ||
      (enclosureType.startsWith('image/') ? enclosureUrl : null) ||
      (imgMatch ? imgMatch[1] : null);
    const safeCover =
      sanitizeExternalMediaUrl(candidateImage) ||
      CATEGORY_FALLBACK_ART[inferredCategory] ||
      'img-story-sunny-farm';

    const audioUrl =
      enclosureUrl &&
      (enclosureType.startsWith('audio/') || /\.mp3(\?|$)/i.test(enclosureUrl))
        ? sanitizeExternalMediaUrl(enclosureUrl) || undefined
        : undefined;

    const author =
      stripHtmlToParagraphs(
        extractTagValue(block, 'dc:creator') || extractTagValue(block, 'author')
      ).slice(0, 80) || source.name.en;

    const wordCount = fullText.split(/\s+/).filter(Boolean).length;
    const estimatedMinutes = Math.max(2, Math.min(15, Math.round(wordCount / 110)));

    results.push({
      catalog: {
        externalId,
        sourceId: source.id,
        sourceName: source.name,
        adapterType: 'rss',
        title,
        author,
        summary: summaryText,
        category: inferredCategory,
        ageBands: source.ageBands.length > 0 ? source.ageBands : ['3-5', '6-8'],
        locale: source.defaultLocale || 'en',
        availableLocales:
          source.supportedLocales.length > 0
            ? source.supportedLocales
            : [source.defaultLocale || 'en'],
        coverAssetRef: safeCover,
        hasAudio: Boolean(audioUrl),
        estimatedMinutes,
      },
      fullText: fullText.length > 40 ? fullText : `${title}\n\n${summaryText}`,
      audioUrl,
    });
  }

  return results;
}

async function fetchRssSourceItems(
  source: StorySourceConfig
): Promise<ResolvedFeedItem[]> {
  const cacheKey = `rss:${source.id}:${source.baseUrl}`;
  const cached = feedCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.items;
  }

  const res = await safeExternalFetch(source.baseUrl, {
    timeoutMs: 8500,
    maxBytes: 1_500_000,
    accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
  });

  const items = parseRssOrAtomFeed(res.text, source);
  feedCache.set(cacheKey, { fetchedAt: Date.now(), items });
  return items;
}

// ---------- Adapter 4: Generic JSON Catalog ----------

interface ExternalJsonStoryItem {
  id?: string | number;
  title?: string;
  titleVi?: string;
  author?: string;
  summary?: string;
  summaryVi?: string;
  category?: string;
  ageBands?: string[];
  locale?: string;
  coverUrl?: string;
  audioUrl?: string;
  body?: string;
  pages?: Array<{ text?: string; translationVi?: string; note?: string }>;
}

async function fetchJsonCatalogItems(
  source: StorySourceConfig
): Promise<ResolvedFeedItem[]> {
  const cacheKey = `json:${source.id}:${source.baseUrl}`;
  const cached = feedCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.items;
  }

  const res = await safeExternalFetch(source.baseUrl, {
    timeoutMs: 8500,
    maxBytes: 1_500_000,
    accept: 'application/json',
  });

  const raw = JSON.parse(res.text) as
    | ExternalJsonStoryItem[]
    | { stories?: ExternalJsonStoryItem[]; items?: ExternalJsonStoryItem[] };

  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.stories)
      ? raw.stories
      : Array.isArray(raw.items)
        ? raw.items
        : [];

  const validCategorySet = new Set<string>(STORY_CATEGORIES.map((c) => c.key));

  const items: ResolvedFeedItem[] = [];
  for (const entry of list.slice(0, 30)) {
    const title = typeof entry.title === 'string' ? entry.title.trim().slice(0, 140) : '';
    if (!title) continue;

    const externalId =
      entry.id !== undefined ? stableSlugId(String(entry.id)) : stableSlugId(title);
    const category: StoryCategoryKey =
      typeof entry.category === 'string' && validCategorySet.has(entry.category)
        ? (entry.category as StoryCategoryKey)
        : inferCategoryFromText(
            `${title} ${entry.summary ?? ''}`,
            source.categories
          );

    const safeCover =
      sanitizeExternalMediaUrl(entry.coverUrl) ||
      CATEGORY_FALLBACK_ART[category] ||
      'img-story-sunny-farm';
    const safeAudio = sanitizeExternalMediaUrl(entry.audioUrl) || undefined;
    const locale =
      typeof entry.locale === 'string' && entry.locale.trim()
        ? entry.locale.trim().slice(0, 10)
        : source.defaultLocale || 'en';

    const segments = Array.isArray(entry.pages)
      ? entry.pages
          .filter((p) => typeof p?.text === 'string' && p.text.trim().length > 0)
          .slice(0, 16)
          .map((p) => ({
            text: stripHtmlToParagraphs(p.text || ''),
            translationVi: p.translationVi
              ? stripHtmlToParagraphs(p.translationVi)
              : undefined,
            note: p.note ? stripHtmlToParagraphs(p.note) : undefined,
          }))
      : undefined;

    items.push({
      catalog: {
        externalId,
        sourceId: source.id,
        sourceName: source.name,
        adapterType: 'json_catalog',
        title,
        titleVi: typeof entry.titleVi === 'string' ? entry.titleVi.slice(0, 140) : undefined,
        author: typeof entry.author === 'string' ? entry.author.slice(0, 80) : source.name.en,
        summary:
          typeof entry.summary === 'string'
            ? stripHtmlToParagraphs(entry.summary).slice(0, 240)
            : title,
        summaryVi:
          typeof entry.summaryVi === 'string'
            ? stripHtmlToParagraphs(entry.summaryVi).slice(0, 240)
            : undefined,
        category,
        ageBands:
          Array.isArray(entry.ageBands) && entry.ageBands.length > 0
            ? entry.ageBands.filter((b) => typeof b === 'string').slice(0, 6)
            : source.ageBands,
        locale,
        availableLocales: entry.titleVi ? [locale, 'vi'] : [locale],
        coverAssetRef: safeCover,
        hasAudio: Boolean(safeAudio),
        estimatedMinutes: Math.max(2, segments?.length ?? 4),
      },
      fullText:
        typeof entry.body === 'string'
          ? stripHtmlToParagraphs(entry.body)
          : undefined,
      audioUrl: safeAudio,
      segments,
    });
  }

  feedCache.set(cacheKey, { fetchedAt: Date.now(), items });
  return items;
}

async function fetchItemsForSource(
  source: StorySourceConfig,
  options: { category?: StoryCategoryKey; q?: string; locale?: string }
): Promise<ResolvedFeedItem[]> {
  switch (source.adapterType) {
    case 'curated_library':
      return fetchCuratedSourceItems(source);
    case 'gutendex':
      return fetchGutendexItems(source, options);
    case 'rss':
      return fetchRssSourceItems(source);
    case 'json_catalog':
      return fetchJsonCatalogItems(source);
    default:
      return [];
  }
}

// ---------- Public Browse & Filter ----------

export async function browseStorySourcesCatalog(filters: {
  sourceId?: string;
  category?: StoryCategoryKey;
  q?: string;
  ageBand?: string;
  locale?: string;
}): Promise<{
  items: ExternalStoryCatalogItem[];
  sources: StorySourceConfig[];
  warnings: Array<{ sourceId: string; sourceName: string; message: string }>;
}> {
  const allEnabled = await listStorySources({ enabledOnly: true });
  const targetSources = filters.sourceId && filters.sourceId !== 'all'
    ? allEnabled.filter((s) => s.id === filters.sourceId)
    : allEnabled;

  const existingStories = await listCmsStories({ includeArchived: false });
  const importedById = new Set(existingStories.map((s) => s.id));

  const settled = await Promise.allSettled(
    targetSources.map((src) =>
      fetchItemsForSource(src, {
        category: filters.category,
        q: filters.q,
        locale: filters.locale,
      }).then((items) => ({ src, items }))
    )
  );

  const collected: ExternalStoryCatalogItem[] = [];
  const warnings: Array<{ sourceId: string; sourceName: string; message: string }> = [];

  for (let i = 0; i < settled.length; i += 1) {
    const result = settled[i];
    const src = targetSources[i];
    if (result.status === 'fulfilled') {
      for (const entry of result.value.items) {
        const expectedId = buildImportedStoryId(
          entry.catalog.sourceId,
          entry.catalog.externalId
        );
        collected.push({
          ...entry.catalog,
          alreadyImportedStoryId: importedById.has(expectedId) ? expectedId : null,
        });
      }
    } else {
      warnings.push({
        sourceId: src.id,
        sourceName: src.name.vi,
        message:
          result.reason instanceof Error
            ? result.reason.message
            : 'Không thể tải danh mục từ nguồn này lúc này.',
      });
    }
  }

  // Apply unified category, ageBand, locale, and keyword filters across all adapters
  const qLower = (filters.q || '').trim().toLowerCase();
  const filtered = collected.filter((item) => {
    if (filters.category && item.category !== filters.category) {
      return false;
    }
    if (
      filters.ageBand &&
      filters.ageBand !== 'all' &&
      !item.ageBands.includes(filters.ageBand)
    ) {
      return false;
    }
    if (
      filters.locale &&
      filters.locale !== 'all' &&
      item.locale !== filters.locale &&
      !item.availableLocales.includes(filters.locale)
    ) {
      return false;
    }
    if (qLower) {
      const haystack = [
        item.title,
        item.titleVi || '',
        item.author || '',
        item.summary,
        item.summaryVi || '',
        item.sourceName.vi,
        item.sourceName.en,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(qLower)) return false;
    }
    return true;
  });

  return {
    items: filtered,
    sources: allEnabled,
    warnings,
  };
}

// ---------- Download & Import Selected Story into TM-Lingo Library ----------

export async function importStoryFromSource(params: {
  sourceId: string;
  externalId: string;
}): Promise<{ story: StoryBook; alreadyExisted: boolean }> {
  const source = await getStorySourceById(params.sourceId);
  if (!source || source.archivedAt || !source.enabled) {
    throw new Error('Nguồn truyện không tồn tại hoặc đang bị tắt.');
  }

  const storyId = buildImportedStoryId(source.id, params.externalId);
  const existing = await getCmsStoryById(storyId);
  if (existing && !existing.archivedAt) {
    return { story: existing, alreadyExisted: true };
  }

  // 1. Curated bilingual library
  if (source.adapterType === 'curated_library') {
    const found = CURATED_BILINGUAL_STORIES.find(
      (s) => s.externalId === params.externalId
    );
    if (!found) {
      throw new Error('Không tìm thấy truyện trong kho tuyển chọn.');
    }
    const built = buildStoryBookFromCurated(found, source.id, source.name.vi);
    const saved = await upsertCmsStory(built);
    return { story: saved, alreadyExisted: false };
  }

  // 2. Gutendex (Project Gutenberg) — fetch metadata & plain text securely
  if (source.adapterType === 'gutendex') {
    if (!/^\d{1,8}$/.test(params.externalId)) {
      throw new Error('Mã truyện không hợp lệ.');
    }
    const base = source.baseUrl.replace(/\/+$/, '');
    const detailUrl = `${base}/${params.externalId}`;
    const detailRes = await safeExternalFetch(detailUrl, {
      timeoutMs: 10_000,
      maxBytes: 500_000,
      accept: 'application/json',
    });
    const book = JSON.parse(detailRes.text) as GutendexBook;
    if (!book?.title) {
      throw new Error('Không đọc được thông tin sách từ nguồn.');
    }

    const subjectsJoined = [
      ...(book.subjects ?? []),
      ...(book.bookshelves ?? []),
      book.title,
    ].join(' ');
    const category = inferCategoryFromText(subjectsJoined, source.categories);
    const locale = book.languages?.[0] || source.defaultLocale || 'en';
    const coverAssetRef =
      sanitizeExternalMediaUrl(
        book.formats?.['image/jpeg'] || book.formats?.['image/png']
      ) ||
      CATEGORY_FALLBACK_ART[category] ||
      'img-story-sunny-farm';

    const textUrl =
      book.formats?.['text/plain; charset=utf-8'] ||
      book.formats?.['text/plain; charset=us-ascii'] ||
      book.formats?.['text/plain'] ||
      null;

    let cleanText = '';
    if (textUrl) {
      const safeTextUrl = sanitizeExternalMediaUrl(textUrl);
      if (safeTextUrl) {
        const textRes = await safeExternalFetch(safeTextUrl, {
          timeoutMs: 12_000,
          maxBytes: 1_800_000,
          accept: 'text/plain',
          allowedHostSuffixes: ['gutenberg.org', 'gutendex.com'],
        });
        cleanText = cleanGutenbergPlainText(textRes.text);
      }
    }

    const authorName =
      book.authors?.map((a) => a.name).filter(Boolean).join(', ') ||
      'Classic Author';
    const summaryText =
      (Array.isArray(book.summaries) && book.summaries[0]) ||
      `A classic reading by ${authorName}.`;

    const segments = splitPlainTextToSegments({
      storyId,
      text: cleanText || summaryText,
      locale,
      coverAssetRef,
      category,
      maxPages: 12,
    });

    const isKids = /children|juvenile|fairy|fable|nursery/i.test(subjectsJoined);
    const story: StoryBook = {
      id: storyId,
      schemaVersion: 1,
      learningPackageId: 'lp-fruits-a1',
      ageBands: isKids ? ['6-8', '9-11'] : ['12-14', '15-18'],
      coverAssetRef,
      availableLocales: [locale],
      availableExplanationLocales: ['vi', 'en'],
      titles: {
        [locale]: book.title.slice(0, 140),
        vi: book.title.slice(0, 140),
      },
      summaries: {
        [locale]: summaryText.slice(0, 260),
        vi: `${summaryText.slice(0, 220)} (${authorName})`,
      },
      segments,
      category,
      sourceId: source.id,
      sourceName: source.name.vi,
      externalId: params.externalId,
      author: authorName.slice(0, 100),
      status: 'published',
      publishedVersion: 1,
      archivedAt: null,
      updatedAt: new Date().toISOString(),
    };

    const saved = await upsertCmsStory(story);
    return { story: saved, alreadyExisted: false };
  }

  // 3. RSS / Atom or JSON Catalog — look up strictly from server-fetched feed
  const feedItems =
    source.adapterType === 'rss'
      ? await fetchRssSourceItems(source)
      : await fetchJsonCatalogItems(source);

  const matched = feedItems.find(
    (entry) => entry.catalog.externalId === params.externalId
  );
  if (!matched) {
    throw new Error('Không tìm thấy truyện đã chọn trong nguồn này.');
  }

  const { catalog } = matched;
  let segments: StorySegment[];

  if (matched.segments && matched.segments.length > 0) {
    segments = matched.segments.map((seg, idx) => ({
      id: `${storyId}-seg-${String(idx + 1).padStart(2, '0')}`,
      order: idx + 1,
      assetRef:
        idx === 0
          ? catalog.coverAssetRef
          : CATEGORY_FALLBACK_ART[catalog.category] || 'img-story-sunny-farm',
      textByLocale: {
        [catalog.locale]: seg.text,
        ...(seg.translationVi ? { vi: seg.translationVi } : {}),
      },
      explanationByLocale: {
        vi: seg.note || `Trang ${idx + 1}/${matched.segments!.length}`,
        en: seg.note || `Page ${idx + 1} of ${matched.segments!.length}`,
      },
      ...(idx === 0 && matched.audioUrl
        ? { audioUrlByLocale: { [catalog.locale]: matched.audioUrl } }
        : {}),
    }));
  } else {
    segments = splitPlainTextToSegments({
      storyId,
      text: matched.fullText || catalog.summary,
      locale: catalog.locale,
      coverAssetRef: catalog.coverAssetRef,
      category: catalog.category,
      audioUrl: matched.audioUrl,
      maxPages: 12,
    });
  }

  const story: StoryBook = {
    id: storyId,
    schemaVersion: 1,
    learningPackageId: 'lp-fruits-a1',
    ageBands: catalog.ageBands.length > 0 ? catalog.ageBands : ['3-5', '6-8'],
    coverAssetRef: catalog.coverAssetRef,
    availableLocales: catalog.availableLocales,
    availableExplanationLocales: ['vi', 'en'],
    titles: {
      [catalog.locale]: catalog.title,
      vi: catalog.titleVi || catalog.title,
    },
    summaries: {
      [catalog.locale]: catalog.summary,
      vi: catalog.summaryVi || catalog.summary,
    },
    segments,
    category: catalog.category,
    sourceId: source.id,
    sourceName: source.name.vi,
    externalId: catalog.externalId,
    author: catalog.author,
    status: 'published',
    publishedVersion: 1,
    archivedAt: null,
    updatedAt: new Date().toISOString(),
  };

  const saved = await upsertCmsStory(story);
  return { story: saved, alreadyExisted: false };
}

// ---------- Admin Connection Test ----------

export async function testStorySourceConnection(sourceId: string): Promise<{
  ok: boolean;
  itemCount: number;
  message: string;
  durationMs: number;
  source: StorySourceConfig | null;
}> {
  const source = await getStorySourceById(sourceId);
  if (!source) {
    throw new Error('Không tìm thấy nguồn truyện.');
  }

  // Clear cache entries for this source so test is always live
  for (const key of Array.from(feedCache.keys())) {
    if (key.includes(`:${source.id}:`)) {
      feedCache.delete(key);
    }
  }

  const startedAt = Date.now();
  try {
    const items = await fetchItemsForSource(source, {});
    const durationMs = Date.now() - startedAt;
    const message = `Kết nối thành công · tìm thấy ${items.length} truyện (${durationMs}ms).`;
    const updated = await recordStorySourceTestResult(source.id, {
      status: 'ok',
      message,
      itemCount: items.length,
    });
    return {
      ok: true,
      itemCount: items.length,
      message,
      durationMs,
      source: updated,
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message =
      err instanceof Error ? err.message : 'Không thể kết nối tới nguồn truyện.';
    const updated = await recordStorySourceTestResult(source.id, {
      status: 'error',
      message,
      itemCount: 0,
    });
    return {
      ok: false,
      itemCount: 0,
      message,
      durationMs,
      source: updated,
    };
  }
}

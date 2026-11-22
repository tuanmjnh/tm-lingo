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
  targetChars?: number;
  chapterPrefix?: string;
}): StorySegment[] {
  const maxPages = params.maxPages ?? 30;
  const targetChars = params.targetChars ?? 950;
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
        if (chunk.length + s.length > targetChars && chunk.length > 160) {
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

    if (buffer.length + para.length > targetChars && buffer.length > 220) {
      pages.push(buffer.trim());
      buffer = para;
    } else {
      buffer = buffer ? `${buffer}\n\n${para}` : para;
    }
  }

  if (buffer.trim() && pages.length < maxPages) {
    pages.push(buffer.trim());
  }

  if (pages.length === 0) {
    pages.push(
      params.locale === 'vi'
        ? 'Mời bạn cùng lắng nghe câu chuyện thú vị này nhé.'
        : 'Welcome to this story! Press play to listen aloud.'
    );
  }

  const fallbackArt = CATEGORY_FALLBACK_ART[params.category] ?? 'img-story-sunny-farm';
  const chapterLabel =
    params.chapterPrefix ?? (params.locale === 'vi' ? 'Phần' : 'Chapter');

  return pages.map((pageText, idx) => ({
    id: `${params.storyId}-seg-${String(idx + 1).padStart(2, '0')}`,
    order: idx + 1,
    assetRef: idx === 0 ? params.coverAssetRef : fallbackArt,
    chapterTitle: `${chapterLabel} ${idx + 1}`,
    textByLocale: {
      [params.locale]: pageText,
    },
    explanationByLocale: {
      vi: `${chapterLabel} ${idx + 1}/${pages.length} — Chạm nút Nghe để thưởng thức liên tục không giới hạn thời gian.`,
      en: `${chapterLabel} ${idx + 1} of ${pages.length} — Press Play for continuous unlimited audiobook listening.`,
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
      locale: 'vi',
      availableLocales: ['vi', 'en'],
      coverAssetRef: story.coverAssetRef,
      storyFormat: story.storyFormat ?? 'picture_book',
      chapterCount: story.segments.length,
      totalDurationSec: story.estimatedMinutes * 60,
      hasAudio: story.storyFormat === 'long_story',
      estimatedMinutes: story.estimatedMinutes,
    },
  }));
}

// ---------- Adapter 1B: LibriVox Public Domain Audiobooks (Multi-Chapter MP3) ----------

interface LibriVoxAuthor {
  first_name?: string;
  last_name?: string;
}

interface LibriVoxSection {
  id?: string;
  section_number?: string;
  title?: string;
  listen_url?: string;
  language?: string;
  playtime?: string | number;
  readers?: Array<{ display_name?: string }>;
}

interface LibriVoxBook {
  id?: string | number;
  title?: string;
  description?: string;
  language?: string;
  totaltimesecs?: number;
  num_sections?: string | number;
  url_iarchive?: string;
  authors?: LibriVoxAuthor[];
  sections?: LibriVoxSection[];
  genres?: Array<{ name?: string }>;
}

const LIBRIVOX_CATEGORY_GENRE: Record<StoryCategoryKey, string> = {
  fables: 'Myths, Legends & Fairy Tales',
  animals: 'Animals & Nature',
  bedtime: "Children's Fiction",
  adventure: 'Action & Adventure Fiction',
  science: 'Science',
  'life-skills': "Children's Fiction",
  classics: "Children's Fiction",
};

function mapLibriVoxLanguageToLocale(language?: string): string {
  const lower = (language || '').trim().toLowerCase();
  if (lower.startsWith('viet')) return 'vi';
  if (lower.startsWith('fren')) return 'fr';
  if (lower.startsWith('germ')) return 'de';
  if (lower.startsWith('span')) return 'es';
  if (lower.startsWith('japan')) return 'ja';
  if (lower.startsWith('chin')) return 'zh';
  return 'en';
}

function extractArchiveCoverFromUrl(urlIArchive?: string): string | null {
  if (!urlIArchive || typeof urlIArchive !== 'string') return null;
  const match = urlIArchive.match(/archive\.org\/details\/([a-zA-Z0-9._-]+)/i);
  if (!match?.[1]) return null;
  return sanitizeExternalMediaUrl(`https://archive.org/services/img/${match[1]}`);
}

async function fetchLibriVoxItems(
  source: StorySourceConfig,
  options: { category?: StoryCategoryKey; q?: string; locale?: string }
): Promise<ResolvedFeedItem[]> {
  const url = new URL(source.baseUrl);
  url.searchParams.set('format', 'json');
  url.searchParams.set('extended', '1');
  url.searchParams.set('limit', '12');

  if (options.q?.trim()) {
    url.searchParams.set('title', `^${options.q.trim().slice(0, 60)}`);
  } else {
    const genre = options.category
      ? LIBRIVOX_CATEGORY_GENRE[options.category]
      : "Children's Fiction";
    url.searchParams.set('genre', genre);
  }

  const cacheKey = `librivox:${source.id}:${url.toString()}`;
  const cached = feedCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.items;
  }

  let res: { text: string; contentType: string; finalUrl: string };
  try {
    res = await safeExternalFetch(url.toString(), {
      timeoutMs: 11_000,
      maxBytes: 2_000_000,
      accept: 'application/json',
    });
  } catch (err) {
    // LibriVox returns 404 when a prefix title search has 0 matches — treat cleanly as empty list
    if (options.q?.trim() && err instanceof Error && err.message.includes('404')) {
      return [];
    }
    throw err;
  }

  const payload = JSON.parse(res.text) as { books?: LibriVoxBook[] };
  const books = Array.isArray(payload.books) ? payload.books : [];

  const items: ResolvedFeedItem[] = books
    .filter((b) => b.id && typeof b.title === 'string' && b.title.trim().length > 0)
    .map((book) => {
      const cleanDesc = stripHtmlToParagraphs(book.description || '');
      const genreText = (book.genres ?? []).map((g) => g.name || '').join(' ');
      const inferredCategory =
        options.category ||
        inferCategoryFromText(`${book.title} ${genreText} ${cleanDesc}`, source.categories);
      const authorName =
        (book.authors ?? [])
          .map((a) => [a.first_name, a.last_name].filter(Boolean).join(' ').trim())
          .filter(Boolean)
          .join(', ') || 'LibriVox Classic';
      const locale = mapLibriVoxLanguageToLocale(book.language);
      const totalSec = Number(book.totaltimesecs) || 0;
      const chapterCount =
        Array.isArray(book.sections) && book.sections.length > 0
          ? book.sections.length
          : Number(book.num_sections) || 1;
      const estimatedMinutes = Math.max(
        5,
        Math.round(totalSec > 0 ? totalSec / 60 : chapterCount * 8)
      );
      const safeCover =
        extractArchiveCoverFromUrl(book.url_iarchive) ||
        CATEGORY_FALLBACK_ART[inferredCategory] ||
        'img-story-sunny-farm';

      const isKids = /child|fairy|fable|juvenile|bedtime|animal|nursery/i.test(
        `${book.title} ${genreText}`
      );

      return {
        catalog: {
          externalId: String(book.id),
          sourceId: source.id,
          sourceName: source.name,
          adapterType: 'librivox',
          title: (book.title || '').trim().slice(0, 140),
          author: authorName.slice(0, 100),
          summary: (cleanDesc || `Full audiobook by ${authorName}.`).slice(0, 240),
          category: inferredCategory,
          ageBands: isKids ? ['6-8', '9-11', '12-14'] : ['9-11', '12-14', '15-18'],
          locale,
          availableLocales: [locale],
          coverAssetRef: safeCover,
          storyFormat: 'audiobook',
          chapterCount,
          totalDurationSec: totalSec || estimatedMinutes * 60,
          hasAudio: true,
          estimatedMinutes,
        },
      };
    });

  feedCache.set(cacheKey, { fetchedAt: Date.now(), items });
  return items;
}

// ---------- Adapter 1C: Vietnamese Wikisource (Open Vietnamese Folklore & Literature) ----------

interface WikiSearchHit {
  pageid?: number;
  title?: string;
  snippet?: string;
  wordcount?: number;
}

const WIKISOURCE_CATEGORY_QUERY: Record<StoryCategoryKey, string> = {
  fables: 'Sự tích',
  animals: 'Truyện cổ tích',
  bedtime: 'Truyện cổ tích',
  adventure: 'Truyền kỳ',
  science: 'Sự tích',
  'life-skills': 'Truyện ngắn',
  classics: 'Truyện ngắn',
};

function cleanWikisourceHtml(html: string): string {
  // Remove MediaWiki navigation/header/footer/edit tables before extracting clean text
  const stripped = html
    .replace(/<table[\s\S]*?<\/table>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<sup[\s\S]*?<\/sup>/gi, '')
    .replace(/<div[^>]*class=["'][^"']*(?:ws-header|ws-noexport|headertemplate|navbox|toc|mw-editsection|license|printfooter)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, ' ');

  const text = stripHtmlToParagraphs(stripped);
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => {
      if (p.length < 30) return false;
      if (/^(thông tin về bản này|tác phẩm này thuộc phạm vi công cộng|nguồn:|mục lục|xem thêm|chú thích)/i.test(p)) {
        return false;
      }
      return true;
    });

  return paragraphs.join('\n\n');
}

async function fetchWikisourceViItems(
  source: StorySourceConfig,
  options: { category?: StoryCategoryKey; q?: string }
): Promise<ResolvedFeedItem[]> {
  const searchQuery = options.q?.trim()
    ? options.q.trim().slice(0, 80)
    : options.category
      ? WIKISOURCE_CATEGORY_QUERY[options.category]
      : 'Sự tích';

  const url = new URL(source.baseUrl);
  url.searchParams.set('action', 'query');
  url.searchParams.set('list', 'search');
  url.searchParams.set('srsearch', searchQuery);
  url.searchParams.set('srnamespace', '0');
  url.searchParams.set('srlimit', '18');
  url.searchParams.set('format', 'json');

  const cacheKey = `wikisource:${source.id}:${url.toString()}`;
  const cached = feedCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.items;
  }

  const res = await safeExternalFetch(url.toString(), {
    timeoutMs: 10_000,
    maxBytes: 1_000_000,
    accept: 'application/json',
  });

  const payload = JSON.parse(res.text) as {
    query?: { search?: WikiSearchHit[] };
  };
  const hits = Array.isArray(payload.query?.search) ? payload.query!.search! : [];

  const items: ResolvedFeedItem[] = hits
    .filter((h) => {
      if (!h.pageid || !h.title) return false;
      // Skip meta/index/preface subpages or tiny stubs
      if (/(\/Tựa|\/Lời |Mục lục|Thể loại:)/i.test(h.title)) return false;
      if (typeof h.wordcount === 'number' && h.wordcount < 160) return false;
      return true;
    })
    .slice(0, 12)
    .map((hit) => {
      const title = (hit.title || '').trim().slice(0, 140);
      const snippet = stripHtmlToParagraphs(hit.snippet || '');
      const inferredCategory =
        options.category || inferCategoryFromText(`${title} ${snippet}`, source.categories);
      const words = Number(hit.wordcount) || 450;
      const estimatedMinutes = Math.max(4, Math.min(45, Math.round(words / 135)));
      const chapterCount = Math.max(2, Math.min(24, Math.ceil(words / 220)));

      return {
        catalog: {
          externalId: String(hit.pageid),
          sourceId: source.id,
          sourceName: source.name,
          adapterType: 'wikisource',
          title,
          titleVi: title,
          author: 'Kho Văn Học & Cổ Tích Mở (vi.wikisource.org)',
          summary: snippet
            ? `${snippet.slice(0, 210)}...`
            : `Truyện dài Tiếng Việt (~${words} từ) chia chương đọc & nghe sách nói không giới hạn.`,
          summaryVi: snippet
            ? `${snippet.slice(0, 210)}...`
            : `Truyện dài Tiếng Việt (~${words} từ) chia chương đọc & nghe sách nói không giới hạn.`,
          category: inferredCategory,
          ageBands: ['6-8', '9-11', '12-14', '15-18'],
          locale: 'vi',
          availableLocales: ['vi'],
          coverAssetRef:
            CATEGORY_FALLBACK_ART[inferredCategory] || 'img-story-sunny-farm',
          storyFormat: 'long_story',
          chapterCount,
          totalDurationSec: estimatedMinutes * 60,
          hasAudio: true,
          estimatedMinutes,
        },
      };
    });

  feedCache.set(cacheKey, { fetchedAt: Date.now(), items });
  return items;
}

// ---------- Adapter 1D: Internet Archive Children's Audiobooks (MP3) ----------

interface ArchiveDoc {
  identifier?: string;
  title?: string | string[];
  creator?: string | string[];
  description?: string | string[];
}

const ARCHIVE_CATEGORY_TOPIC: Record<StoryCategoryKey, string> = {
  fables: '(fairy tales OR fables OR aesop)',
  animals: '(animals OR nature OR jungle)',
  bedtime: '(bedtime OR children OR lullaby)',
  adventure: '(adventure OR treasure OR voyage)',
  science: '(science OR nature OR discovery)',
  'life-skills': '(children OR youth OR kindness)',
  classics: '(children OR fairy tales OR classics)',
};

function firstString(val?: string | string[]): string {
  if (Array.isArray(val)) return String(val[0] || '');
  return typeof val === 'string' ? val : '';
}

async function fetchArchiveOrgItems(
  source: StorySourceConfig,
  options: { category?: StoryCategoryKey; q?: string }
): Promise<ResolvedFeedItem[]> {
  const topicClause = options.q?.trim()
    ? `(${options.q.trim().replace(/[^a-zA-Z0-9\s-]/g, ' ').slice(0, 60)})`
    : options.category
      ? ARCHIVE_CATEGORY_TOPIC[options.category]
      : '(children OR fairy tales)';

  const query = `collection:librivoxaudio AND subject:${topicClause} AND mediatype:audio`;
  const url = new URL(source.baseUrl);
  url.searchParams.set('q', query);
  url.searchParams.append('fl[]', 'identifier');
  url.searchParams.append('fl[]', 'title');
  url.searchParams.append('fl[]', 'creator');
  url.searchParams.append('fl[]', 'description');
  url.searchParams.append('sort[]', 'downloads desc');
  url.searchParams.set('output', 'json');
  url.searchParams.set('rows', '12');

  const cacheKey = `archive_org:${source.id}:${url.toString()}`;
  const cached = feedCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.items;
  }

  const res = await safeExternalFetch(url.toString(), {
    timeoutMs: 10_000,
    maxBytes: 1_200_000,
    accept: 'application/json',
  });

  const payload = JSON.parse(res.text) as {
    response?: { docs?: ArchiveDoc[] };
  };
  const docs = Array.isArray(payload.response?.docs) ? payload.response!.docs! : [];

  const items: ResolvedFeedItem[] = docs
    .filter((d) => typeof d.identifier === 'string' && d.identifier.trim().length > 0)
    .map((doc) => {
      const id = doc.identifier!.trim();
      const title = firstString(doc.title).trim().slice(0, 140) || id;
      const author = firstString(doc.creator).trim().slice(0, 100) || 'LibriVox / Internet Archive';
      const desc = stripHtmlToParagraphs(firstString(doc.description));
      const inferredCategory =
        options.category || inferCategoryFromText(`${title} ${desc}`, source.categories);
      const cover =
        sanitizeExternalMediaUrl(`https://archive.org/services/img/${id}`) ||
        CATEGORY_FALLBACK_ART[inferredCategory] ||
        'img-story-sunny-farm';

      return {
        catalog: {
          externalId: id,
          sourceId: source.id,
          sourceName: source.name,
          adapterType: 'archive_org',
          title,
          author,
          summary: (desc || `Public-domain audiobook by ${author}.`).slice(0, 240),
          category: inferredCategory,
          ageBands: ['3-5', '6-8', '9-11', '12-14'],
          locale: source.defaultLocale || 'en',
          availableLocales: [source.defaultLocale || 'en'],
          coverAssetRef: cover,
          storyFormat: 'audiobook',
          hasAudio: true,
          estimatedMinutes: 35,
        },
      };
    });

  feedCache.set(cacheKey, { fetchedAt: Date.now(), items });
  return items;
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
    timeoutMs: 10_000,
    maxBytes: 1_500_000,
    accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
  });

  const head = res.text.trimStart().slice(0, 200).toLowerCase();
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) {
    throw new Error(
      'Địa chỉ này trả về trang HTML thay vì dữ liệu RSS/Atom hợp lệ.'
    );
  }

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
    case 'librivox':
      return fetchLibriVoxItems(source, options);
    case 'wikisource':
      return fetchWikisourceViItems(source, options);
    case 'archive_org':
      return fetchArchiveOrgItems(source, options);
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

  // 1B. LibriVox Public Domain Audiobooks (Multi-Chapter Human-Narrated MP3)
  if (source.adapterType === 'librivox') {
    if (!/^\d{1,8}$/.test(params.externalId)) {
      throw new Error('Mã sách nói LibriVox không hợp lệ.');
    }
    const detailUrl = new URL(source.baseUrl);
    detailUrl.searchParams.set('id', params.externalId);
    detailUrl.searchParams.set('format', 'json');
    detailUrl.searchParams.set('extended', '1');

    const detailRes = await safeExternalFetch(detailUrl.toString(), {
      timeoutMs: 11_000,
      maxBytes: 1_800_000,
      accept: 'application/json',
      allowedHostSuffixes: ['librivox.org'],
    });
    const payload = JSON.parse(detailRes.text) as { books?: LibriVoxBook[] };
    const book = payload.books?.[0];
    if (!book?.title) {
      throw new Error('Không đọc được thông tin sách nói từ LibriVox.');
    }

    const cleanDesc = stripHtmlToParagraphs(book.description || '');
    const genreText = (book.genres ?? []).map((g) => g.name || '').join(' ');
    const category = inferCategoryFromText(
      `${book.title} ${genreText} ${cleanDesc}`,
      source.categories
    );
    const locale = mapLibriVoxLanguageToLocale(book.language);
    const authorName =
      (book.authors ?? [])
        .map((a) => [a.first_name, a.last_name].filter(Boolean).join(' ').trim())
        .filter(Boolean)
        .join(', ') || 'LibriVox Classic';
    const coverAssetRef =
      extractArchiveCoverFromUrl(book.url_iarchive) ||
      CATEGORY_FALLBACK_ART[category] ||
      'img-story-sunny-farm';

    const sections = Array.isArray(book.sections) ? book.sections.slice(0, 40) : [];
    const fallbackArt = CATEGORY_FALLBACK_ART[category] || 'img-story-sunny-farm';
    let totalDurationSec = Number(book.totaltimesecs) || 0;

    const segments: StorySegment[] = sections
      .map((sec, idx) => {
        const audioUrl = sanitizeExternalMediaUrl(sec.listen_url);
        const chapterTitle =
          stripHtmlToParagraphs(sec.title || '') || `Chapter ${idx + 1}`;
        const durationSec = Number(sec.playtime) || undefined;
        const readers = (sec.readers ?? [])
          .map((r) => r.display_name)
          .filter(Boolean)
          .join(', ');

        const introBody =
          idx === 0 && cleanDesc
            ? `${chapterTitle}\n\n${cleanDesc}`
            : `${book.title} — ${chapterTitle}${readers ? `\n\nNarrated by ${readers}.` : ''}\n\nPress Play on the Audiobook Player to listen to this full MP3 chapter with seek, speed, and sleep timer controls.`;

        return {
          id: `${storyId}-seg-${String(idx + 1).padStart(2, '0')}`,
          order: idx + 1,
          assetRef: idx === 0 ? coverAssetRef : fallbackArt,
          chapterTitle,
          durationSec,
          textByLocale: {
            [locale]: introBody,
          },
          explanationByLocale: {
            vi: readers
              ? `Chương ${idx + 1}/${sections.length} · Giọng đọc: ${readers}`
              : `Chương ${idx + 1}/${sections.length} · Sách nói MP3 bản đầy đủ`,
            en: readers
              ? `Chapter ${idx + 1} of ${sections.length} · Read by ${readers}`
              : `Chapter ${idx + 1} of ${sections.length} · Full MP3 audiobook chapter`,
          },
          ...(audioUrl ? { audioUrlByLocale: { [locale]: audioUrl } } : {}),
        };
      })
      .filter((s) => Boolean(s.audioUrlByLocale?.[locale] || s.textByLocale[locale]));

    if (segments.length === 0) {
      throw new Error('Sách nói này hiện chưa có tệp âm thanh chương khả dụng.');
    }
    if (!totalDurationSec) {
      totalDurationSec = segments.reduce((sum, s) => sum + (s.durationSec || 300), 0);
    }

    const story: StoryBook = {
      id: storyId,
      schemaVersion: 1,
      learningPackageId: '',
      ageBands: source.ageBands.length > 0 ? source.ageBands : ['6-8', '9-11', '12-14'],
      coverAssetRef,
      availableLocales: [locale],
      availableExplanationLocales: ['vi', 'en'],
      titles: {
        [locale]: book.title.trim().slice(0, 140),
        vi: book.title.trim().slice(0, 140),
      },
      summaries: {
        [locale]: (cleanDesc || `Full audiobook by ${authorName}.`).slice(0, 260),
        vi: `${(cleanDesc || `Sách nói đầy đủ của tác giả ${authorName}.`).slice(0, 220)} (${segments.length} chương MP3)`,
      },
      segments,
      storyFormat: 'audiobook',
      chapterCount: segments.length,
      totalDurationSec,
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

  // 1C. Vietnamese Wikisource — full long-form Vietnamese folktale / classic reading
  if (source.adapterType === 'wikisource') {
    if (!/^\d{1,10}$/.test(params.externalId)) {
      throw new Error('Mã trang Wikisource không hợp lệ.');
    }
    const parseUrl = new URL(source.baseUrl);
    parseUrl.searchParams.set('action', 'parse');
    parseUrl.searchParams.set('pageid', params.externalId);
    parseUrl.searchParams.set('prop', 'text|displaytitle');
    parseUrl.searchParams.set('format', 'json');

    const parseRes = await safeExternalFetch(parseUrl.toString(), {
      timeoutMs: 11_000,
      maxBytes: 2_000_000,
      accept: 'application/json',
      allowedHostSuffixes: ['wikisource.org'],
    });
    const payload = JSON.parse(parseRes.text) as {
      parse?: { title?: string; text?: { '*'?: string } };
    };
    const rawHtml = payload.parse?.text?.['*'] || '';
    const title = stripHtmlToParagraphs(payload.parse?.title || '').slice(0, 140);
    if (!title || !rawHtml) {
      throw new Error('Không đọc được toàn văn truyện từ Wikisource.');
    }

    const cleanText = cleanWikisourceHtml(rawHtml);
    if (cleanText.length < 80) {
      throw new Error('Trang này chưa có đủ nội dung truyện để đọc dài.');
    }

    const category = inferCategoryFromText(`${title} ${cleanText.slice(0, 500)}`, source.categories);
    const coverAssetRef = CATEGORY_FALLBACK_ART[category] || 'img-story-sunny-farm';
    const segments = splitPlainTextToSegments({
      storyId,
      text: cleanText,
      locale: 'vi',
      coverAssetRef,
      category,
      maxPages: 30,
      targetChars: 1050,
      chapterPrefix: 'Phần',
    });

    const summarySnippet = cleanText.replace(/\s+/g, ' ').slice(0, 230);
    const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
    const totalDurationSec = Math.max(240, Math.round((wordCount / 145) * 60));

    const story: StoryBook = {
      id: storyId,
      schemaVersion: 1,
      learningPackageId: '',
      ageBands: source.ageBands.length > 0 ? source.ageBands : ['6-8', '9-11', '12-14', '15-18'],
      coverAssetRef,
      availableLocales: ['vi'],
      availableExplanationLocales: ['vi', 'en'],
      titles: {
        vi: title,
        en: title,
      },
      summaries: {
        vi: `${summarySnippet}...`,
        en: `${summarySnippet}...`,
      },
      segments,
      storyFormat: 'long_story',
      chapterCount: segments.length,
      totalDurationSec,
      category,
      sourceId: source.id,
      sourceName: source.name.vi,
      externalId: params.externalId,
      author: 'Kho Văn Học & Cổ Tích Mở (vi.wikisource.org)',
      status: 'published',
      publishedVersion: 1,
      archivedAt: null,
      updatedAt: new Date().toISOString(),
    };

    const saved = await upsertCmsStory(story);
    return { story: saved, alreadyExisted: false };
  }

  // 1D. Internet Archive Children's Audiobooks (MP3)
  if (source.adapterType === 'archive_org') {
    if (!/^[a-zA-Z0-9._-]{2,100}$/.test(params.externalId)) {
      throw new Error('Mã sách nói Internet Archive không hợp lệ.');
    }
    const metaUrl = `https://archive.org/metadata/${encodeURIComponent(params.externalId)}`;
    const metaRes = await safeExternalFetch(metaUrl, {
      timeoutMs: 11_000,
      maxBytes: 2_000_000,
      accept: 'application/json',
      allowedHostSuffixes: ['archive.org'],
    });
    const meta = JSON.parse(metaRes.text) as {
      metadata?: {
        title?: string | string[];
        creator?: string | string[];
        description?: string | string[];
      };
      files?: Array<{
        name?: string;
        format?: string;
        title?: string;
        track?: string;
        length?: string;
      }>;
    };

    const title = firstString(meta.metadata?.title).trim().slice(0, 140) || params.externalId;
    const authorName =
      firstString(meta.metadata?.creator).trim().slice(0, 100) ||
      'LibriVox / Internet Archive';
    const cleanDesc = stripHtmlToParagraphs(firstString(meta.metadata?.description));
    const category = inferCategoryFromText(`${title} ${cleanDesc}`, source.categories);
    const coverAssetRef =
      sanitizeExternalMediaUrl(`https://archive.org/services/img/${params.externalId}`) ||
      CATEGORY_FALLBACK_ART[category] ||
      'img-story-sunny-farm';
    const fallbackArt = CATEGORY_FALLBACK_ART[category] || 'img-story-sunny-farm';

    const allFiles = Array.isArray(meta.files) ? meta.files : [];
    const prefer64 = allFiles.filter(
      (f) => f.name && /_64kb\.mp3$/i.test(f.name)
    );
    const prefer128 = allFiles.filter(
      (f) => f.name && /_128kb\.mp3$/i.test(f.name)
    );
    const fallbackMp3 = allFiles.filter(
      (f) => f.name && /\.mp3$/i.test(f.name) && !/_64kb\.mp3$/i.test(f.name)
    );
    const chosenTracks = (
      prefer64.length > 0
        ? prefer64
        : prefer128.length > 0
          ? prefer128
          : fallbackMp3
    )
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .slice(0, 40);

    if (chosenTracks.length === 0) {
      throw new Error('Không tìm thấy tệp chương MP3 trong đầu sách này.');
    }

    const locale = source.defaultLocale || 'en';
    const segments: StorySegment[] = chosenTracks.map((track, idx) => {
      const encodedName = (track.name || '')
        .split('/')
        .map((part) => encodeURIComponent(part))
        .join('/');
      const mp3Url = sanitizeExternalMediaUrl(
        `https://archive.org/download/${encodeURIComponent(params.externalId)}/${encodedName}`
      );
      const chapterTitle =
        (track.title && track.title.trim()) || `Chapter ${idx + 1}`;
      const lenStr = track.length || '';
      let durationSec: number | undefined;
      if (lenStr.includes(':')) {
        const parts = lenStr.split(':').map((n) => Number(n));
        if (parts.length === 2 && parts.every(Number.isFinite)) {
          durationSec = parts[0] * 60 + parts[1];
        } else if (parts.length === 3 && parts.every(Number.isFinite)) {
          durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
      } else if (Number.isFinite(Number(lenStr)) && Number(lenStr) > 0) {
        durationSec = Math.round(Number(lenStr));
      }

      const bodyText =
        idx === 0 && cleanDesc
          ? `${chapterTitle}\n\n${cleanDesc}`
          : `${title} — ${chapterTitle}\n\nPress Play on the Audiobook Player to listen to this full MP3 chapter.`;

      return {
        id: `${storyId}-seg-${String(idx + 1).padStart(2, '0')}`,
        order: idx + 1,
        assetRef: idx === 0 ? coverAssetRef : fallbackArt,
        chapterTitle,
        durationSec,
        textByLocale: { [locale]: bodyText },
        explanationByLocale: {
          vi: `Chương ${idx + 1}/${chosenTracks.length} · Sách nói MP3 (Internet Archive)`,
          en: `Chapter ${idx + 1} of ${chosenTracks.length} · Full MP3 Audiobook`,
        },
        ...(mp3Url ? { audioUrlByLocale: { [locale]: mp3Url } } : {}),
      };
    });

    const totalDurationSec = segments.reduce(
      (sum, s) => sum + (s.durationSec || 300),
      0
    );

    const story: StoryBook = {
      id: storyId,
      schemaVersion: 1,
      learningPackageId: '',
      ageBands: source.ageBands.length > 0 ? source.ageBands : ['3-5', '6-8', '9-11', '12-14'],
      coverAssetRef,
      availableLocales: [locale],
      availableExplanationLocales: ['vi', 'en'],
      titles: {
        [locale]: title,
        vi: title,
      },
      summaries: {
        [locale]: (cleanDesc || `Full audiobook by ${authorName}.`).slice(0, 260),
        vi: `${(cleanDesc || `Sách nói đầy đủ của ${authorName}.`).slice(0, 220)} (${segments.length} chương MP3)`,
      },
      segments,
      storyFormat: 'audiobook',
      chapterCount: segments.length,
      totalDurationSec,
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

  // 2. Gutendex (Project Gutenberg) — fetch metadata & plain text securely
  if (source.adapterType === 'gutendex') {
    if (!/^\d{1,8}$/.test(params.externalId)) {
      throw new Error('Mã truyện không hợp lệ.');
    }
    const base = source.baseUrl.replace(/\/+$/, '');
    const detailUrl = `${base}/${params.externalId}`;
    const detailRes = await safeExternalFetch(detailUrl, {
      timeoutMs: 12_000,
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
          timeoutMs: 14_000,
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
      maxPages: 35,
      targetChars: 1050,
    });

    const isKids = /children|juvenile|fairy|fable|nursery/i.test(subjectsJoined);
    const story: StoryBook = {
      id: storyId,
      schemaVersion: 1,
      learningPackageId: '',
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
      storyFormat: 'long_story',
      chapterCount: segments.length,
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

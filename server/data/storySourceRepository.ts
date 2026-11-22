import type {
  DeleteMode,
  StoryCategoryKey,
  StorySourceConfig,
} from '../../packages/contracts/types';
import { getMongoCollection } from '../db/mongo';

export const STORY_CATEGORIES: Array<{
  key: StoryCategoryKey;
  labelVi: string;
  labelEn: string;
  gutendexTopic: string;
}> = [
  {
    key: 'fables',
    labelVi: 'Cổ tích & Ngụ ngôn',
    labelEn: 'Fables & Fairy Tales',
    gutendexTopic: 'fairy tales',
  },
  {
    key: 'animals',
    labelVi: 'Động vật & Thiên nhiên',
    labelEn: 'Animals & Nature',
    gutendexTopic: 'animals',
  },
  {
    key: 'bedtime',
    labelVi: 'Truyện trước giờ ngủ',
    labelEn: 'Bedtime Stories',
    gutendexTopic: 'children',
  },
  {
    key: 'adventure',
    labelVi: 'Phiêu lưu & Khám phá',
    labelEn: 'Adventure',
    gutendexTopic: 'adventure',
  },
  {
    key: 'science',
    labelVi: 'Khoa học & Đời sống',
    labelEn: 'Science & Discovery',
    gutendexTopic: 'science',
  },
  {
    key: 'life-skills',
    labelVi: 'Kỹ năng & Nhân cách',
    labelEn: 'Life Skills & Kindness',
    gutendexTopic: 'juvenile fiction',
  },
  {
    key: 'classics',
    labelVi: 'Văn học Kinh điển',
    labelEn: 'Classic Literature',
    gutendexTopic: 'classics',
  },
];

export const DEFAULT_STORY_SOURCES: StorySourceConfig[] = [
  {
    id: 'src-curated-bilingual',
    name: {
      vi: 'Kho Sách Nói & Truyện Song Ngữ TM-Lingo',
      en: 'TM-Lingo Bilingual Audiobooks & Fables',
    },
    description: {
      vi: 'Tuyển chọn truyện dài nhiều chương (Tấm Cám, Thạch Sanh, Nhật ký Dế đồng xanh, Alice...) và truyện tranh song ngữ Việt – Anh phát tức thì, hỗ trợ nghe ngoại tuyến.',
      en: 'Curated multi-chapter Vietnamese & English audiobooks plus bilingual picture fables ready for instant and offline listening.',
    },
    adapterType: 'curated_library',
    baseUrl: 'internal://curated-bilingual',
    categories: [
      'fables',
      'animals',
      'bedtime',
      'adventure',
      'science',
      'life-skills',
      'classics',
    ],
    ageBands: ['3-5', '6-8', '9-11', '12-14', '15-18'],
    defaultLocale: 'vi',
    supportedLocales: ['vi', 'en'],
    enabled: true,
    sortOrder: 1,
    isSystem: true,
    lastTestStatus: 'ok',
    lastTestMessage: 'Sẵn sàng 14 sách nói nhiều chương & truyện song ngữ.',
    lastItemCount: 14,
  },
  {
    id: 'src-librivox-audiobooks',
    name: {
      vi: 'Thư Viện Sách Nói Quốc Tế LibriVox (MP3 Nhiều Chương)',
      en: 'LibriVox Public Domain Audiobooks (Multi-Chapter MP3)',
    },
    description: {
      vi: 'Sách nói tiếng Anh miễn phí do người thật thu âm với đầy đủ từng chương MP3 (The Secret Garden, Alice in Wonderland, Peter Pan, truyện cổ Andersen, Grimm...).',
      en: 'Free human-narrated multi-chapter MP3 audiobooks from LibriVox: classic fairy tales, children’s novels, and bedtime literature.',
    },
    adapterType: 'librivox',
    baseUrl: 'https://librivox.org/api/feed/audiobooks/',
    categories: ['fables', 'animals', 'bedtime', 'adventure', 'science', 'classics'],
    ageBands: ['6-8', '9-11', '12-14', '15-18'],
    defaultLocale: 'en',
    supportedLocales: ['en', 'fr', 'de', 'es'],
    enabled: true,
    sortOrder: 2,
    isSystem: true,
    lastTestStatus: 'ok',
    lastTestMessage: 'Kết nối ổn định · hỗ trợ nghe trực tiếp từng chương MP3.',
  },
  {
    id: 'src-wikisource-vi',
    name: {
      vi: 'Kho Truyện Dài & Cổ Tích Việt Nam (Wikisource)',
      en: 'Vietnamese Folklore & Classic Literature (Wikisource)',
    },
    description: {
      vi: 'Kho truyện cổ tích, sự tích dân gian và truyện ngắn văn học Tiếng Việt kinh điển từ dự án mở vi.wikisource.org — tự động chia chương đọc dài và nghe sách nói.',
      en: 'Open Vietnamese folktales, legends, and classic short stories from Vietnamese Wikisource formatted for long-form reading & audio narration.',
    },
    adapterType: 'wikisource',
    baseUrl: 'https://vi.wikisource.org/w/api.php',
    categories: ['fables', 'classics', 'adventure', 'bedtime', 'life-skills'],
    ageBands: ['6-8', '9-11', '12-14', '15-18'],
    defaultLocale: 'vi',
    supportedLocales: ['vi'],
    enabled: true,
    sortOrder: 3,
    isSystem: true,
    lastTestStatus: 'ok',
    lastTestMessage: 'Kết nối nhanh · hàng trăm truyện cổ tích & văn học Tiếng Việt.',
  },
  {
    id: 'src-archive-audiobooks',
    name: {
      vi: 'Kho Sách Nói Thiếu Nhi Internet Archive (MP3)',
      en: 'Internet Archive Children’s Audiobooks (MP3)',
    },
    description: {
      vi: 'Kho lưu trữ sách nói thiếu nhi & cổ tích thế giới (Andersen, Grimm, Pinocchio, Aesop...) kèm ảnh bìa và bản thu âm nhiều chương miễn phí.',
      en: 'Public-domain children’s and fairy-tale audiobooks hosted on Internet Archive with full chapter audio streams.',
    },
    adapterType: 'archive_org',
    baseUrl: 'https://archive.org/advancedsearch.php',
    categories: ['fables', 'bedtime', 'adventure', 'animals', 'classics'],
    ageBands: ['3-5', '6-8', '9-11', '12-14'],
    defaultLocale: 'en',
    supportedLocales: ['en'],
    enabled: true,
    sortOrder: 4,
    isSystem: true,
    lastTestStatus: 'ok',
    lastTestMessage: 'Kết nối ổn định · kho sách nói thiếu nhi & cổ tích thế giới.',
  },
];

// Legacy default sources whose upstream public feeds became permanently unavailable/broken
const DEPRECATED_BROKEN_SOURCE_URLS: Record<string, string> = {
  'src-storynory-rss': 'https://www.storynory.com/feed/',
  'src-storyberries-rss': 'https://www.storyberries.com/feed/',
  'src-gutendex-classics': 'https://gutendex.com/books',
};

const memorySources = new Map<string, StorySourceConfig>();
let mongoSeeded = false;

function initMemory(): void {
  if (memorySources.size === 0) {
    const now = new Date().toISOString();
    for (const src of DEFAULT_STORY_SOURCES) {
      memorySources.set(src.id, {
        ...src,
        archivedAt: null,
        updatedAt: now,
      });
    }
  }
}

async function ensureSourcesSeeded(): Promise<void> {
  initMemory();
  if (mongoSeeded) return;
  mongoSeeded = true;

  const col = await getMongoCollection<StorySourceConfig>('story_sources');
  if (!col) return;

  const now = new Date().toISOString();

  // Auto-disable known broken legacy system sources so users no longer hit 500/HTML/timeout errors
  for (const [legacyId, brokenUrl] of Object.entries(DEPRECATED_BROKEN_SOURCE_URLS)) {
    await col.updateOne(
      { id: legacyId, baseUrl: brokenUrl, isSystem: true },
      {
        $set: {
          enabled: false,
          archivedAt: now,
          lastTestStatus: 'error',
          lastTestMessage:
            'Nguồn cũ phía đối tác đã ngừng/lỗi (đã thay thế bằng nguồn LibriVox, Wikisource Tiếng Việt & Internet Archive ổn định hơn).',
          updatedAt: now,
        },
      }
    );
  }

  for (const src of DEFAULT_STORY_SOURCES) {
    await col.updateOne(
      { id: src.id },
      {
        $setOnInsert: {
          ...src,
          archivedAt: null,
          updatedAt: now,
        },
      },
      { upsert: true }
    );
  }

  // Refresh description & item count on curated source if still using older copy
  await col.updateOne(
    { id: 'src-curated-bilingual', isSystem: true },
    {
      $set: {
        name: DEFAULT_STORY_SOURCES[0].name,
        description: DEFAULT_STORY_SOURCES[0].description,
        defaultLocale: 'vi',
        supportedLocales: ['vi', 'en'],
        lastItemCount: 14,
        lastTestMessage: DEFAULT_STORY_SOURCES[0].lastTestMessage,
        updatedAt: now,
      },
    }
  );
}

function sortSources(items: StorySourceConfig[]): StorySourceConfig[] {
  return [...items].sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
}

export async function listStorySources(options?: {
  enabledOnly?: boolean;
  includeArchived?: boolean;
}): Promise<StorySourceConfig[]> {
  await ensureSourcesSeeded();
  const col = await getMongoCollection<StorySourceConfig>('story_sources');
  let items: StorySourceConfig[];

  if (col) {
    const filter: Record<string, unknown> = options?.includeArchived
      ? {}
      : { $or: [{ archivedAt: null }, { archivedAt: { $exists: false } }] };
    items = await col.find(filter, { projection: { _id: 0 } }).toArray();
  } else {
    items = Array.from(memorySources.values()).filter((s) =>
      options?.includeArchived ? true : !s.archivedAt
    );
  }

  if (options?.enabledOnly) {
    items = items.filter((s) => s.enabled && !s.archivedAt);
  }

  return sortSources(items);
}

export async function getStorySourceById(
  id: string
): Promise<StorySourceConfig | null> {
  await ensureSourcesSeeded();
  const col = await getMongoCollection<StorySourceConfig>('story_sources');
  if (col) {
    return col.findOne({ id }, { projection: { _id: 0 } });
  }
  return memorySources.get(id) ?? null;
}

export async function upsertStorySource(
  source: StorySourceConfig
): Promise<StorySourceConfig> {
  await ensureSourcesSeeded();
  const normalized: StorySourceConfig = {
    ...source,
    updatedAt: new Date().toISOString(),
  };
  memorySources.set(normalized.id, normalized);

  const col = await getMongoCollection<StorySourceConfig>('story_sources');
  if (col) {
    await col.updateOne(
      { id: normalized.id },
      { $set: normalized },
      { upsert: true }
    );
  }
  return normalized;
}

export async function recordStorySourceTestResult(
  id: string,
  result: {
    status: 'ok' | 'error';
    message: string;
    itemCount?: number | null;
  }
): Promise<StorySourceConfig | null> {
  const existing = await getStorySourceById(id);
  if (!existing) return null;
  return upsertStorySource({
    ...existing,
    lastTestedAt: new Date().toISOString(),
    lastTestStatus: result.status,
    lastTestMessage: result.message,
    lastItemCount: result.itemCount ?? existing.lastItemCount ?? null,
  });
}

export async function deleteStorySource(
  id: string,
  mode: DeleteMode = 'soft'
): Promise<{ ok: boolean; mode: DeleteMode; source?: StorySourceConfig }> {
  await ensureSourcesSeeded();
  const existing = await getStorySourceById(id);
  if (!existing) {
    return { ok: false, mode };
  }

  if (mode === 'hard') {
    const localDeleted = memorySources.delete(id);
    const col = await getMongoCollection<StorySourceConfig>('story_sources');
    if (col) {
      const res = await col.deleteOne({ id });
      return { ok: res.deletedCount > 0 || localDeleted, mode: 'hard' };
    }
    return { ok: localDeleted, mode: 'hard' };
  }

  const archived = await upsertStorySource({
    ...existing,
    enabled: false,
    archivedAt: new Date().toISOString(),
  });
  return { ok: true, mode: 'soft', source: archived };
}

export async function restoreStorySource(
  id: string
): Promise<StorySourceConfig | null> {
  const existing = await getStorySourceById(id);
  if (!existing) return null;
  return upsertStorySource({
    ...existing,
    enabled: true,
    archivedAt: null,
  });
}

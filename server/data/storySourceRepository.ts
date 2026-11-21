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
      vi: 'Kho Truyện Cổ Tích & Song Ngữ TM-Lingo',
      en: 'TM-Lingo Bilingual Folklore & Fables',
    },
    description: {
      vi: 'Tuyển chọn truyện cổ tích Việt Nam, ngụ ngôn kinh điển, truyện ngủ ngon và bài đọc khoa học song ngữ Việt – Anh cho Mầm non đến Lớp 12.',
      en: 'Curated bilingual Vietnamese–English fables, bedtime tales, and youth STEM readings from Preschool through Grade 12.',
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
    defaultLocale: 'en',
    supportedLocales: ['en', 'vi'],
    enabled: true,
    sortOrder: 1,
    isSystem: true,
    lastTestStatus: 'ok',
    lastTestMessage: 'Sẵn sàng 10 truyện song ngữ đầy đủ nhiều trang.',
    lastItemCount: 10,
  },
  {
    id: 'src-gutendex-classics',
    name: {
      vi: 'Thư viện Truyện Kinh Điển Quốc Tế (Project Gutenberg)',
      en: 'Global Classic Stories Library (Project Gutenberg)',
    },
    description: {
      vi: 'Kho sách và truyện kể thiếu nhi, cổ tích và văn học kinh điển mở miễn phí toàn cầu — hỗ trợ tìm kiếm trực tiếp và tải toàn văn chia trang tự động.',
      en: 'Free public-domain children’s stories, fairy tales, and classic literature with live search and automatic multi-page download.',
    },
    adapterType: 'gutendex',
    baseUrl: 'https://gutendex.com/books',
    categories: ['fables', 'animals', 'bedtime', 'adventure', 'science', 'classics'],
    ageBands: ['6-8', '9-11', '12-14', '15-18'],
    defaultLocale: 'en',
    supportedLocales: ['en', 'fr', 'de', 'es'],
    enabled: true,
    sortOrder: 2,
    isSystem: true,
  },
  {
    id: 'src-storynory-rss',
    name: {
      vi: 'Kênh Kể Chuyện Audio Storynory',
      en: 'Storynory Audio Stories Feed',
    },
    description: {
      vi: 'Nguồn truyện kể thiếu nhi tiếng Anh kèm bản thu âm giọng đọc diễn cảm (cổ tích, thần thoại, truyện ngủ ngon).',
      en: 'Classic fairy tales, myths, and gentle audio bedtime stories via open storytelling feed.',
    },
    adapterType: 'rss',
    baseUrl: 'https://www.storynory.com/feed/',
    categories: ['fables', 'bedtime', 'adventure', 'animals'],
    ageBands: ['3-5', '6-8', '9-11'],
    defaultLocale: 'en',
    supportedLocales: ['en'],
    enabled: true,
    sortOrder: 3,
    isSystem: true,
  },
  {
    id: 'src-storyberries-rss',
    name: {
      vi: 'Kho Truyện Thiếu Nhi Storyberries',
      en: 'Storyberries Children’s Stories Feed',
    },
    description: {
      vi: 'Truyện ngắn thiếu nhi theo chủ đề lòng tốt, thiên nhiên và giờ đi ngủ dành cho trẻ nhỏ và tiểu học.',
      en: 'Illustrated children’s short stories organized by bedtime, kindness, animals, and fairy tales.',
    },
    adapterType: 'rss',
    baseUrl: 'https://www.storyberries.com/feed/',
    categories: ['bedtime', 'fables', 'animals', 'life-skills'],
    ageBands: ['3-5', '6-8', '9-11'],
    defaultLocale: 'en',
    supportedLocales: ['en'],
    enabled: true,
    sortOrder: 4,
    isSystem: true,
  },
];

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

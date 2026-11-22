import type {
  ActivityAnswerResponse,
  CmsLearningPackage,
  DeleteMode,
  ExperienceMode,
  GenerationJobRecord,
  LearningPackageSummary,
  PublicationSnapshotRecord,
  PublicationWorkflowStatus,
  PublicActivity,
  ResolvedLessonPayload,
  StoryBook,
} from '../../packages/contracts/types';
import { getMongoCollection } from '../db/mongo';
import {
  EXPERIENCE_PRESETS,
  LEARNING_PACKAGES,
  STORIES,
  VOCABULARY_CONCEPTS,
} from './seedStore';
import {
  buildStoryBookFromCurated,
  CURATED_BILINGUAL_STORIES,
} from './curatedStoriesCatalog';

const memoryPackages: Map<string, CmsLearningPackage> = new Map();
const memoryStories: Map<string, StoryBook> = new Map();
const memorySnapshots: PublicationSnapshotRecord[] = [];
const memoryJobs: GenerationJobRecord[] = [];

let seedSynced = false;

function buildSeedPackage(): CmsLearningPackage {
  const base = LEARNING_PACKAGES[0];
  const now = new Date().toISOString();
  return {
    ...base,
    concepts: ['fruit.apple', 'fruit.banana', 'fruit.orange'].map(
      (id) => VOCABULARY_CONCEPTS[id]
    ),
    status: 'published',
    publishedVersion: 1,
    publishedSnapshotId: 'snap-pkg-fruits-v1',
    createdAt: now,
    updatedAt: now,
  };
}

function buildSeedFarmPackage(): CmsLearningPackage {
  const now = new Date().toISOString();
  return {
    id: 'lp-farm-a1',
    schemaVersion: 1,
    topicId: 'topic.farm-friends',
    ageBand: ['3-5'],
    learningLevel: 'starter',
    learningLocales: ['en'],
    explanationLocales: ['vi', 'en'],
    availableExperienceModes: [
      'guided',
      'flashcards',
      'listening',
      'game',
      'explore',
      'story',
    ],
    titles: {
      en: 'Farm Friends',
      vi: 'Bạn nhỏ Nông trại',
    },
    summaries: {
      en: 'Meet the friendly cat, puppy, and little yellow duck through playful sounds and pictures.',
      vi: 'Làm quen với bạn mèo, chú cún và vịt con vàng qua âm thanh vui nhộn và hình vẽ.',
    },
    conceptCount: 3,
    concepts: [
      {
        conceptId: 'farm.cat',
        schemaVersion: 1,
        assetRef: 'img-cat',
        localizations: {
          en: {
            term: 'cat',
            example: 'The little cat says meow.',
            explanation: 'A soft, furry kitten that loves naps.',
            pronunciationGuide: 'KAT',
          },
          vi: {
            term: 'con mèo',
            example: 'Bạn mèo nhỏ kêu meo meo.',
            explanation: 'Chú mèo lông mềm, rất thích cuộn tròn ngủ trưa.',
          },
        },
      },
      {
        conceptId: 'farm.dog',
        schemaVersion: 1,
        assetRef: 'img-dog',
        localizations: {
          en: {
            term: 'dog',
            example: 'The happy dog wags its tail.',
            explanation: 'A friendly puppy that loves to play.',
            pronunciationGuide: 'DAWG',
          },
          vi: {
            term: 'con chó',
            example: 'Chú cún vui vẻ vẫy chiếc đuôi nhỏ.',
            explanation: 'Chú cún thân thiện rất thích chạy chơi trên cỏ.',
          },
        },
      },
      {
        conceptId: 'farm.duck',
        schemaVersion: 1,
        assetRef: 'img-duck',
        localizations: {
          en: {
            term: 'duck',
            example: 'The yellow duck swims in the pond.',
            explanation: 'A cheerful duckling that says quack.',
            pronunciationGuide: 'DUHK',
          },
          vi: {
            term: 'con vịt',
            example: 'Chú vịt vàng bơi tung tăng dưới ao.',
            explanation: 'Bạn vịt con lông vàng kêu cạp cạp.',
          },
        },
      },
    ],
    status: 'published',
    publishedVersion: 1,
    publishedSnapshotId: 'snap-pkg-farm-v1',
    createdAt: now,
    updatedAt: now,
  };
}

function buildSeedStory(): StoryBook {
  return {
    ...STORIES[0],
    status: 'published',
    publishedVersion: 1,
    updatedAt: new Date().toISOString(),
  };
}

function buildSeedFarmStory(): StoryBook {
  return {
    id: 'story-sunny-farm',
    schemaVersion: 1,
    learningPackageId: 'lp-farm-a1',
    ageBands: ['3-5'],
    coverAssetRef: 'img-story-sunny-farm',
    availableLocales: ['en', 'vi'],
    availableExplanationLocales: ['vi', 'en'],
    titles: {
      en: 'A Sunny Day at the Farm',
      vi: 'Ngày Nắng Ở Nông Trại',
    },
    summaries: {
      en: 'Say hello to the orange kitten, golden puppy, and yellow duckling on a calm sunny morning.',
      vi: 'Cùng chào buổi sáng bạn mèo cam, cún vàng và vịt con bên khu vườn đầy nắng.',
    },
    status: 'published',
    publishedVersion: 1,
    updatedAt: new Date().toISOString(),
    segments: [
      {
        id: 'farm-seg-01',
        order: 1,
        assetRef: 'img-story-sunny-farm',
        textByLocale: {
          en: 'Good morning, sunny farm! Our animal friends are awake.',
          vi: 'Chào buổi sáng nông trại đầy nắng! Các bạn nhỏ đã thức dậy rồi.',
        },
        explanationByLocale: {
          vi: 'Cảnh buổi sáng yên bình ở nông trại để bé làm quen không gian.',
          en: 'A gentle morning greeting on the green meadow.',
        },
      },
      {
        id: 'farm-seg-02',
        order: 2,
        assetRef: 'img-cat',
        conceptRef: 'farm.cat',
        textByLocale: {
          en: 'Look by the warm porch. Here is a soft orange cat. Meow!',
          vi: 'Nhìn bên hiên nhà ấm áp kìa. Có một bạn mèo cam mềm mại. Meo meo!',
        },
        explanationByLocale: {
          vi: 'Từ khóa: "cat" nghĩa là con mèo. Bé thử kêu "meow" cùng bạn mèo nhé.',
          en: 'Key word: "cat" — soft and cozy in the morning sun.',
        },
      },
      {
        id: 'farm-seg-03',
        order: 3,
        assetRef: 'img-dog',
        conceptRef: 'farm.dog',
        textByLocale: {
          en: 'Running on the green grass is a happy dog. Woof, woof!',
          vi: 'Chạy lon ton trên bãi cỏ xanh là chú cún vui vẻ. Gâu gâu!',
        },
        explanationByLocale: {
          vi: 'Từ khóa: "dog" nghĩa là con chó. Chú cún đang vẫy đuôi chào bé.',
          en: 'Key word: "dog" — wagging its tail happily.',
        },
      },
      {
        id: 'farm-seg-04',
        order: 4,
        assetRef: 'img-duck',
        conceptRef: 'farm.duck',
        textByLocale: {
          en: 'Splash! A little yellow duck waves by the pond. Quack, quack!',
          vi: 'Tõm! Chú vịt vàng nhỏ vẫy cánh bên ao nước trong. Cạp cạp!',
        },
        explanationByLocale: {
          vi: 'Từ khóa: "duck" nghĩa là con vịt con màu vàng.',
          en: 'Key word: "duck" — playful by the little pond.',
        },
      },
    ],
  };
}

function buildSeedK12Packages(): CmsLearningPackage[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'lp-primary-6-8',
      schemaVersion: 1,
      topicId: 'topic.school-day',
      ageBand: ['6-8'],
      learningLevel: 'foundation',
      learningLocales: ['en'],
      explanationLocales: ['vi', 'en'],
      availableExperienceModes: [
        'guided',
        'flashcards',
        'listening',
        'game',
        'explore',
        'story',
      ],
      titles: {
        en: 'My School & Daily Habits',
        vi: 'Trường Học & Thói Quen Hằng Ngày',
      },
      summaries: {
        en: 'Build phonics confidence and everyday classroom sentences for Grades 1–3.',
        vi: 'Luyện phát âm chuẩn và mẫu câu giao tiếp ngắn hằng ngày dành cho Lớp 1–3.',
      },
      conceptCount: 3,
      concepts: [
        {
          conceptId: 'school.notebook',
          schemaVersion: 1,
          assetRef: 'img-story-fruit-market',
          localizations: {
            en: {
              term: 'notebook',
              example: 'I write new words in my clean notebook.',
              explanation: 'A book of lined pages used for class notes and exercises.',
              pronunciationGuide: 'NOHT-buk',
            },
            vi: {
              term: 'quyển vở',
              example: 'Em viết từ mới vào quyển vở sạch đẹp.',
              explanation: 'Cuốn vở ghi chép bài học và luyện viết ở lớp.',
            },
          },
        },
        {
          conceptId: 'school.library',
          schemaVersion: 1,
          assetRef: 'img-story-sunny-farm',
          localizations: {
            en: {
              term: 'library',
              example: 'We read picture books quietly in the library.',
              explanation: 'A calm room filled with books to borrow and read.',
              pronunciationGuide: 'LY-brer-ee',
            },
            vi: {
              term: 'thư viện',
              example: 'Chúng em đọc sách yên tĩnh trong thư viện.',
              explanation: 'Không gian đọc sách và mượn truyện tại trường.',
            },
          },
        },
        {
          conceptId: 'school.classmate',
          schemaVersion: 1,
          assetRef: 'img-dog',
          localizations: {
            en: {
              term: 'classmate',
              example: 'My classmate shares colored pencils with me.',
              explanation: 'A friend who learns in the same classroom.',
              pronunciationGuide: 'KLAS-mayt',
            },
            vi: {
              term: 'bạn cùng lớp',
              example: 'Bạn cùng lớp chia sẻ bút màu với em.',
              explanation: 'Người bạn học chung lớp mỗi ngày.',
            },
          },
        },
      ],
      status: 'published',
      publishedVersion: 1,
      publishedSnapshotId: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lp-science-9-11',
      schemaVersion: 1,
      topicId: 'topic.nature-science',
      ageBand: ['9-11'],
      learningLevel: 'elementary',
      learningLocales: ['en'],
      explanationLocales: ['vi', 'en'],
      availableExperienceModes: [
        'guided',
        'flashcards',
        'listening',
        'game',
        'explore',
        'story',
      ],
      titles: {
        en: 'Nature & Water Cycle',
        vi: 'Thiên Nhiên & Vòng Tuần Hoàn Nước',
      },
      summaries: {
        en: 'Explore thematic science vocabulary and clear sentence fluency for Grades 4–5.',
        vi: 'Mở rộng vốn từ khoa học tự nhiên và luyện đọc hiểu đoạn ngắn dành cho Lớp 4–5.',
      },
      conceptCount: 3,
      concepts: [
        {
          conceptId: 'science.ecosystem',
          schemaVersion: 1,
          assetRef: 'img-story-sunny-farm',
          localizations: {
            en: {
              term: 'ecosystem',
              example: 'Plants, animals, and water form a balanced ecosystem.',
              explanation: 'A living community where organisms and their environment interact.',
              pronunciationGuide: 'EE-koh-sis-tuhm',
            },
            vi: {
              term: 'hệ sinh thái',
              example: 'Cây xanh, động vật và nguồn nước tạo nên hệ sinh thái cân bằng.',
              explanation: 'Môi trường sống nơi sinh vật và thiên nhiên gắn kết với nhau.',
            },
          },
        },
        {
          conceptId: 'science.rainbow',
          schemaVersion: 1,
          assetRef: 'img-duck',
          localizations: {
            en: {
              term: 'evaporation',
              example: 'Warm sunlight drives evaporation from ponds and rivers.',
              explanation: 'The process where liquid water turns into invisible vapor.',
              pronunciationGuide: 'ih-vap-uh-RAY-shuhn',
            },
            vi: {
              term: 'sự bay hơi',
              example: 'Ánh nắng ấm tạo ra sự bay hơi từ ao hồ và sông suối.',
              explanation: 'Quá trình nước lỏng chuyển thành hơi nước bay lên cao.',
            },
          },
        },
        {
          conceptId: 'science.habitat',
          schemaVersion: 1,
          assetRef: 'img-cat',
          localizations: {
            en: {
              term: 'habitat',
              example: 'Clean wetlands provide a safe habitat for water birds.',
              explanation: 'The natural home where a plant or animal lives.',
              pronunciationGuide: 'HAB-ih-tat',
            },
            vi: {
              term: 'môi trường sống',
              example: 'Vùng đất ngập nước sạch là môi trường sống an toàn cho chim nước.',
              explanation: 'Nơi sinh sống tự nhiên phù hợp với từng loài động thực vật.',
            },
          },
        },
      ],
      status: 'published',
      publishedVersion: 1,
      publishedSnapshotId: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lp-communication-12-14',
      schemaVersion: 1,
      topicId: 'topic.global-citizen',
      ageBand: ['12-14'],
      learningLevel: 'intermediate',
      learningLocales: ['en'],
      explanationLocales: ['vi', 'en'],
      availableExperienceModes: [
        'guided',
        'flashcards',
        'listening',
        'explore',
        'game',
        'story',
      ],
      titles: {
        en: 'Applied Communication & Culture',
        vi: 'Giao Tiếp Ứng Dụng & Văn Hóa',
      },
      summaries: {
        en: 'Natural conversation expressions and contextual vocabulary for Middle School (Grades 6–9).',
        vi: 'Luyện diễn đạt tự nhiên, từ vựng ngữ cảnh và đọc hiểu song ngữ cho THCS (Lớp 6–9).',
      },
      conceptCount: 3,
      concepts: [
        {
          conceptId: 'comm.perspective',
          schemaVersion: 1,
          assetRef: 'img-story-fruit-market',
          localizations: {
            en: {
              term: 'perspective',
              example: 'Listening carefully helps us understand another perspective.',
              explanation: 'A particular way of viewing or thinking about a topic.',
              pronunciationGuide: 'per-SPEK-tiv',
            },
            vi: {
              term: 'góc nhìn / quan điểm',
              example: 'Lắng nghe kỹ giúp ta hiểu thêm một góc nhìn khác.',
              explanation: 'Cách tiếp cận hoặc suy nghĩ về một sự việc hay vấn đề.',
            },
          },
        },
        {
          conceptId: 'comm.collaborate',
          schemaVersion: 1,
          assetRef: 'img-story-sunny-farm',
          localizations: {
            en: {
              term: 'collaborate',
              example: 'Students collaborate to design a community garden.',
              explanation: 'To work jointly with others toward a shared goal.',
              pronunciationGuide: 'kuh-LAB-uh-rayt',
            },
            vi: {
              term: 'hợp tác cùng nhau',
              example: 'Học sinh hợp tác để thiết kế một khu vườn cộng đồng.',
              explanation: 'Cùng phối hợp làm việc với nhau vì mục tiêu chung.',
            },
          },
        },
        {
          conceptId: 'comm.sustainable',
          schemaVersion: 1,
          assetRef: 'img-orange',
          localizations: {
            en: {
              term: 'sustainable',
              example: 'Cycling to school is a sustainable daily choice.',
              explanation: 'Able to be maintained without harming natural resources.',
              pronunciationGuide: 'suh-STAY-nuh-buhl',
            },
            vi: {
              term: 'bền vững',
              example: 'Đạp xe đi học là một lựa chọn hằng ngày bền vững.',
              explanation: 'Duy trì lâu dài và thân thiện với môi trường tự nhiên.',
            },
          },
        },
      ],
      status: 'published',
      publishedVersion: 1,
      publishedSnapshotId: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lp-academic-15-18',
      schemaVersion: 1,
      topicId: 'topic.academic-english',
      ageBand: ['15-18'],
      learningLevel: 'upper_intermediate',
      learningLocales: ['en'],
      explanationLocales: ['vi', 'en'],
      availableExperienceModes: [
        'flashcards',
        'listening',
        'explore',
        'guided',
        'story',
      ],
      titles: {
        en: 'Academic Precision & Critical Inquiry',
        vi: 'Tiếng Anh Học Thuật & Tư Duy Phản Biện',
      },
      summaries: {
        en: 'High-utility academic lexis and analytical expression for High School (Grades 10–12).',
        vi: 'Hệ thống từ vựng học thuật, diễn đạt chuẩn xác chuẩn bị cho kỳ thi THPT và chứng chỉ quốc tế.',
      },
      conceptCount: 3,
      concepts: [
        {
          conceptId: 'acad.hypothesis',
          schemaVersion: 1,
          assetRef: 'img-apple',
          localizations: {
            en: {
              term: 'hypothesis',
              example: 'Researchers test a clear hypothesis through controlled experiments.',
              explanation: 'A proposed explanation formulated as a starting point for investigation.',
              pronunciationGuide: 'hy-POTH-uh-sis',
            },
            vi: {
              term: 'giả thuyết khoa học',
              example: 'Nhà nghiên cứu kiểm chứng một giả thuyết rõ ràng qua thực nghiệm.',
              explanation: 'Nhận định bước đầu được đặt ra để kiểm chứng bằng dữ liệu.',
            },
          },
        },
        {
          conceptId: 'acad.synthesize',
          schemaVersion: 1,
          assetRef: 'img-orange',
          localizations: {
            en: {
              term: 'synthesize',
              example: 'Strong essays synthesize evidence from multiple credible sources.',
              explanation: 'To combine distinct ideas or findings into a coherent whole.',
              pronunciationGuide: 'SIN-thuh-syz',
            },
            vi: {
              term: 'tổng hợp phân tích',
              example: 'Bài luận thuyết phục biết tổng hợp dẫn chứng từ nhiều nguồn tin cậy.',
              explanation: 'Kết nối nhiều luận điểm và thông tin thành một hệ thống chặt chẽ.',
            },
          },
        },
        {
          conceptId: 'acad.nuance',
          schemaVersion: 1,
          assetRef: 'img-banana',
          localizations: {
            en: {
              term: 'nuance',
              example: 'Bilingual reading sharpens sensitivity to cultural nuance.',
              explanation: 'A subtle distinction in meaning, tone, or expression.',
              pronunciationGuide: 'NOO-ahns',
            },
            vi: {
              term: 'sắc thái tinh tế',
              example: 'Đọc song ngữ giúp rèn sự nhạy bén với sắc thái văn hóa.',
              explanation: 'Sự khác biệt nhỏ nhưng giàu ý nghĩa về ngữ điệu hoặc ngữ nghĩa.',
            },
          },
        },
      ],
      status: 'published',
      publishedVersion: 1,
      publishedSnapshotId: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export async function ensureCmsSeeded(): Promise<void> {
  const starterPackages = [
    buildSeedPackage(),
    buildSeedFarmPackage(),
    ...buildSeedK12Packages(),
  ];
  const starterLongAudiobooks = ['tam-cam-long-audiobook', 'alice-wonderland-long']
    .map((extId) => CURATED_BILINGUAL_STORIES.find((s) => s.externalId === extId))
    .filter((bp): bp is NonNullable<typeof bp> => Boolean(bp))
    .map((bp) =>
      buildStoryBookFromCurated(
        bp,
        'src-curated-bilingual',
        'Kho Sách Nói & Truyện Song Ngữ TM-Lingo'
      )
    );

  const starterStories = [
    ...starterLongAudiobooks,
    buildSeedStory(),
    buildSeedFarmStory(),
  ];

  for (const pkg of starterPackages) {
    if (!memoryPackages.has(pkg.id)) {
      memoryPackages.set(pkg.id, pkg);
    }
  }
  for (const story of starterStories) {
    if (!memoryStories.has(story.id)) {
      memoryStories.set(story.id, story);
    }
  }

  const starterSnapshots: PublicationSnapshotRecord[] = [
    {
      snapshotId: 'snap-pkg-fruits-v1',
      entityType: 'package',
      entityId: 'lp-fruits-a1',
      version: 1,
      publishedBy: 'TM-Lingo Seed',
      publishedAt: starterPackages[0].updatedAt,
      payload: starterPackages[0],
    },
    {
      snapshotId: 'snap-pkg-farm-v1',
      entityType: 'package',
      entityId: 'lp-farm-a1',
      version: 1,
      publishedBy: 'TM-Lingo Seed',
      publishedAt: starterPackages[1].updatedAt,
      payload: starterPackages[1],
    },
    {
      snapshotId: 'snap-story-fruit-market-v1',
      entityType: 'story',
      entityId: 'story-fruit-market',
      version: 1,
      publishedBy: 'TM-Lingo Seed',
      publishedAt: starterStories[0].updatedAt || new Date().toISOString(),
      payload: starterStories[0],
    },
    {
      snapshotId: 'snap-story-sunny-farm-v1',
      entityType: 'story',
      entityId: 'story-sunny-farm',
      version: 1,
      publishedBy: 'TM-Lingo Seed',
      publishedAt: starterStories[1].updatedAt || new Date().toISOString(),
      payload: starterStories[1],
    },
  ];

  for (const snap of starterSnapshots) {
    if (!memorySnapshots.some((s) => s.snapshotId === snap.snapshotId)) {
      memorySnapshots.push(snap);
    }
  }

  if (seedSynced) return;
  seedSynced = true;

  const pkgCol = await getMongoCollection<CmsLearningPackage>('learning_packages');
  if (pkgCol) {
    for (const pkg of starterPackages) {
      const exists = await pkgCol.findOne({ id: pkg.id }, { projection: { _id: 1 } });
      if (!exists) {
        await pkgCol.insertOne(pkg);
      }
    }
  }

  const storyCol = await getMongoCollection<StoryBook>('stories');
  if (storyCol) {
    for (const story of starterStories) {
      const exists = await storyCol.findOne({ id: story.id }, { projection: { _id: 1 } });
      if (!exists) {
        await storyCol.insertOne(story);
      }
    }
  }

  const snapCol = await getMongoCollection<PublicationSnapshotRecord>(
    'publication_snapshots'
  );
  if (snapCol) {
    for (const snap of starterSnapshots) {
      const exists = await snapCol.findOne(
        { snapshotId: snap.snapshotId },
        { projection: { _id: 1 } }
      );
      if (!exists) {
        await snapCol.insertOne(snap);
      }
    }
  }
}

export async function listCmsPackages(options?: {
  publishedOnly?: boolean;
  includeArchived?: boolean;
}): Promise<CmsLearningPackage[]> {
  await ensureCmsSeeded();
  const col = await getMongoCollection<CmsLearningPackage>('learning_packages');
  const includeArchived = Boolean(options?.includeArchived);

  if (col) {
    const filter: Record<string, unknown> = options?.publishedOnly
      ? {
          status: 'published',
          $or: [{ archivedAt: null }, { archivedAt: { $exists: false } }],
        }
      : includeArchived
        ? {}
        : {
            status: { $ne: 'archived' },
            $or: [{ archivedAt: null }, { archivedAt: { $exists: false } }],
          };
    return col
      .find(filter, { projection: { _id: 0 } })
      .sort({ updatedAt: -1 })
      .toArray();
  }

  const items = Array.from(memoryPackages.values());
  if (options?.publishedOnly) {
    return items.filter((p) => p.status === 'published' && !p.archivedAt);
  }
  return includeArchived
    ? items
    : items.filter((p) => !p.archivedAt && p.status !== 'archived');
}

export async function listPublishedPackageSummaries(): Promise<
  LearningPackageSummary[]
> {
  const packages = await listCmsPackages({ publishedOnly: true });
  return packages.map(({ concepts: _concepts, ...summary }) => summary);
}

export async function getCmsPackageById(
  packageId: string
): Promise<CmsLearningPackage | null> {
  await ensureCmsSeeded();
  const col = await getMongoCollection<CmsLearningPackage>('learning_packages');
  if (col) {
    return col.findOne({ id: packageId }, { projection: { _id: 0 } });
  }
  return memoryPackages.get(packageId) ?? null;
}

export async function upsertCmsPackage(
  pkg: CmsLearningPackage
): Promise<CmsLearningPackage> {
  await ensureCmsSeeded();
  const now = new Date().toISOString();
  const normalized: CmsLearningPackage = {
    ...pkg,
    conceptCount: pkg.concepts.length,
    updatedAt: now,
    createdAt: pkg.createdAt || now,
  };

  memoryPackages.set(normalized.id, normalized);
  const col = await getMongoCollection<CmsLearningPackage>('learning_packages');
  if (col) {
    await col.updateOne(
      { id: normalized.id },
      { $set: normalized },
      { upsert: true }
    );
  }
  return normalized;
}

export async function transitionPackageStatus(input: {
  packageId: string;
  status: PublicationWorkflowStatus;
  actor: string;
}): Promise<{
  pkg: CmsLearningPackage;
  snapshot?: PublicationSnapshotRecord;
} | null> {
  const existing = await getCmsPackageById(input.packageId);
  if (!existing) return null;

  const now = new Date().toISOString();
  let snapshot: PublicationSnapshotRecord | undefined;
  let nextVersion = existing.publishedVersion ?? 0;
  let publishedSnapshotId = existing.publishedSnapshotId ?? null;

  if (input.status === 'published') {
    nextVersion += 1;
    publishedSnapshotId = `snap-pkg-${existing.id}-v${nextVersion}`;
    snapshot = {
      snapshotId: publishedSnapshotId,
      entityType: 'package',
      entityId: existing.id,
      version: nextVersion,
      publishedBy: input.actor,
      publishedAt: now,
      payload: {
        ...existing,
        status: 'published',
        publishedVersion: nextVersion,
        publishedSnapshotId,
        updatedAt: now,
      },
    };
    memorySnapshots.unshift(snapshot);
    const snapCol = await getMongoCollection<PublicationSnapshotRecord>(
      'publication_snapshots'
    );
    if (snapCol) {
      await snapCol.insertOne({ ...snapshot });
    }
  }

  const updated = await upsertCmsPackage({
    ...existing,
    status: input.status,
    publishedVersion: nextVersion || existing.publishedVersion,
    publishedSnapshotId,
    updatedAt: now,
  });

  return { pkg: updated, snapshot };
}

export async function deleteCmsPackage(
  packageId: string,
  mode: DeleteMode = 'soft'
): Promise<{ ok: boolean; mode: DeleteMode; pkg?: CmsLearningPackage }> {
  if (packageId === 'lp-fruits-a1' && mode === 'hard') {
    throw new Error(
      'Starter package lp-fruits-a1 cannot be permanently deleted.'
    );
  }
  const existing = await getCmsPackageById(packageId);
  if (!existing) return { ok: false, mode };

  const col = await getMongoCollection<CmsLearningPackage>('learning_packages');

  if (mode === 'hard') {
    const localDeleted = memoryPackages.delete(packageId);
    if (col) {
      const res = await col.deleteOne({ id: packageId });
      return { ok: res.deletedCount > 0 || localDeleted, mode: 'hard' };
    }
    return { ok: localDeleted, mode: 'hard' };
  }

  const now = new Date().toISOString();
  const archived = await upsertCmsPackage({
    ...existing,
    status: 'archived',
    archivedAt: now,
    updatedAt: now,
  });
  return { ok: true, mode: 'soft', pkg: archived };
}

export async function restoreCmsPackage(
  packageId: string
): Promise<CmsLearningPackage | null> {
  const existing = await getCmsPackageById(packageId);
  if (!existing) return null;
  const now = new Date().toISOString();
  return upsertCmsPackage({
    ...existing,
    status: 'draft',
    archivedAt: null,
    updatedAt: now,
  });
}

// ---------- Stories CMS ----------

export async function listCmsStories(options?: {
  publishedOnly?: boolean;
  includeArchived?: boolean;
}): Promise<StoryBook[]> {
  await ensureCmsSeeded();
  const col = await getMongoCollection<StoryBook>('stories');
  const includeArchived = Boolean(options?.includeArchived);

  if (col) {
    const filter: Record<string, unknown> = options?.publishedOnly
      ? {
          status: 'published',
          $or: [{ archivedAt: null }, { archivedAt: { $exists: false } }],
        }
      : includeArchived
        ? {}
        : {
            status: { $ne: 'archived' },
            $or: [{ archivedAt: null }, { archivedAt: { $exists: false } }],
          };
    return col
      .find(filter, { projection: { _id: 0 } })
      .sort({ updatedAt: -1 })
      .toArray();
  }
  const items = Array.from(memoryStories.values());
  if (options?.publishedOnly) {
    return items.filter((s) => s.status === 'published' && !s.archivedAt);
  }
  return includeArchived
    ? items
    : items.filter((s) => !s.archivedAt && s.status !== 'archived');
}

export async function getCmsStoryById(storyId: string): Promise<StoryBook | null> {
  await ensureCmsSeeded();
  const col = await getMongoCollection<StoryBook>('stories');
  if (col) {
    return col.findOne({ id: storyId }, { projection: { _id: 0 } });
  }
  return memoryStories.get(storyId) ?? null;
}

export async function upsertCmsStory(story: StoryBook): Promise<StoryBook> {
  await ensureCmsSeeded();
  const normalized: StoryBook = {
    ...story,
    updatedAt: new Date().toISOString(),
  };
  memoryStories.set(normalized.id, normalized);
  const col = await getMongoCollection<StoryBook>('stories');
  if (col) {
    await col.updateOne(
      { id: normalized.id },
      { $set: normalized },
      { upsert: true }
    );
  }
  return normalized;
}

export async function transitionStoryStatus(input: {
  storyId: string;
  status: PublicationWorkflowStatus;
  actor: string;
}): Promise<{ story: StoryBook; snapshot?: PublicationSnapshotRecord } | null> {
  const existing = await getCmsStoryById(input.storyId);
  if (!existing) return null;

  const now = new Date().toISOString();
  let snapshot: PublicationSnapshotRecord | undefined;
  let nextVersion = existing.publishedVersion ?? 0;

  if (input.status === 'published') {
    nextVersion += 1;
    snapshot = {
      snapshotId: `snap-story-${existing.id}-v${nextVersion}`,
      entityType: 'story',
      entityId: existing.id,
      version: nextVersion,
      publishedBy: input.actor,
      publishedAt: now,
      payload: {
        ...existing,
        status: 'published',
        publishedVersion: nextVersion,
        updatedAt: now,
      },
    };
    memorySnapshots.unshift(snapshot);
    const snapCol = await getMongoCollection<PublicationSnapshotRecord>(
      'publication_snapshots'
    );
    if (snapCol) {
      await snapCol.insertOne({ ...snapshot });
    }
  }

  const updated = await upsertCmsStory({
    ...existing,
    status: input.status,
    publishedVersion: nextVersion || existing.publishedVersion,
    updatedAt: now,
  });

  return { story: updated, snapshot };
}

export async function deleteCmsStory(
  storyId: string,
  mode: DeleteMode = 'soft'
): Promise<{ ok: boolean; mode: DeleteMode; story?: StoryBook }> {
  if (storyId === 'story-fruit-market' && mode === 'hard') {
    throw new Error(
      'Starter story story-fruit-market cannot be permanently deleted.'
    );
  }
  const existing = await getCmsStoryById(storyId);
  if (!existing) return { ok: false, mode };

  const col = await getMongoCollection<StoryBook>('stories');

  if (mode === 'hard') {
    const localDeleted = memoryStories.delete(storyId);
    if (col) {
      const res = await col.deleteOne({ id: storyId });
      return { ok: res.deletedCount > 0 || localDeleted, mode: 'hard' };
    }
    return { ok: localDeleted, mode: 'hard' };
  }

  const now = new Date().toISOString();
  const archived = await upsertCmsStory({
    ...existing,
    status: 'archived',
    archivedAt: now,
    updatedAt: now,
  });
  return { ok: true, mode: 'soft', story: archived };
}

export async function restoreCmsStory(
  storyId: string
): Promise<StoryBook | null> {
  const existing = await getCmsStoryById(storyId);
  if (!existing) return null;
  const now = new Date().toISOString();
  return upsertCmsStory({
    ...existing,
    status: 'draft',
    archivedAt: null,
    updatedAt: now,
  });
}

// ---------- Publication Snapshot History & Immutable Rollback ----------

export async function listPublicationSnapshots(params?: {
  entityType?: 'package' | 'story';
  entityId?: string;
  limit?: number;
}): Promise<PublicationSnapshotRecord[]> {
  await ensureCmsSeeded();
  const limit = Math.min(50, Math.max(1, params?.limit ?? 20));
  const col = await getMongoCollection<PublicationSnapshotRecord>(
    'publication_snapshots'
  );
  if (col) {
    const filter: Record<string, unknown> = {};
    if (params?.entityType) filter.entityType = params.entityType;
    if (params?.entityId) filter.entityId = params.entityId;
    return col
      .find(filter, { projection: { _id: 0 } })
      .sort({ version: -1, publishedAt: -1 })
      .limit(limit)
      .toArray();
  }

  return memorySnapshots
    .filter((snap) => {
      if (params?.entityType && snap.entityType !== params.entityType) {
        return false;
      }
      if (params?.entityId && snap.entityId !== params.entityId) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.version - a.version)
    .slice(0, limit);
}

export async function rollbackPackageToSnapshot(input: {
  packageId: string;
  snapshotId: string;
  actor: string;
}): Promise<{
  pkg: CmsLearningPackage;
  snapshot: PublicationSnapshotRecord;
  restoredFromVersion: number;
} | null> {
  await ensureCmsSeeded();
  const existing = await getCmsPackageById(input.packageId);
  if (!existing) return null;

  const snapshots = await listPublicationSnapshots({
    entityType: 'package',
    entityId: input.packageId,
    limit: 50,
  });
  const target = snapshots.find((s) => s.snapshotId === input.snapshotId);
  if (!target || target.entityType !== 'package') return null;

  const snapPkg = target.payload as CmsLearningPackage;
  const now = new Date().toISOString();
  const nextVersion = Math.max(existing.publishedVersion ?? 0, target.version) + 1;
  const newSnapshotId = `snap-pkg-${existing.id}-v${nextVersion}`;

  const rolledBack: CmsLearningPackage = {
    ...existing,
    titles: { ...snapPkg.titles },
    summaries: { ...snapPkg.summaries },
    learningLocales: [...snapPkg.learningLocales],
    explanationLocales: [...snapPkg.explanationLocales],
    availableExperienceModes: [...snapPkg.availableExperienceModes],
    concepts: snapPkg.concepts.map((c) => ({
      ...c,
      localizations: Object.fromEntries(
        Object.entries(c.localizations).map(([k, v]) => [k, { ...v }])
      ),
    })),
    conceptCount: snapPkg.concepts.length,
    status: 'published',
    archivedAt: null,
    publishedVersion: nextVersion,
    publishedSnapshotId: newSnapshotId,
    updatedAt: now,
  };

  const newSnapshot: PublicationSnapshotRecord = {
    snapshotId: newSnapshotId,
    entityType: 'package',
    entityId: existing.id,
    version: nextVersion,
    publishedBy: `${input.actor} (rollback from v${target.version})`,
    publishedAt: now,
    payload: rolledBack,
  };

  memorySnapshots.unshift(newSnapshot);
  const snapCol = await getMongoCollection<PublicationSnapshotRecord>(
    'publication_snapshots'
  );
  if (snapCol) {
    await snapCol.insertOne({ ...newSnapshot });
  }

  const saved = await upsertCmsPackage(rolledBack);
  return {
    pkg: saved,
    snapshot: newSnapshot,
    restoredFromVersion: target.version,
  };
}

export async function rollbackStoryToSnapshot(input: {
  storyId: string;
  snapshotId: string;
  actor: string;
}): Promise<{
  story: StoryBook;
  snapshot: PublicationSnapshotRecord;
  restoredFromVersion: number;
} | null> {
  await ensureCmsSeeded();
  const existing = await getCmsStoryById(input.storyId);
  if (!existing) return null;

  const snapshots = await listPublicationSnapshots({
    entityType: 'story',
    entityId: input.storyId,
    limit: 50,
  });
  const target = snapshots.find((s) => s.snapshotId === input.snapshotId);
  if (!target || target.entityType !== 'story') return null;

  const snapStory = target.payload as StoryBook;
  const now = new Date().toISOString();
  const nextVersion = Math.max(existing.publishedVersion ?? 0, target.version) + 1;
  const newSnapshotId = `snap-story-${existing.id}-v${nextVersion}`;

  const rolledBack: StoryBook = {
    ...existing,
    titles: { ...snapStory.titles },
    summaries: { ...snapStory.summaries },
    coverAssetRef: snapStory.coverAssetRef,
    availableLocales: [...snapStory.availableLocales],
    availableExplanationLocales: [...snapStory.availableExplanationLocales],
    segments: snapStory.segments.map((seg) => ({
      ...seg,
      textByLocale: { ...seg.textByLocale },
      explanationByLocale: { ...seg.explanationByLocale },
      audioUrlByLocale: seg.audioUrlByLocale
        ? { ...seg.audioUrlByLocale }
        : undefined,
    })),
    status: 'published',
    archivedAt: null,
    publishedVersion: nextVersion,
    updatedAt: now,
  };

  const newSnapshot: PublicationSnapshotRecord = {
    snapshotId: newSnapshotId,
    entityType: 'story',
    entityId: existing.id,
    version: nextVersion,
    publishedBy: `${input.actor} (rollback from v${target.version})`,
    publishedAt: now,
    payload: rolledBack,
  };

  memorySnapshots.unshift(newSnapshot);
  const snapCol = await getMongoCollection<PublicationSnapshotRecord>(
    'publication_snapshots'
  );
  if (snapCol) {
    await snapCol.insertOne({ ...newSnapshot });
  }

  const saved = await upsertCmsStory(rolledBack);
  return {
    story: saved,
    snapshot: newSnapshot,
    restoredFromVersion: target.version,
  };
}

// ---------- AI Generation Jobs ----------

export async function recordGenerationJob(
  job: GenerationJobRecord
): Promise<void> {
  memoryJobs.unshift(job);
  if (memoryJobs.length > 40) memoryJobs.length = 40;
  const col = await getMongoCollection<GenerationJobRecord>('generation_jobs');
  if (col) {
    await col.insertOne({ ...job });
  }
}

export async function listGenerationJobs(): Promise<GenerationJobRecord[]> {
  const col = await getMongoCollection<GenerationJobRecord>('generation_jobs');
  if (col) {
    return col
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
  }
  return memoryJobs.slice(0, 20);
}

// ---------- Dynamic Lesson Resolution & Server-Only Answer Evaluation ----------

const dynamicAnswerKeys = new Map<
  string,
  { conceptId: string; packageId: string }
>();

export async function resolveLessonFromCms(params: {
  lessonId: string;
  mode: ExperienceMode;
  learningLocale: string;
  explanationLocale: string;
}): Promise<ResolvedLessonPayload | null> {
  const published = await listCmsPackages({ publishedOnly: true });
  // Map legacy 'lesson-fruits-01' -> 'lp-fruits-a1', or resolve by exact package id
  const pkg =
    published.find((p) => p.id === params.lessonId) ??
    (params.lessonId === 'lesson-fruits-01'
      ? published.find((p) => p.id === 'lp-fruits-a1')
      : undefined) ??
    published[0];

  if (!pkg || pkg.concepts.length === 0) return null;

  const learnLocale = pkg.learningLocales.includes(params.learningLocale)
    ? params.learningLocale
    : pkg.learningLocales[0] || 'en';

  const explainLocale = pkg.explanationLocales.includes(params.explanationLocale)
    ? params.explanationLocale
    : pkg.explanationLocales[0] || 'vi';

  const concepts = pkg.concepts;
  const getLoc = (c: (typeof concepts)[number], loc: string) =>
    c.localizations[loc] ??
    c.localizations.en ??
    Object.values(c.localizations)[0];

  const allOptions = concepts.map((concept) => {
    const learnLoc = getLoc(concept, learnLocale);
    const explainLoc = getLoc(concept, explainLocale);
    return {
      id: concept.conceptId,
      conceptId: concept.conceptId,
      label: learnLoc.term,
      explanationLabel: explainLoc.term,
      assetRef: concept.assetRef,
    };
  });

  const activities: PublicActivity[] = [];

  if (params.mode === 'flashcards') {
    concepts.forEach((concept, idx) => {
      const learnLoc = getLoc(concept, learnLocale);
      const explainLoc = getLoc(concept, explainLocale);
      activities.push({
        id: `act-${pkg.id}-flashcard-${idx + 1}`,
        type: 'flashcard',
        schemaVersion: 1,
        conceptId: concept.conceptId,
        promptText: learnLoc.term,
        promptExplanation: `${explainLoc.term} — ${explainLoc.explanation}`,
        pronunciationGuide: learnLoc.pronunciationGuide,
        spokenText: `${learnLoc.term}. ${learnLoc.example}`,
        spokenLocale: learnLocale,
        spokenAudioUrl: learnLoc.audioUrl,
        options: [
          {
            id: concept.conceptId,
            conceptId: concept.conceptId,
            label: learnLoc.example,
            explanationLabel: explainLoc.example,
            assetRef: concept.assetRef,
          },
        ],
      });
    });
  } else if (params.mode === 'explore') {
    concepts.forEach((concept, idx) => {
      const learnLoc = getLoc(concept, learnLocale);
      const explainLoc = getLoc(concept, explainLocale);
      activities.push({
        id: `act-${pkg.id}-repeat-${idx + 1}`,
        type: 'repeat-after-me',
        schemaVersion: 1,
        conceptId: concept.conceptId,
        promptText: learnLoc.term,
        promptExplanation: `${explainLoc.term} — ${explainLoc.explanation}`,
        pronunciationGuide: learnLoc.pronunciationGuide,
        spokenText: `${learnLoc.term}. ${learnLoc.example}`,
        spokenLocale: learnLocale,
        spokenAudioUrl: learnLoc.audioUrl,
        options: [
          {
            id: concept.conceptId,
            conceptId: concept.conceptId,
            label: learnLoc.example,
            explanationLabel: explainLoc.example,
            assetRef: concept.assetRef,
          },
        ],
      });
    });
  } else if (params.mode === 'listening') {
    concepts.forEach((concept, idx) => {
      const learnLoc = getLoc(concept, learnLocale);
      const actId = `act-${pkg.id}-listen-${idx + 1}`;
      dynamicAnswerKeys.set(actId, {
        conceptId: concept.conceptId,
        packageId: pkg.id,
      });
      activities.push({
        id: actId,
        type: 'listen-and-select',
        schemaVersion: 1,
        promptText:
          learnLocale === 'en'
            ? 'Listen and tap the picture'
            : 'Nghe và chọn hình đúng',
        promptExplanation:
          explainLocale === 'vi'
            ? 'Bé nhấn nút nghe âm thanh, rồi chọn bức tranh đúng nhé.'
            : 'Tap listen, then choose the matching picture.',
        spokenText: learnLoc.term,
        spokenLocale: learnLocale,
        spokenAudioUrl: learnLoc.audioUrl,
        options: allOptions,
      });
    });
  } else if (params.mode === 'game') {
    activities.push({
      id: `act-${pkg.id}-match-all`,
      type: 'match-pair',
      schemaVersion: 1,
      promptText:
        learnLocale === 'en'
          ? 'Match each word to its picture'
          : 'Ghép từ với hình tương ứng',
      promptExplanation:
        explainLocale === 'vi'
          ? 'Bé chạm vào một từ, rồi chạm vào bức tranh tương ứng nhé.'
          : 'Tap a word, then tap its matching picture.',
      spokenText: concepts.map((c) => getLoc(c, learnLocale).term).join(', '),
      spokenLocale: learnLocale,
      options: allOptions,
      pairs: concepts.map((c) => ({
        id: c.conceptId,
        conceptId: c.conceptId,
        term: getLoc(c, learnLocale).term,
        assetRef: c.assetRef,
      })),
    });
  } else {
    // Guided mode blends flashcard intro, listen-and-select, picture-choice, and match-pair
    const first = concepts[0];
    const firstLearn = getLoc(first, learnLocale);
    const firstExplain = getLoc(first, explainLocale);
    activities.push({
      id: `act-${pkg.id}-guided-card-1`,
      type: 'flashcard',
      schemaVersion: 1,
      conceptId: first.conceptId,
      promptText: firstLearn.term,
      promptExplanation: `${firstExplain.term} — ${firstExplain.explanation}`,
      pronunciationGuide: firstLearn.pronunciationGuide,
      spokenText: `${firstLearn.term}. ${firstLearn.example}`,
      spokenLocale: learnLocale,
      spokenAudioUrl: firstLearn.audioUrl,
      options: [
        {
          id: first.conceptId,
          conceptId: first.conceptId,
          label: firstLearn.example,
          explanationLabel: firstExplain.example,
          assetRef: first.assetRef,
        },
      ],
    });

    concepts.forEach((concept, idx) => {
      const learnLoc = getLoc(concept, learnLocale);
      const explainLoc = getLoc(concept, explainLocale);
      const isPictureChoice = idx === 1;
      const actId = `act-${pkg.id}-guided-${isPictureChoice ? 'picture' : 'listen'}-${idx + 1}`;
      dynamicAnswerKeys.set(actId, {
        conceptId: concept.conceptId,
        packageId: pkg.id,
      });

      activities.push({
        id: actId,
        type: isPictureChoice ? 'picture-choice' : 'listen-and-select',
        schemaVersion: 1,
        promptText: isPictureChoice
          ? `Which one is "${learnLoc.term}"?`
          : 'Listen and find the right picture',
        promptExplanation: isPictureChoice
          ? explainLocale === 'vi'
            ? `Hình nào là "${learnLoc.term}" (${explainLoc.term})?`
            : `Tap the picture for "${learnLoc.term}".`
          : explainLocale === 'vi'
            ? 'Bé nghe thật kỹ rồi chạm vào hình đúng nhé.'
            : 'Listen carefully and tap the matching picture.',
        spokenText: learnLoc.term,
        spokenLocale: learnLocale,
        spokenAudioUrl: learnLoc.audioUrl,
        options: allOptions,
      });
    });

    activities.push({
      id: `act-${pkg.id}-guided-match-all`,
      type: 'match-pair',
      schemaVersion: 1,
      promptText: 'Match the words',
      promptExplanation:
        explainLocale === 'vi'
          ? `Ghép đủ ${concepts.length} từ với hình tương ứng để hoàn thành bài học!`
          : `Match all ${concepts.length} words with their pictures!`,
      spokenText: 'Let us match the words!',
      spokenLocale: learnLocale,
      options: allOptions,
      pairs: concepts.map((c) => ({
        id: c.conceptId,
        conceptId: c.conceptId,
        term: getLoc(c, learnLocale).term,
        assetRef: c.assetRef,
      })),
    });
  }

  const preset = EXPERIENCE_PRESETS[params.mode] ?? EXPERIENCE_PRESETS.guided;
  return {
    lessonId: pkg.id,
    learningPackageId: pkg.id,
    mode: params.mode,
    preset,
    learningLocale: learnLocale,
    explanationLocale: explainLocale,
    title: pkg.titles[learnLocale] ?? pkg.titles.en ?? Object.values(pkg.titles)[0] ?? pkg.id,
    explanationSummary:
      pkg.summaries[explainLocale] ??
      pkg.summaries.vi ??
      Object.values(pkg.summaries)[0] ??
      '',
    availableExperienceModes: pkg.availableExperienceModes,
    activities,
  };
}

export async function evaluateCmsActivity(input: {
  activityId: string;
  lessonId: string;
  selectedId?: string;
  matchedPairs?: Array<{ wordId: string; imageId: string }>;
  learningLocale: string;
  explanationLocale: string;
}): Promise<ActivityAnswerResponse> {
  if (input.matchedPairs && input.matchedPairs.length > 0) {
    const allCorrect =
      input.matchedPairs.length >= 2 &&
      input.matchedPairs.every((pair) => pair.wordId === pair.imageId);
    return {
      activityId: input.activityId,
      correct: allCorrect,
      encouragementKey: allCorrect ? 'completed' : 'try_again',
    };
  }

  const keyInfo = dynamicAnswerKeys.get(input.activityId);
  if (!keyInfo) {
    // Re-hydrate dynamic answer keys from package if server restarted between load and submit
    const pkg = await getCmsPackageById(
      input.lessonId === 'lesson-fruits-01' ? 'lp-fruits-a1' : input.lessonId
    );
    if (pkg) {
      await resolveLessonFromCms({
        lessonId: pkg.id,
        mode: 'guided',
        learningLocale: input.learningLocale,
        explanationLocale: input.explanationLocale,
      });
      await resolveLessonFromCms({
        lessonId: pkg.id,
        mode: 'listening',
        learningLocale: input.learningLocale,
        explanationLocale: input.explanationLocale,
      });
    }
  }

  const resolvedKey = dynamicAnswerKeys.get(input.activityId);
  if (!resolvedKey) {
    return {
      activityId: input.activityId,
      correct: true,
      encouragementKey: 'completed',
    };
  }

  const pkg = await getCmsPackageById(resolvedKey.packageId);
  const concept = pkg?.concepts.find(
    (c) => c.conceptId === resolvedKey.conceptId
  );
  const correct = input.selectedId === resolvedKey.conceptId;

  if (!concept) {
    return {
      activityId: input.activityId,
      correct,
      encouragementKey: correct ? 'great_job' : 'try_again',
    };
  }

  const learnLoc =
    concept.localizations[input.learningLocale] ??
    concept.localizations.en ??
    Object.values(concept.localizations)[0];
  const explainLoc =
    concept.localizations[input.explanationLocale] ??
    concept.localizations.vi ??
    Object.values(concept.localizations)[0];

  return {
    activityId: input.activityId,
    correct,
    encouragementKey: correct ? 'great_job' : 'try_again',
    revealedConcept: correct
      ? {
          term: learnLoc.term,
          example: learnLoc.example,
          explanation: `${explainLoc.term} — ${explainLoc.example}`,
        }
      : undefined,
  };
}

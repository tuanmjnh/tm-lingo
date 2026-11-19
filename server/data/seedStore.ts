import type {
  ExperienceMode,
  ExperiencePreset,
  LearnerProfile,
  LearningPackageSummary,
  LessonProgressRecord,
  LocaleConfig,
  PublicActivity,
  ResolvedLessonPayload,
  StoryBook,
  StoryReadingPosition,
  VocabularyConcept,
  VoiceProfile,
} from '../../packages/contracts/types.ts';
import { getMongoCollection } from '../db/mongo.ts';

export const LANGUAGE_REGISTRY: LocaleConfig[] = [
  {
    locale: 'vi',
    languageCode: 'vi',
    displayName: 'Vietnamese',
    nativeName: 'Tiếng Việt',
    direction: 'ltr',
    enabled: true,
    learningEnabled: false,
    explanationEnabled: true,
    uiEnabled: true,
    ttsEnabled: true,
    speechRecognitionEnabled: false,
    contentStatus: 'ready',
    fallbackLocale: null,
  },
  {
    locale: 'en',
    languageCode: 'en',
    displayName: 'English',
    nativeName: 'English',
    direction: 'ltr',
    enabled: true,
    learningEnabled: true,
    explanationEnabled: true,
    uiEnabled: true,
    ttsEnabled: true,
    speechRecognitionEnabled: false,
    contentStatus: 'ready',
    fallbackLocale: 'en',
  },
  {
    locale: 'ja',
    languageCode: 'ja',
    displayName: 'Japanese',
    nativeName: '日本語',
    direction: 'ltr',
    enabled: true,
    learningEnabled: false,
    explanationEnabled: false,
    uiEnabled: false,
    ttsEnabled: false,
    speechRecognitionEnabled: false,
    contentStatus: 'planned',
    fallbackLocale: null,
  },
];

export const VOICE_REGISTRY: VoiceProfile[] = [
  {
    voiceId: 'voice-en-warm',
    providerId: 'web-speech-adapter',
    supportedLocales: ['en', 'en-US', 'en-GB'],
    displayName: 'Clara (Warm Storyteller)',
    voiceStyleTags: ['warm', 'calm'],
    ageAppropriate: true,
    pitch: 1.05,
    defaultRate: 0.88,
  },
  {
    voiceId: 'voice-en-playful',
    providerId: 'web-speech-adapter',
    supportedLocales: ['en', 'en-US'],
    displayName: 'Leo (Playful Teacher)',
    voiceStyleTags: ['playful', 'teacher-like'],
    ageAppropriate: true,
    pitch: 1.12,
    defaultRate: 0.92,
  },
  {
    voiceId: 'voice-vi-calm',
    providerId: 'web-speech-adapter',
    supportedLocales: ['vi', 'vi-VN'],
    displayName: 'Mai (Giọng kể dịu nhẹ)',
    voiceStyleTags: ['warm', 'calm'],
    ageAppropriate: true,
    pitch: 1.02,
    defaultRate: 0.9,
  },
];

export const EXPERIENCE_PRESETS: Record<ExperienceMode, ExperiencePreset> = {
  guided: {
    id: 'preset-guided-playful',
    mode: 'guided',
    visualDensity: 'low',
    animationLevel: 'gentle',
    audioGuidance: true,
    showCaptions: true,
    allowReplay: true,
    reducedMotionCompatible: true,
    interactionPacing: 'child-led',
  },
  flashcards: {
    id: 'preset-flashcards-calm',
    mode: 'flashcards',
    visualDensity: 'low',
    animationLevel: 'gentle',
    audioGuidance: true,
    showCaptions: true,
    allowReplay: true,
    reducedMotionCompatible: true,
    interactionPacing: 'child-led',
  },
  listening: {
    id: 'preset-listening-focused',
    mode: 'listening',
    visualDensity: 'low',
    animationLevel: 'gentle',
    audioGuidance: true,
    showCaptions: false,
    allowReplay: true,
    reducedMotionCompatible: true,
    interactionPacing: 'child-led',
  },
  game: {
    id: 'preset-game-match',
    mode: 'game',
    visualDensity: 'medium',
    animationLevel: 'moderate',
    audioGuidance: true,
    showCaptions: true,
    allowReplay: true,
    reducedMotionCompatible: true,
    interactionPacing: 'child-led',
  },
  story: {
    id: 'preset-story-readaloud',
    mode: 'story',
    visualDensity: 'low',
    animationLevel: 'gentle',
    audioGuidance: true,
    showCaptions: true,
    allowReplay: true,
    reducedMotionCompatible: true,
    interactionPacing: 'child-led',
  },
  explore: {
    id: 'preset-explore-open',
    mode: 'explore',
    visualDensity: 'low',
    animationLevel: 'gentle',
    audioGuidance: true,
    showCaptions: true,
    allowReplay: true,
    reducedMotionCompatible: true,
    interactionPacing: 'child-led',
  },
};

export const VOCABULARY_CONCEPTS: Record<string, VocabularyConcept> = {
  'fruit.apple': {
    conceptId: 'fruit.apple',
    schemaVersion: 1,
    assetRef: 'img-apple',
    localizations: {
      en: {
        term: 'apple',
        example: 'I see a red apple.',
        explanation: 'A sweet, crunchy red fruit.',
        pronunciationGuide: 'AP-uhl',
      },
      vi: {
        term: 'quả táo',
        example: 'Con nhìn thấy một quả táo đỏ.',
        explanation: 'Quả táo màu đỏ, giòn và ngọt.',
      },
    },
  },
  'fruit.banana': {
    conceptId: 'fruit.banana',
    schemaVersion: 1,
    assetRef: 'img-banana',
    localizations: {
      en: {
        term: 'banana',
        example: 'This is a yellow banana.',
        explanation: 'A soft, sweet yellow fruit.',
        pronunciationGuide: 'buh-NAH-nuh',
      },
      vi: {
        term: 'quả chuối',
        example: 'Đây là quả chuối màu vàng.',
        explanation: 'Quả chuối màu vàng, mềm và thơm.',
      },
    },
  },
  'fruit.orange': {
    conceptId: 'fruit.orange',
    schemaVersion: 1,
    assetRef: 'img-orange',
    localizations: {
      en: {
        term: 'orange',
        example: 'Let us peel an orange.',
        explanation: 'A round, juicy orange fruit.',
        pronunciationGuide: 'OR-inj',
      },
      vi: {
        term: 'quả cam',
        example: 'Cùng bóc một quả cam nhé.',
        explanation: 'Quả cam tròn, mọng nước và giàu vitamin.',
      },
    },
  },
};

export const LEARNING_PACKAGES: LearningPackageSummary[] = [
  {
    id: 'lp-fruits-a1',
    schemaVersion: 1,
    topicId: 'topic.fruits',
    ageBand: ['3-5'],
    learningLevel: 'starter',
    learningLocales: ['en'],
    explanationLocales: ['vi', 'en'],
    availableExperienceModes: ['guided', 'flashcards', 'listening', 'game', 'story'],
    titles: {
      en: 'Fruit Time',
      vi: 'Giờ khám phá Trái cây',
    },
    summaries: {
      en: 'Meet apple, banana, and orange through sound, pictures, matching, and story.',
      vi: 'Làm quen với quả táo, quả chuối và quả cam qua nghe từ, chọn hình, ghép cặp và kể chuyện.',
    },
    conceptCount: 3,
    status: 'published',
  },
];

export const STORIES: StoryBook[] = [
  {
    id: 'story-fruit-market',
    schemaVersion: 1,
    learningPackageId: 'lp-fruits-a1',
    ageBands: ['3-5'],
    coverAssetRef: 'img-story-fruit-market',
    availableLocales: ['en', 'vi'],
    availableExplanationLocales: ['vi', 'en'],
    titles: {
      en: 'At the Fruit Market',
      vi: 'Ở Khu Chợ Trái Cây',
    },
    summaries: {
      en: 'A sunny morning walk to choose fresh red apples, yellow bananas, and juicy oranges.',
      vi: 'Chuyến dạo chợ buổi sáng nắng ấm để chọn táo đỏ, chuối vàng và cam tươi.',
    },
    status: 'published',
    segments: [
      {
        id: 'seg-01',
        order: 1,
        assetRef: 'img-story-fruit-market',
        textByLocale: {
          en: 'Good morning! Today we visit the sunny fruit market.',
          vi: 'Chào buổi sáng! Hôm nay chúng mình cùng đi thăm khu chợ trái cây nắng ấm nhé.',
        },
        explanationByLocale: {
          vi: 'Chào buổi sáng! Hôm nay chúng mình đi thăm khu chợ trái cây đầy nắng.',
          en: 'A warm greeting as our market walk begins.',
        },
      },
      {
        id: 'seg-02',
        order: 2,
        assetRef: 'img-apple',
        conceptRef: 'fruit.apple',
        textByLocale: {
          en: 'Look in the wooden basket. I see a bright red apple!',
          vi: 'Nhìn vào giỏ gỗ kìa. Con thấy một quả táo đỏ tươi!',
        },
        explanationByLocale: {
          vi: 'Từ khóa: "apple" nghĩa là quả táo. Bé hãy nghe và nhắc lại nhé.',
          en: 'Key word: "apple" — look at its bright red color.',
        },
      },
      {
        id: 'seg-03',
        order: 3,
        assetRef: 'img-banana',
        conceptRef: 'fruit.banana',
        textByLocale: {
          en: 'Next to the basket is a sweet yellow banana.',
          vi: 'Bên cạnh chiếc giỏ là nải chuối vàng thơm ngọt.',
        },
        explanationByLocale: {
          vi: 'Từ khóa: "banana" nghĩa là quả chuối màu vàng.',
          en: 'Key word: "banana" — curved and sunny yellow.',
        },
      },
      {
        id: 'seg-04',
        order: 4,
        assetRef: 'img-orange',
        conceptRef: 'fruit.orange',
        textByLocale: {
          en: 'And here is a round orange. Thank you, fruit market!',
          vi: 'Và đây là quả cam tròn mọng nước. Cảm ơn khu chợ trái cây nhé!',
        },
        explanationByLocale: {
          vi: 'Từ khóa: "orange" nghĩa là quả cam tròn.',
          en: 'Key word: "orange" — round, bright, and sweet.',
        },
      },
    ],
  },
];

// Server-only answer keys: never returned in public lesson payloads.
const ANSWER_KEYS: Record<string, string> = {
  'act-guided-listen-apple': 'fruit.apple',
  'act-guided-picture-banana': 'fruit.banana',
  'act-guided-listen-orange': 'fruit.orange',
  'act-listen-apple': 'fruit.apple',
  'act-listen-banana': 'fruit.banana',
  'act-listen-orange': 'fruit.orange',
};

const DEFAULT_PARENT_ID = 'parent-demo-01';

function buildStarterLearner(parentAccountId: string): LearnerProfile {
  const now = new Date().toISOString();
  const suffix =
    parentAccountId === DEFAULT_PARENT_ID
      ? 'min'
      : parentAccountId.slice(0, 8);
  return {
    id: `learner-${suffix}`,
    schemaVersion: 1,
    parentAccountId,
    nickname: 'Bé Min',
    ageYears: 4,
    ageBand: '3-5',
    avatarTone: 'sky',
    preferences: {
      interfaceLocale: 'vi',
      learningLocale: 'en',
      explanationLocale: 'vi',
      narrationLocale: 'en',
      reducedMotion: false,
      dailyMinutesLimit: 15,
      audioSpeed: 0.9,
    },
    createdAt: now,
    updatedAt: now,
  };
}

interface StoredProgressDoc extends LessonProgressRecord {
  parentAccountId: string;
}

interface StoredStoryPositionDoc extends StoryReadingPosition {
  parentAccountId: string;
}

export class LingoRepository {
  private learners: Map<string, LearnerProfile> = new Map();
  private progress: Map<string, StoredProgressDoc> = new Map();
  private storyPositions: Map<string, StoredStoryPositionDoc> = new Map();

  constructor() {
    const starter = buildStarterLearner(DEFAULT_PARENT_ID);
    this.learners.set(starter.id, starter);
  }

  getLanguages(): LocaleConfig[] {
    return LANGUAGE_REGISTRY;
  }

  getVoices(locale?: string): VoiceProfile[] {
    if (!locale) return VOICE_REGISTRY;
    const normalized = locale.toLowerCase();
    return VOICE_REGISTRY.filter((voice) =>
      voice.supportedLocales.some(
        (supported) =>
          supported.toLowerCase() === normalized ||
          supported.toLowerCase().startsWith(`${normalized}-`) ||
          normalized.startsWith(`${supported.toLowerCase()}-`)
      )
    );
  }

  async listLearners(parentAccountId = DEFAULT_PARENT_ID): Promise<LearnerProfile[]> {
    const col = await getMongoCollection<LearnerProfile>('learners');
    if (col) {
      const existing = await col
        .find({ parentAccountId }, { projection: { _id: 0 } })
        .sort({ createdAt: 1 })
        .toArray();

      if (existing.length > 0) {
        return existing;
      }

      const starter = buildStarterLearner(parentAccountId);
      await col.updateOne(
        { id: starter.id },
        { $setOnInsert: starter },
        { upsert: true }
      );
      return [starter];
    }

    const local = Array.from(this.learners.values()).filter(
      (l) => l.parentAccountId === parentAccountId
    );
    if (local.length > 0) return local;

    const starter = buildStarterLearner(parentAccountId);
    this.learners.set(starter.id, starter);
    return [starter];
  }

  async createLearner(
    parentAccountId: string,
    input: {
      nickname: string;
      ageYears: number;
      avatarTone: LearnerProfile['avatarTone'];
      interfaceLocale: string;
      learningLocale: string;
      explanationLocale: string;
      narrationLocale: string;
    }
  ): Promise<LearnerProfile> {
    const now = new Date().toISOString();
    const id = `learner-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
    const profile: LearnerProfile = {
      id,
      schemaVersion: 1,
      parentAccountId,
      nickname: input.nickname.trim(),
      ageYears: input.ageYears,
      ageBand: '3-5',
      avatarTone: input.avatarTone,
      preferences: {
        interfaceLocale: input.interfaceLocale,
        learningLocale: input.learningLocale,
        explanationLocale: input.explanationLocale,
        narrationLocale: input.narrationLocale,
        reducedMotion: false,
        dailyMinutesLimit: 15,
        audioSpeed: 0.9,
      },
      createdAt: now,
      updatedAt: now,
    };

    this.learners.set(id, profile);
    const col = await getMongoCollection<LearnerProfile>('learners');
    if (col) {
      await col.insertOne({ ...profile });
    }
    return profile;
  }

  async updateLearnerPreferences(
    parentAccountId: string,
    learnerId: string,
    patch: Partial<LearnerProfile['preferences']>
  ): Promise<LearnerProfile | undefined> {
    const col = await getMongoCollection<LearnerProfile>('learners');
    if (col) {
      const existing = await col.findOne(
        { id: learnerId, parentAccountId },
        { projection: { _id: 0 } }
      );
      if (!existing) return undefined;

      const updated: LearnerProfile = {
        ...existing,
        preferences: {
          ...existing.preferences,
          ...patch,
        },
        updatedAt: new Date().toISOString(),
      };
      await col.updateOne(
        { id: learnerId, parentAccountId },
        { $set: { preferences: updated.preferences, updatedAt: updated.updatedAt } }
      );
      this.learners.set(learnerId, updated);
      return updated;
    }

    const existing = this.learners.get(learnerId);
    if (!existing || existing.parentAccountId !== parentAccountId) return undefined;
    const updated: LearnerProfile = {
      ...existing,
      preferences: {
        ...existing.preferences,
        ...patch,
      },
      updatedAt: new Date().toISOString(),
    };
    this.learners.set(learnerId, updated);
    return updated;
  }

  listPackages(): LearningPackageSummary[] {
    return LEARNING_PACKAGES;
  }

  resolveLesson(params: {
    lessonId: string;
    mode: ExperienceMode;
    learningLocale: string;
    explanationLocale: string;
  }): ResolvedLessonPayload | null {
    const pkg = LEARNING_PACKAGES[0];
    if (!pkg) return null;

    const learnLocale = pkg.learningLocales.includes(params.learningLocale)
      ? params.learningLocale
      : pkg.learningLocales[0];

    const explainLocale = pkg.explanationLocales.includes(params.explanationLocale)
      ? params.explanationLocale
      : pkg.explanationLocales[0];

    const concepts = ['fruit.apple', 'fruit.banana', 'fruit.orange'].map(
      (id) => VOCABULARY_CONCEPTS[id]
    );

    const buildOptions = () =>
      concepts.map((concept) => {
        const learnLoc = concept.localizations[learnLocale] ?? concept.localizations.en;
        const explainLoc = concept.localizations[explainLocale] ?? concept.localizations.vi;
        return {
          id: concept.conceptId,
          conceptId: concept.conceptId,
          label: learnLoc.term,
          explanationLabel: explainLoc.term,
          assetRef: concept.assetRef,
        };
      });

    const allOptions = buildOptions();
    const activities: PublicActivity[] = [];

    if (params.mode === 'flashcards') {
      concepts.forEach((concept, idx) => {
        const learnLoc = concept.localizations[learnLocale] ?? concept.localizations.en;
        const explainLoc = concept.localizations[explainLocale] ?? concept.localizations.vi;
        activities.push({
          id: `act-flashcard-${idx + 1}`,
          type: 'flashcard',
          schemaVersion: 1,
          conceptId: concept.conceptId,
          promptText: learnLoc.term,
          promptExplanation: `${explainLoc.term} — ${explainLoc.explanation}`,
          spokenText: `${learnLoc.term}. ${learnLoc.example}`,
          spokenLocale: learnLocale,
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
      const listeningTargets: Array<{ id: string; conceptId: string }> = [
        { id: 'act-listen-apple', conceptId: 'fruit.apple' },
        { id: 'act-listen-banana', conceptId: 'fruit.banana' },
        { id: 'act-listen-orange', conceptId: 'fruit.orange' },
      ];
      listeningTargets.forEach((target) => {
        const concept = VOCABULARY_CONCEPTS[target.conceptId];
        const learnLoc = concept.localizations[learnLocale] ?? concept.localizations.en;
        activities.push({
          id: target.id,
          type: 'listen-and-select',
          schemaVersion: 1,
          promptText: learnLocale === 'en' ? 'Listen and tap the fruit' : 'Nghe và chọn trái cây',
          promptExplanation:
            explainLocale === 'vi'
              ? 'Bé nhấn nút nghe âm thanh, rồi chọn hình trái cây đúng nhé.'
              : 'Tap listen, then choose the matching fruit picture.',
          spokenText: learnLoc.term,
          spokenLocale: learnLocale,
          options: allOptions,
        });
      });
    } else if (params.mode === 'game') {
      activities.push({
        id: 'act-match-fruits',
        type: 'match-pair',
        schemaVersion: 1,
        promptText:
          learnLocale === 'en' ? 'Match each word to its fruit' : 'Ghép từ với hình trái cây',
        promptExplanation:
          explainLocale === 'vi'
            ? 'Bé chạm vào một từ tiếng Anh, rồi chạm vào bức tranh trái cây tương ứng nhé.'
            : 'Tap a fruit word, then tap its matching picture.',
        spokenText: 'Match apple, banana, and orange.',
        spokenLocale: learnLocale,
        options: allOptions,
        pairs: concepts.map((c) => ({
          id: c.conceptId,
          conceptId: c.conceptId,
          term: (c.localizations[learnLocale] ?? c.localizations.en).term,
          assetRef: c.assetRef,
        })),
      });
    } else {
      // Default: 'guided' blends flashcard intro, listen-and-select, picture-choice, and match-pair
      const apple = VOCABULARY_CONCEPTS['fruit.apple'];
      const banana = VOCABULARY_CONCEPTS['fruit.banana'];
      const orange = VOCABULARY_CONCEPTS['fruit.orange'];

      activities.push(
        {
          id: 'act-guided-card-apple',
          type: 'flashcard',
          schemaVersion: 1,
          conceptId: apple.conceptId,
          promptText: apple.localizations[learnLocale].term,
          promptExplanation: `${apple.localizations[explainLocale].term} — ${apple.localizations[explainLocale].explanation}`,
          spokenText: `${apple.localizations[learnLocale].term}. ${apple.localizations[learnLocale].example}`,
          spokenLocale: learnLocale,
          options: [
            {
              id: apple.conceptId,
              conceptId: apple.conceptId,
              label: apple.localizations[learnLocale].example,
              explanationLabel: apple.localizations[explainLocale].example,
              assetRef: apple.assetRef,
            },
          ],
        },
        {
          id: 'act-guided-listen-apple',
          type: 'listen-and-select',
          schemaVersion: 1,
          promptText: 'Listen and find the fruit',
          promptExplanation:
            explainLocale === 'vi'
              ? 'Nghe từ tiếng Anh và chọn đúng hình trái cây nhé!'
              : 'Listen to the word and pick the right fruit!',
          spokenText: apple.localizations[learnLocale].term,
          spokenLocale: learnLocale,
          options: allOptions,
        },
        {
          id: 'act-guided-picture-banana',
          type: 'picture-choice',
          schemaVersion: 1,
          promptText: `Which one is "${banana.localizations[learnLocale].term}"?`,
          promptExplanation:
            explainLocale === 'vi'
              ? `Hình nào là "${banana.localizations[learnLocale].term}" (${banana.localizations[explainLocale].term})?`
              : `Tap the picture for "${banana.localizations[learnLocale].term}".`,
          spokenText: banana.localizations[learnLocale].term,
          spokenLocale: learnLocale,
          options: allOptions,
        },
        {
          id: 'act-guided-listen-orange',
          type: 'listen-and-select',
          schemaVersion: 1,
          promptText: 'Listen and find the next fruit',
          promptExplanation:
            explainLocale === 'vi'
              ? 'Bé nghe thật kỹ rồi chạm vào hình đúng nhé.'
              : 'Listen carefully and tap the matching picture.',
          spokenText: orange.localizations[learnLocale].term,
          spokenLocale: learnLocale,
          options: allOptions,
        },
        {
          id: 'act-guided-match-all',
          type: 'match-pair',
          schemaVersion: 1,
          promptText: 'Match the fruit words',
          promptExplanation:
            explainLocale === 'vi'
              ? 'Ghép đủ 3 từ tiếng Anh với hình trái cây để hoàn thành bài học!'
              : 'Match all 3 English words with their fruit pictures!',
          spokenText: 'Let us match the fruits!',
          spokenLocale: learnLocale,
          options: allOptions,
          pairs: concepts.map((c) => ({
            id: c.conceptId,
            conceptId: c.conceptId,
            term: (c.localizations[learnLocale] ?? c.localizations.en).term,
            assetRef: c.assetRef,
          })),
        }
      );
    }

    const preset = EXPERIENCE_PRESETS[params.mode] ?? EXPERIENCE_PRESETS.guided;
    return {
      lessonId: params.lessonId || 'lesson-fruits-01',
      learningPackageId: pkg.id,
      mode: params.mode,
      preset,
      learningLocale: learnLocale,
      explanationLocale: explainLocale,
      title: pkg.titles[learnLocale] ?? pkg.titles.en,
      explanationSummary: pkg.summaries[explainLocale] ?? pkg.summaries.vi,
      availableExperienceModes: pkg.availableExperienceModes,
      activities,
    };
  }

  evaluateActivity(input: {
    activityId: string;
    selectedId?: string;
    matchedPairs?: Array<{ wordId: string; imageId: string }>;
    learningLocale: string;
    explanationLocale: string;
  }) {
    if (input.matchedPairs && input.matchedPairs.length > 0) {
      const allCorrect =
        input.matchedPairs.length >= 3 &&
        input.matchedPairs.every((pair) => pair.wordId === pair.imageId);
      return {
        activityId: input.activityId,
        correct: allCorrect,
        encouragementKey: allCorrect ? ('completed' as const) : ('try_again' as const),
      };
    }

    const expectedConceptId = ANSWER_KEYS[input.activityId];
    if (!expectedConceptId) {
      return {
        activityId: input.activityId,
        correct: true,
        encouragementKey: 'completed' as const,
      };
    }

    const correct = input.selectedId === expectedConceptId;
    const concept = VOCABULARY_CONCEPTS[expectedConceptId];
    const learnLoc = concept.localizations[input.learningLocale] ?? concept.localizations.en;
    const explainLoc =
      concept.localizations[input.explanationLocale] ?? concept.localizations.vi;

    return {
      activityId: input.activityId,
      correct,
      encouragementKey: correct ? ('great_job' as const) : ('try_again' as const),
      revealedConcept: correct
        ? {
            term: learnLoc.term,
            example: learnLoc.example,
            explanation: `${explainLoc.term} — ${explainLoc.example}`,
          }
        : undefined,
    };
  }

  async getProgressForLearner(
    parentAccountId: string,
    learnerId: string
  ): Promise<LessonProgressRecord[]> {
    const col = await getMongoCollection<StoredProgressDoc>('lesson_progress');
    if (col) {
      const docs = await col
        .find({ parentAccountId, learnerId }, { projection: { _id: 0, parentAccountId: 0 } })
        .sort({ updatedAt: -1 })
        .toArray();
      return docs as LessonProgressRecord[];
    }

    return Array.from(this.progress.values())
      .filter((p) => p.parentAccountId === parentAccountId && p.learnerId === learnerId)
      .map(({ parentAccountId: _ignored, ...rest }) => rest);
  }

  async saveProgress(
    parentAccountId: string,
    record: Omit<LessonProgressRecord, 'updatedAt'>
  ): Promise<LessonProgressRecord> {
    const saved: LessonProgressRecord = {
      ...record,
      updatedAt: new Date().toISOString(),
    };
    const key = `${parentAccountId}::${record.learnerId}::${record.lessonId}::${record.learningLocale}::${record.mode}`;
    this.progress.set(key, { ...saved, parentAccountId });

    const col = await getMongoCollection<StoredProgressDoc>('lesson_progress');
    if (col) {
      await col.updateOne(
        {
          parentAccountId,
          learnerId: record.learnerId,
          lessonId: record.lessonId,
          learningLocale: record.learningLocale,
          mode: record.mode,
        },
        { $set: { ...saved, parentAccountId } },
        { upsert: true }
      );
    }

    return saved;
  }

  listStories(): StoryBook[] {
    return STORIES;
  }

  getStory(storyId: string): StoryBook | undefined {
    return STORIES.find((s) => s.id === storyId);
  }

  async getStoryPosition(
    parentAccountId: string,
    learnerId: string,
    storyId: string
  ): Promise<StoryReadingPosition | null> {
    const col = await getMongoCollection<StoredStoryPositionDoc>('story_positions');
    if (col) {
      const doc = await col.findOne(
        { parentAccountId, learnerId, storyId },
        { projection: { _id: 0, parentAccountId: 0 } }
      );
      return (doc as StoryReadingPosition | null) ?? null;
    }

    const found = this.storyPositions.get(
      `${parentAccountId}::${learnerId}::${storyId}`
    );
    if (!found) return null;
    const { parentAccountId: _ignored, ...rest } = found;
    return rest;
  }

  async saveStoryPosition(
    parentAccountId: string,
    input: {
      learnerId: string;
      storyId: string;
      narrationLocale: string;
      segmentIndex: number;
    }
  ): Promise<StoryReadingPosition> {
    const pos: StoryReadingPosition = {
      ...input,
      updatedAt: new Date().toISOString(),
    };
    this.storyPositions.set(
      `${parentAccountId}::${input.learnerId}::${input.storyId}`,
      { ...pos, parentAccountId }
    );

    const col = await getMongoCollection<StoredStoryPositionDoc>('story_positions');
    if (col) {
      await col.updateOne(
        { parentAccountId, learnerId: input.learnerId, storyId: input.storyId },
        { $set: { ...pos, parentAccountId } },
        { upsert: true }
      );
    }
    return pos;
  }
}

export const lingoStore = new LingoRepository();


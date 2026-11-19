import express from 'express';
import { z } from 'zod';
import { lingoStore } from '../data/seedStore.ts';
import { getRuntimeEnvironmentSummary } from '../config/env.ts';
import { notificationService } from '../modules/notifications.ts';
import type { ExperienceMode } from '../../packages/contracts/types.ts';

const createLearnerSchema = z.object({
  nickname: z.string().min(1).max(32),
  ageYears: z.number().int().min(3).max(5),
  avatarTone: z.enum(['sky', 'amber', 'emerald', 'rose']).default('sky'),
  interfaceLocale: z.string().min(2).max(10).default('vi'),
  learningLocale: z.string().min(2).max(10).default('en'),
  explanationLocale: z.string().min(2).max(10).default('vi'),
  narrationLocale: z.string().min(2).max(10).default('en'),
});

const patchPreferencesSchema = z.object({
  interfaceLocale: z.string().min(2).max(10).optional(),
  learningLocale: z.string().min(2).max(10).optional(),
  explanationLocale: z.string().min(2).max(10).optional(),
  narrationLocale: z.string().min(2).max(10).optional(),
  reducedMotion: z.boolean().optional(),
  dailyMinutesLimit: z.number().int().min(5).max(60).optional(),
  audioSpeed: z.number().min(0.65).max(1.25).optional(),
});

const activityAnswerSchema = z.object({
  learnerId: z.string().min(1),
  lessonId: z.string().min(1),
  learningLocale: z.string().min(2).default('en'),
  explanationLocale: z.string().min(2).default('vi'),
  selectedId: z.string().optional(),
  matchedPairs: z
    .array(
      z.object({
        wordId: z.string(),
        imageId: z.string(),
      })
    )
    .optional(),
});

const saveProgressSchema = z.object({
  learnerId: z.string().min(1),
  learningLocale: z.string().min(2),
  mode: z.enum(['guided', 'flashcards', 'listening', 'game', 'story', 'explore']),
  completedActivityIds: z.array(z.string()),
  totalActivities: z.number().int().min(1),
  lastActivityIndex: z.number().int().min(0),
  completed: z.boolean(),
});

const storyPositionSchema = z.object({
  learnerId: z.string().min(1),
  narrationLocale: z.string().min(2),
  segmentIndex: z.number().int().min(0),
});

const notificationCategoryEnum = z.enum([
  'reminder',
  'story',
  'progress',
  'announcement',
]);

const pushSubscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(2048),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({
      p256dh: z.string().min(1).max(256),
      auth: z.string().min(1).max(128),
    }),
  }),
  deviceLabel: z.string().min(1).max(60).default('Browser device'),
  locale: z.string().min(2).max(10).default('vi'),
  topics: z
    .array(notificationCategoryEnum)
    .min(1)
    .max(4)
    .default(['reminder', 'story', 'progress', 'announcement']),
});

const createCampaignSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(280),
  category: notificationCategoryEnum.default('reminder'),
  locale: z.string().min(2).max(10).default('vi'),
  targetUrl: z.string().max(120).default('/'),
  status: z.enum(['draft', 'scheduled', 'sent']).default('draft'),
  scheduledFor: z.string().max(32).nullable().default(null),
});

const patchCampaignSchema = createCampaignSchema.partial();

export function createV1Router() {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'tm-lingo-api',
      environment: getRuntimeEnvironmentSummary(),
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/languages', (_req, res) => {
    res.json({ languages: lingoStore.getLanguages() });
  });

  router.get('/voices', (req, res) => {
    const locale = typeof req.query.locale === 'string' ? req.query.locale : undefined;
    res.json({ voices: lingoStore.getVoices(locale) });
  });

  router.get('/learners', (_req, res) => {
    res.json({ learners: lingoStore.listLearners() });
  });

  router.post('/learners', (req, res) => {
    const parsed = createLearnerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid learner profile data' });
    }
    const created = lingoStore.createLearner(parsed.data);
    return res.status(201).json({ learner: created });
  });

  router.patch('/learners/:learnerId/preferences', (req, res) => {
    const parsed = patchPreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid preferences update' });
    }
    const updated = lingoStore.updateLearnerPreferences(req.params.learnerId, parsed.data);
    if (!updated) {
      return res.status(404).json({ error: 'Learner not found' });
    }
    return res.json({ learner: updated });
  });

  router.get('/packages', (_req, res) => {
    res.json({ packages: lingoStore.listPackages() });
  });

  router.get('/lessons/:lessonId', (req, res) => {
    const rawMode = typeof req.query.mode === 'string' ? req.query.mode : 'guided';
    const validModes: ExperienceMode[] = [
      'guided',
      'flashcards',
      'listening',
      'game',
      'story',
      'explore',
    ];
    const mode: ExperienceMode = validModes.includes(rawMode as ExperienceMode)
      ? (rawMode as ExperienceMode)
      : 'guided';

    const learningLocale =
      typeof req.query.learningLocale === 'string' ? req.query.learningLocale : 'en';
    const explanationLocale =
      typeof req.query.explanationLocale === 'string' ? req.query.explanationLocale : 'vi';

    const lesson = lingoStore.resolveLesson({
      lessonId: req.params.lessonId,
      mode,
      learningLocale,
      explanationLocale,
    });
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }
    return res.json({ lesson });
  });

  router.post('/activities/:activityId/answer', (req, res) => {
    const parsed = activityAnswerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid activity answer payload' });
    }
    const result = lingoStore.evaluateActivity({
      activityId: req.params.activityId,
      selectedId: parsed.data.selectedId,
      matchedPairs: parsed.data.matchedPairs,
      learningLocale: parsed.data.learningLocale,
      explanationLocale: parsed.data.explanationLocale,
    });
    return res.json(result);
  });

  router.get('/progress', (req, res) => {
    const learnerId = typeof req.query.learnerId === 'string' ? req.query.learnerId : '';
    if (!learnerId) {
      return res.status(400).json({ error: 'learnerId is required' });
    }
    return res.json({ progress: lingoStore.getProgressForLearner(learnerId) });
  });

  router.post('/lessons/:lessonId/progress', (req, res) => {
    const parsed = saveProgressSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid progress payload' });
    }
    const saved = lingoStore.saveProgress({
      ...parsed.data,
      lessonId: req.params.lessonId,
    });
    return res.json({ progress: saved });
  });

  router.get('/stories', (_req, res) => {
    res.json({ stories: lingoStore.listStories() });
  });

  router.get('/stories/:storyId', (req, res) => {
    const story = lingoStore.getStory(req.params.storyId);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    const learnerId =
      typeof req.query.learnerId === 'string' ? req.query.learnerId : undefined;
    const readingPosition = learnerId
      ? lingoStore.getStoryPosition(learnerId, story.id)
      : null;
    return res.json({ story, readingPosition });
  });

  router.post('/stories/:storyId/position', (req, res) => {
    const parsed = storyPositionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid reading position payload' });
    }
    const position = lingoStore.saveStoryPosition({
      storyId: req.params.storyId,
      ...parsed.data,
    });
    return res.json({ readingPosition: position });
  });

  // Web Push & Notification Management API
  router.get('/notifications/vapid-public-key', (_req, res) => {
    res.json({
      publicKey: notificationService.getPublicKey(),
      configured: true,
    });
  });

  router.get('/notifications/subscriptions', (_req, res) => {
    res.json({ subscriptions: notificationService.listSubscriptions() });
  });

  router.post('/notifications/subscribe', (req, res) => {
    const parsed = pushSubscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid push subscription payload' });
    }
    const created = notificationService.subscribe(parsed.data);
    return res.status(201).json({ subscription: created });
  });

  router.delete('/notifications/subscriptions/:subscriptionId', (req, res) => {
    const removed = notificationService.unsubscribe(req.params.subscriptionId);
    if (!removed) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    return res.json({ removed: true });
  });

  router.get('/notifications/campaigns', (_req, res) => {
    res.json({
      campaigns: notificationService.listCampaigns(),
      logs: notificationService.listDeliveryLogs(),
    });
  });

  router.post('/notifications/campaigns', (req, res) => {
    const parsed = createCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid notification campaign payload' });
    }
    const campaign = notificationService.createCampaign(parsed.data);
    return res.status(201).json({ campaign });
  });

  router.patch('/notifications/campaigns/:campaignId', (req, res) => {
    const parsed = patchCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid campaign update payload' });
    }
    const updated = notificationService.updateCampaign(
      req.params.campaignId,
      parsed.data
    );
    if (!updated) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    return res.json({ campaign: updated });
  });

  router.delete('/notifications/campaigns/:campaignId', (req, res) => {
    const removed = notificationService.deleteCampaign(req.params.campaignId);
    if (!removed) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    return res.json({ removed: true });
  });

  router.post('/notifications/campaigns/:campaignId/send', async (req, res) => {
    const result = await notificationService.sendCampaign(req.params.campaignId);
    if (!result) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    return res.json(result);
  });

  return router;
}

import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { lingoStore } from '../data/seedStore.ts';
import { getRuntimeEnvironmentSummary } from '../config/env.ts';
import { getMongoStatus } from '../db/mongo.ts';
import {
  attachSupabaseUser,
  requireAdminRole,
  requireStaffRole,
  requireSupabaseAuth,
} from '../auth/supabaseAuth.ts';
import {
  getAdminSeedStatus,
  listManagedUsers,
  setManagedUserRole,
} from '../auth/roleStore.ts';
import { notificationService } from '../modules/notifications.ts';
import {
  deleteLearningMedia,
  getStorageBucketName,
  listLearningMedia,
  uploadLearningMedia,
} from '../modules/storage.ts';
import type { ExperienceMode } from '../../packages/contracts/types.ts';

const GUEST_PARENT_ID = 'parent-demo-01';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

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

const updateUserRoleSchema = z.object({
  role: z.enum(['parent', 'teacher', 'admin']),
});

export function createV1Router() {
  const router = express.Router();

  // Attach verified Supabase user on every API request when Bearer JWT is provided
  router.use(attachSupabaseUser);

  const resolveParentId = (req: express.Request) =>
    req.authUser?.id ?? GUEST_PARENT_ID;

  router.get('/health', (_req, res) => {
    const mongo = getMongoStatus();
    const adminSeed = getAdminSeedStatus();
    res.json({
      status: 'ok',
      service: 'tm-lingo-api',
      environment: getRuntimeEnvironmentSummary({
        connected: mongo.connected,
        lastError: mongo.lastError,
      }),
      adminSeeded: adminSeed.ready,
      storageBucket: getStorageBucketName(),
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/auth/me', (req, res) => {
    res.json({ user: req.authUser ?? null });
  });

  router.get('/languages', (_req, res) => {
    res.json({ languages: lingoStore.getLanguages() });
  });

  router.get('/voices', (req, res) => {
    const locale = typeof req.query.locale === 'string' ? req.query.locale : undefined;
    res.json({ voices: lingoStore.getVoices(locale) });
  });

  router.get('/learners', async (req, res) => {
    const learners = await lingoStore.listLearners(resolveParentId(req));
    res.json({ learners });
  });

  router.post('/learners', async (req, res) => {
    const parsed = createLearnerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid learner profile data' });
    }
    const created = await lingoStore.createLearner(
      resolveParentId(req),
      parsed.data
    );
    return res.status(201).json({ learner: created });
  });

  router.patch('/learners/:learnerId/preferences', async (req, res) => {
    const parsed = patchPreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid preferences update' });
    }
    const updated = await lingoStore.updateLearnerPreferences(
      resolveParentId(req),
      req.params.learnerId,
      parsed.data
    );
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

  router.get('/progress', async (req, res) => {
    const learnerId = typeof req.query.learnerId === 'string' ? req.query.learnerId : '';
    if (!learnerId) {
      return res.status(400).json({ error: 'learnerId is required' });
    }
    const progress = await lingoStore.getProgressForLearner(
      resolveParentId(req),
      learnerId
    );
    return res.json({ progress });
  });

  router.post('/lessons/:lessonId/progress', async (req, res) => {
    const parsed = saveProgressSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid progress payload' });
    }
    const saved = await lingoStore.saveProgress(resolveParentId(req), {
      ...parsed.data,
      lessonId: req.params.lessonId,
    });
    return res.json({ progress: saved });
  });

  router.get('/stories', (_req, res) => {
    res.json({ stories: lingoStore.listStories() });
  });

  router.get('/stories/:storyId', async (req, res) => {
    const story = lingoStore.getStory(req.params.storyId);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    const learnerId =
      typeof req.query.learnerId === 'string' ? req.query.learnerId : undefined;
    const readingPosition = learnerId
      ? await lingoStore.getStoryPosition(
          resolveParentId(req),
          learnerId,
          story.id
        )
      : null;
    return res.json({ story, readingPosition });
  });

  router.post('/stories/:storyId/position', async (req, res) => {
    const parsed = storyPositionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid reading position payload' });
    }
    const position = await lingoStore.saveStoryPosition(resolveParentId(req), {
      storyId: req.params.storyId,
      ...parsed.data,
    });
    return res.json({ readingPosition: position });
  });

  // Supabase Storage Curriculum Media Library (Admin & Teacher only for mutations)
  router.get('/media', requireStaffRole, async (_req, res) => {
    const assets = await listLearningMedia();
    res.json({ assets, bucket: getStorageBucketName() });
  });

  router.post(
    '/media/upload',
    requireStaffRole,
    upload.single('file'),
    async (req, res) => {
      if (!req.file) {
        return res
          .status(400)
          .json({ error: 'Please select an image or audio file.' });
      }
      const title =
        typeof req.body?.title === 'string' ? req.body.title.slice(0, 80) : '';
      const locale =
        typeof req.body?.locale === 'string'
          ? req.body.locale.slice(0, 10)
          : 'en';

      try {
        const asset = await uploadLearningMedia({
          parentAccountId: req.authUser!.id,
          title: title || req.file.originalname,
          locale,
          fileBuffer: req.file.buffer,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
        });
        return res.status(201).json({ asset });
      } catch (err) {
        return res.status(400).json({
          error: err instanceof Error ? err.message : 'Media upload failed',
        });
      }
    }
  );

  router.delete('/media/:assetId', requireStaffRole, async (req, res) => {
    const removed = await deleteLearningMedia(String(req.params.assetId));
    if (!removed) {
      return res.status(404).json({ error: 'Media asset not found' });
    }
    return res.json({ removed: true });
  });

  // Parent/User Notification Inbox (read-only for signed-in users)
  router.get('/notifications/inbox', requireSupabaseAuth, async (_req, res) => {
    const campaigns = await notificationService.listCampaigns();
    const inbox = campaigns
      .filter((c) => c.status === 'sent' || c.status === 'scheduled')
      .slice(0, 12);
    res.json({ notifications: inbox });
  });

  // Standard W3C Web Push opt-in (available to signed-in users & devices)
  router.get('/notifications/vapid-public-key', (_req, res) => {
    res.json({
      publicKey: notificationService.getPublicKey(),
      configured: true,
    });
  });

  router.post('/notifications/subscribe', async (req, res) => {
    const parsed = pushSubscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid push subscription payload' });
    }
    const created = await notificationService.subscribe(parsed.data);
    return res.status(201).json({ subscription: created });
  });

  // Notification & Push Administration (Admin / Teacher only)
  router.get(
    '/notifications/subscriptions',
    requireStaffRole,
    async (_req, res) => {
      const subscriptions = await notificationService.listSubscriptions();
      res.json({ subscriptions });
    }
  );

  router.delete(
    '/notifications/subscriptions/:subscriptionId',
    requireStaffRole,
    async (req, res) => {
      const removed = await notificationService.unsubscribe(
        String(req.params.subscriptionId)
      );
      if (!removed) {
        return res.status(404).json({ error: 'Subscription not found' });
      }
      return res.json({ removed: true });
    }
  );

  router.get(
    '/notifications/campaigns',
    requireStaffRole,
    async (_req, res) => {
      const [campaigns, logs] = await Promise.all([
        notificationService.listCampaigns(),
        notificationService.listDeliveryLogs(),
      ]);
      res.json({ campaigns, logs });
    }
  );

  router.post(
    '/notifications/campaigns',
    requireStaffRole,
    async (req, res) => {
      const parsed = createCampaignSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: 'Invalid notification campaign payload' });
      }
      const campaign = await notificationService.createCampaign(parsed.data);
      return res.status(201).json({ campaign });
    }
  );

  router.patch(
    '/notifications/campaigns/:campaignId',
    requireStaffRole,
    async (req, res) => {
      const parsed = patchCampaignSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid campaign update payload' });
      }
      const updated = await notificationService.updateCampaign(
        String(req.params.campaignId),
        parsed.data
      );
      if (!updated) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      return res.json({ campaign: updated });
    }
  );

  router.delete(
    '/notifications/campaigns/:campaignId',
    requireStaffRole,
    async (req, res) => {
      const removed = await notificationService.deleteCampaign(
        String(req.params.campaignId)
      );
      if (!removed) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      return res.json({ removed: true });
    }
  );

  router.post(
    '/notifications/campaigns/:campaignId/send',
    requireStaffRole,
    async (req, res) => {
      const result = await notificationService.sendCampaign(
        String(req.params.campaignId)
      );
      if (!result) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      return res.json(result);
    }
  );

  // Admin-only Account & Role Management
  router.get('/admin/users', requireAdminRole, async (_req, res) => {
    const users = await listManagedUsers();
    res.json({ users });
  });

  router.patch(
    '/admin/users/:userId/role',
    requireAdminRole,
    async (req, res) => {
      const parsed = updateUserRoleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid role value' });
      }
      const targetUserId = String(req.params.userId);
      if (targetUserId === req.authUser!.id && parsed.data.role !== 'admin') {
        return res
          .status(400)
          .json({ error: 'Cannot remove admin role from your own active account.' });
      }
      const updated = await setManagedUserRole(targetUserId, parsed.data.role);
      if (!updated) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json({ user: updated });
    }
  );

  return router;
}

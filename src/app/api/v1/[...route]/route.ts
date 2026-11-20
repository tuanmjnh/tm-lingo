import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { lingoStore } from '../../../../../server/data/seedStore';
import { getRuntimeEnvironmentSummary } from '../../../../../server/config/env';
import { connectMongo, getMongoStatus } from '../../../../../server/db/mongo';
import { getAuthUserFromRequest } from '../../../../../server/auth/supabaseAuth';
import {
  ensureSeededAdminAccount,
  getAdminSeedStatus,
  listManagedUsers,
  setManagedUserRole,
} from '../../../../../server/auth/roleStore';
import { notificationService } from '../../../../../server/modules/notifications';
import {
  deleteLearningMedia,
  getStorageBucketName,
  listLearningMedia,
  uploadLearningMedia,
} from '../../../../../server/modules/storage';
import type {
  AuthUserProfile,
  ExperienceMode,
} from '../../../../../packages/contracts/types';

const GUEST_PARENT_ID = 'parent-demo-01';

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

let initPromise: Promise<void> | null = null;
function ensureInit() {
  if (!initPromise) {
    initPromise = (async () => {
      await connectMongo();
      await ensureSeededAdminAccount();
    })().catch((err) => {
      console.error('[API Init Error]', err);
      initPromise = null;
    });
  }
  return initPromise;
}

type RouteContext = { params: Promise<{ route: string[] }> };

function resolveParentId(user: AuthUserProfile | null) {
  return user?.id ?? GUEST_PARENT_ID;
}

function requireStaff(user: AuthUserProfile | null) {
  if (!user || (user.role !== 'admin' && user.role !== 'teacher')) {
    return NextResponse.json(
      { error: 'Staff access required (teacher or admin).' },
      { status: 403 }
    );
  }
  return null;
}

function requireAdmin(user: AuthUserProfile | null) {
  if (!user || user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Administrator access required.' },
      { status: 403 }
    );
  }
  return null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  await ensureInit();
  const { route } = await context.params;
  const path = route.join('/');
  const user = await getAuthUserFromRequest(request);
  const searchParams = request.nextUrl.searchParams;

  // 1. Health
  if (path === 'health') {
    const mongo = getMongoStatus();
    const adminSeed = getAdminSeedStatus();
    return NextResponse.json({
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
  }

  // 2. Auth me
  if (path === 'auth/me') {
    return NextResponse.json({ user });
  }

  // 3. Languages
  if (path === 'languages') {
    return NextResponse.json({ languages: lingoStore.getLanguages() });
  }

  // 4. Voices
  if (path === 'voices') {
    const locale = searchParams.get('locale') || undefined;
    return NextResponse.json({ voices: lingoStore.getVoices(locale) });
  }

  // 5. Learners
  if (path === 'learners') {
    const learners = await lingoStore.listLearners(resolveParentId(user));
    return NextResponse.json({ learners });
  }

  // 6. Packages
  if (path === 'packages') {
    return NextResponse.json({ packages: lingoStore.listPackages() });
  }

  // 7. Lessons :lessonId
  if (route[0] === 'lessons' && route.length === 2) {
    const lessonId = route[1];
    const rawMode = searchParams.get('mode') || 'guided';
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
    const learningLocale = searchParams.get('learningLocale') || 'en';
    const explanationLocale = searchParams.get('explanationLocale') || 'vi';

    const lesson = lingoStore.resolveLesson({
      lessonId,
      mode,
      learningLocale,
      explanationLocale,
    });
    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }
    return NextResponse.json({ lesson });
  }

  // 8. Progress
  if (path === 'progress') {
    const learnerId = searchParams.get('learnerId');
    if (!learnerId) {
      return NextResponse.json(
        { error: 'learnerId is required' },
        { status: 400 }
      );
    }
    const progress = await lingoStore.getProgressForLearner(
      resolveParentId(user),
      learnerId
    );
    return NextResponse.json({ progress });
  }

  // 9. Stories list
  if (path === 'stories') {
    return NextResponse.json({ stories: lingoStore.listStories() });
  }

  // 10. Single story
  if (route[0] === 'stories' && route.length === 2) {
    const storyId = route[1];
    const story = lingoStore.getStory(storyId);
    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }
    const learnerId = searchParams.get('learnerId') || undefined;
    const readingPosition = learnerId
      ? await lingoStore.getStoryPosition(
          resolveParentId(user),
          learnerId,
          story.id
        )
      : null;
    return NextResponse.json({ story, readingPosition });
  }

  // 11. Media assets (staff only)
  if (path === 'media') {
    const authErr = requireStaff(user);
    if (authErr) return authErr;
    const assets = await listLearningMedia();
    return NextResponse.json({ assets, bucket: getStorageBucketName() });
  }

  // 12. Notification Inbox (signed-in users)
  if (path === 'notifications/inbox') {
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in first.' },
        { status: 401 }
      );
    }
    const campaigns = await notificationService.listCampaigns();
    const inbox = campaigns
      .filter((c) => c.status === 'sent' || c.status === 'scheduled')
      .slice(0, 12);
    return NextResponse.json({ notifications: inbox });
  }

  // 13. VAPID public key
  if (path === 'notifications/vapid-public-key') {
    return NextResponse.json({
      publicKey: notificationService.getPublicKey(),
      configured: true,
    });
  }

  // 14. Push subscriptions (staff only)
  if (path === 'notifications/subscriptions') {
    const authErr = requireStaff(user);
    if (authErr) return authErr;
    const subscriptions = await notificationService.listSubscriptions();
    return NextResponse.json({ subscriptions });
  }

  // 15. Campaigns (staff only)
  if (path === 'notifications/campaigns') {
    const authErr = requireStaff(user);
    if (authErr) return authErr;
    const [campaigns, logs] = await Promise.all([
      notificationService.listCampaigns(),
      notificationService.listDeliveryLogs(),
    ]);
    return NextResponse.json({ campaigns, logs });
  }

  // 16. Admin users (admin only)
  if (path === 'admin/users') {
    const authErr = requireAdmin(user);
    if (authErr) return authErr;
    const users = await listManagedUsers();
    return NextResponse.json({ users });
  }

  return NextResponse.json({ error: `Not found: ${path}` }, { status: 404 });
}

export async function POST(request: NextRequest, context: RouteContext) {
  await ensureInit();
  const { route } = await context.params;
  const path = route.join('/');
  const user = await getAuthUserFromRequest(request);

  // 1. Create learner
  if (path === 'learners') {
    const body = await request.json().catch(() => ({}));
    const parsed = createLearnerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid learner profile data' },
        { status: 400 }
      );
    }
    const created = await lingoStore.createLearner(
      resolveParentId(user),
      parsed.data
    );
    return NextResponse.json({ learner: created }, { status: 201 });
  }

  // 2. Answer activity
  if (route[0] === 'activities' && route[2] === 'answer' && route.length === 3) {
    const activityId = route[1];
    const body = await request.json().catch(() => ({}));
    const parsed = activityAnswerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid activity answer payload' },
        { status: 400 }
      );
    }
    const result = lingoStore.evaluateActivity({
      activityId,
      selectedId: parsed.data.selectedId,
      matchedPairs: parsed.data.matchedPairs,
      learningLocale: parsed.data.learningLocale,
      explanationLocale: parsed.data.explanationLocale,
    });
    return NextResponse.json(result);
  }

  // 3. Save progress
  if (route[0] === 'lessons' && route[2] === 'progress' && route.length === 3) {
    const lessonId = route[1];
    const body = await request.json().catch(() => ({}));
    const parsed = saveProgressSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid progress payload' },
        { status: 400 }
      );
    }
    const saved = await lingoStore.saveProgress(resolveParentId(user), {
      ...parsed.data,
      lessonId,
    });
    return NextResponse.json({ progress: saved });
  }

  // 4. Save story reading position
  if (route[0] === 'stories' && route[2] === 'position' && route.length === 3) {
    const storyId = route[1];
    const body = await request.json().catch(() => ({}));
    const parsed = storyPositionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid reading position payload' },
        { status: 400 }
      );
    }
    const position = await lingoStore.saveStoryPosition(resolveParentId(user), {
      storyId,
      ...parsed.data,
    });
    return NextResponse.json({ readingPosition: position });
  }

  // 5. Upload media (staff only)
  if (path === 'media/upload') {
    const authErr = requireStaff(user);
    if (authErr) return authErr;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json(
        { error: 'Please select an image or audio file.' },
        { status: 400 }
      );
    }

    const title = (formData.get('title') as string | null) || '';
    const locale = (formData.get('locale') as string | null) || 'en';
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    try {
      const asset = await uploadLearningMedia({
        parentAccountId: user!.id,
        title: title.slice(0, 80) || file.name,
        locale: locale.slice(0, 10),
        fileBuffer,
        originalName: file.name,
        mimeType: file.type,
      });
      return NextResponse.json({ asset }, { status: 201 });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Media upload failed' },
        { status: 400 }
      );
    }
  }

  // 6. Push subscribe
  if (path === 'notifications/subscribe') {
    const body = await request.json().catch(() => ({}));
    const parsed = pushSubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid push subscription payload' },
        { status: 400 }
      );
    }
    const created = await notificationService.subscribe(parsed.data);
    return NextResponse.json({ subscription: created }, { status: 201 });
  }

  // 7. Create notification campaign (staff only)
  if (path === 'notifications/campaigns') {
    const authErr = requireStaff(user);
    if (authErr) return authErr;
    const body = await request.json().catch(() => ({}));
    const parsed = createCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid notification campaign payload' },
        { status: 400 }
      );
    }
    const campaign = await notificationService.createCampaign(parsed.data);
    return NextResponse.json({ campaign }, { status: 201 });
  }

  // 8. Send notification campaign (staff only)
  if (
    route[0] === 'notifications' &&
    route[1] === 'campaigns' &&
    route[3] === 'send' &&
    route.length === 4
  ) {
    const authErr = requireStaff(user);
    if (authErr) return authErr;
    const campaignId = route[2];
    const result = await notificationService.sendCampaign(campaignId);
    if (!result) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: `Not found: ${path}` }, { status: 404 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  await ensureInit();
  const { route } = await context.params;
  const user = await getAuthUserFromRequest(request);

  // 1. Update learner preferences
  if (
    route[0] === 'learners' &&
    route[2] === 'preferences' &&
    route.length === 3
  ) {
    const learnerId = route[1];
    const body = await request.json().catch(() => ({}));
    const parsed = patchPreferencesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid preferences update' },
        { status: 400 }
      );
    }
    const updated = await lingoStore.updateLearnerPreferences(
      resolveParentId(user),
      learnerId,
      parsed.data
    );
    if (!updated) {
      return NextResponse.json(
        { error: 'Learner not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ learner: updated });
  }

  // 2. Update notification campaign (staff only)
  if (
    route[0] === 'notifications' &&
    route[1] === 'campaigns' &&
    route.length === 3
  ) {
    const authErr = requireStaff(user);
    if (authErr) return authErr;
    const campaignId = route[2];
    const body = await request.json().catch(() => ({}));
    const parsed = patchCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid campaign update payload' },
        { status: 400 }
      );
    }
    const updated = await notificationService.updateCampaign(
      campaignId,
      parsed.data
    );
    if (!updated) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ campaign: updated });
  }

  // 3. Update user role (admin only)
  if (
    route[0] === 'admin' &&
    route[1] === 'users' &&
    route[3] === 'role' &&
    route.length === 4
  ) {
    const authErr = requireAdmin(user);
    if (authErr) return authErr;
    const targetUserId = route[2];
    const body = await request.json().catch(() => ({}));
    const parsed = updateUserRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid role value' }, { status: 400 });
    }
    if (targetUserId === user!.id && parsed.data.role !== 'admin') {
      return NextResponse.json(
        { error: 'Cannot remove admin role from your own active account.' },
        { status: 400 }
      );
    }
    const updated = await setManagedUserRole(targetUserId, parsed.data.role);
    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ user: updated });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  await ensureInit();
  const { route } = await context.params;
  const user = await getAuthUserFromRequest(request);

  // 1. Delete media asset (staff only)
  if (route[0] === 'media' && route.length === 2) {
    const authErr = requireStaff(user);
    if (authErr) return authErr;
    const assetId = route[1];
    const removed = await deleteLearningMedia(assetId);
    if (!removed) {
      return NextResponse.json(
        { error: 'Media asset not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ removed: true });
  }

  // 2. Unsubscribe push subscription (staff only)
  if (
    route[0] === 'notifications' &&
    route[1] === 'subscriptions' &&
    route.length === 3
  ) {
    const authErr = requireStaff(user);
    if (authErr) return authErr;
    const subscriptionId = route[2];
    const removed = await notificationService.unsubscribe(subscriptionId);
    if (!removed) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ removed: true });
  }

  // 3. Delete notification campaign (staff only)
  if (
    route[0] === 'notifications' &&
    route[1] === 'campaigns' &&
    route.length === 3
  ) {
    const authErr = requireStaff(user);
    if (authErr) return authErr;
    const campaignId = route[2];
    const removed = await notificationService.deleteCampaign(campaignId);
    if (!removed) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ removed: true });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

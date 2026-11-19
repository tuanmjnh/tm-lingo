import * as webpushNamespace from 'web-push';
import type { PushSubscription } from 'web-push';
import { env } from '../config/env.ts';
import type {
  NotificationCampaign,
  NotificationCategory,
  NotificationDeliveryLog,
  NotificationStatus,
  PushSubscriptionSummary,
} from '../../packages/contracts/types.ts';

const webpush =
  (webpushNamespace as unknown as { default?: typeof webpushNamespace })
    .default ?? webpushNamespace;

interface StoredSubscription {
  id: string;
  subscription: PushSubscription;
  deviceLabel: string;
  locale: string;
  topics: NotificationCategory[];
  createdAt: string;
}

class NotificationService {
  private vapidPublicKey: string;
  private vapidPrivateKey: string;
  private subscriptions: Map<string, StoredSubscription> = new Map();
  private campaigns: Map<string, NotificationCampaign> = new Map();
  private deliveryLogs: NotificationDeliveryLog[] = [];

  constructor() {
    if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
      this.vapidPublicKey = env.VAPID_PUBLIC_KEY;
      this.vapidPrivateKey = env.VAPID_PRIVATE_KEY;
    } else {
      const generated = webpush.generateVAPIDKeys();
      this.vapidPublicKey = generated.publicKey;
      this.vapidPrivateKey = generated.privateKey;
    }

    webpush.setVapidDetails(
      env.VAPID_SUBJECT || 'mailto:admin@tm-lingo.local',
      this.vapidPublicKey,
      this.vapidPrivateKey
    );

    const now = new Date().toISOString();
    const initialCampaigns: NotificationCampaign[] = [
      {
        id: 'cmp-gentle-play',
        title: 'Giờ chơi tiếng Anh nhẹ nhàng cùng bé',
        body: 'Chỉ 5 phút nghe từ vựng quả táo, quả chuối và quả cam để bé làm quen âm điệu tự nhiên.',
        category: 'reminder',
        locale: 'vi',
        targetUrl: '/',
        status: 'scheduled',
        scheduledFor: '19:30',
        sentCount: 0,
        failedCount: 0,
        lastSentAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'cmp-story-market',
        title: 'Truyện kể mới: Ở Khu Chợ Trái Cây',
        body: 'Mở Story Reader để nghe câu chuyện song ngữ Anh - Việt với giọng đọc dịu nhẹ cho bé 3–5 tuổi.',
        category: 'story',
        locale: 'vi',
        targetUrl: '/?tab=stories',
        status: 'draft',
        scheduledFor: null,
        sentCount: 0,
        failedCount: 0,
        lastSentAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'cmp-parent-digest',
        title: 'Weekly gentle progress check-in',
        body: 'Review this week’s fruit vocabulary activities and adjust daily listening pace in Parent Controls.',
        category: 'progress',
        locale: 'en',
        targetUrl: '/?tab=parents',
        status: 'draft',
        scheduledFor: null,
        sentCount: 0,
        failedCount: 0,
        lastSentAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const c of initialCampaigns) {
      this.campaigns.set(c.id, c);
    }
  }

  getPublicKey(): string {
    return this.vapidPublicKey;
  }

  listSubscriptions(): PushSubscriptionSummary[] {
    return Array.from(this.subscriptions.values()).map((sub) => ({
      id: sub.id,
      endpointPreview: this.maskEndpoint(sub.subscription.endpoint),
      deviceLabel: sub.deviceLabel,
      locale: sub.locale,
      topics: sub.topics,
      createdAt: sub.createdAt,
    }));
  }

  subscribe(input: {
    subscription: PushSubscription;
    deviceLabel: string;
    locale: string;
    topics: NotificationCategory[];
  }): PushSubscriptionSummary {
    const existing = Array.from(this.subscriptions.values()).find(
      (s) => s.subscription.endpoint === input.subscription.endpoint
    );
    const id = existing?.id ?? `sub-${Date.now().toString(36)}`;
    const record: StoredSubscription = {
      id,
      subscription: input.subscription,
      deviceLabel: input.deviceLabel.trim().slice(0, 60) || 'Browser device',
      locale: input.locale,
      topics: input.topics,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    this.subscriptions.set(id, record);
    return {
      id: record.id,
      endpointPreview: this.maskEndpoint(record.subscription.endpoint),
      deviceLabel: record.deviceLabel,
      locale: record.locale,
      topics: record.topics,
      createdAt: record.createdAt,
    };
  }

  unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  listCampaigns(): NotificationCampaign[] {
    return Array.from(this.campaigns.values()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  }

  listDeliveryLogs(): NotificationDeliveryLog[] {
    return this.deliveryLogs.slice(0, 30);
  }

  createCampaign(input: {
    title: string;
    body: string;
    category: NotificationCategory;
    locale: string;
    targetUrl: string;
    status: NotificationStatus;
    scheduledFor: string | null;
  }): NotificationCampaign {
    const now = new Date().toISOString();
    const id = `cmp-${Date.now().toString(36)}`;
    const campaign: NotificationCampaign = {
      id,
      title: input.title.trim(),
      body: input.body.trim(),
      category: input.category,
      locale: input.locale,
      targetUrl: input.targetUrl || '/',
      status: input.status,
      scheduledFor: input.scheduledFor,
      sentCount: 0,
      failedCount: 0,
      lastSentAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.campaigns.set(id, campaign);
    return campaign;
  }

  updateCampaign(
    id: string,
    patch: Partial<{
      title: string;
      body: string;
      category: NotificationCategory;
      locale: string;
      targetUrl: string;
      status: NotificationStatus;
      scheduledFor: string | null;
    }>
  ): NotificationCampaign | undefined {
    const existing = this.campaigns.get(id);
    if (!existing) return undefined;
    const updated: NotificationCampaign = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.campaigns.set(id, updated);
    return updated;
  }

  deleteCampaign(id: string): boolean {
    return this.campaigns.delete(id);
  }

  async sendCampaign(id: string): Promise<{
    campaign: NotificationCampaign;
    log: NotificationDeliveryLog;
  } | null> {
    const campaign = this.campaigns.get(id);
    if (!campaign) return null;

    const matchingSubs = Array.from(this.subscriptions.values()).filter((sub) =>
      sub.topics.includes(campaign.category)
    );

    const payload = JSON.stringify({
      title: campaign.title,
      body: campaign.body,
      url: campaign.targetUrl,
      tag: `tm-lingo-${campaign.category}-${campaign.id}`,
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const sub of matchingSubs) {
      try {
        await webpush.sendNotification(sub.subscription, payload);
        sentCount += 1;
      } catch (err: unknown) {
        failedCount += 1;
        const statusCode =
          typeof err === 'object' && err !== null && 'statusCode' in err
            ? Number((err as { statusCode?: number }).statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          this.subscriptions.delete(sub.id);
        }
      }
    }

    const now = new Date().toISOString();
    const updated: NotificationCampaign = {
      ...campaign,
      status: 'sent',
      sentCount: campaign.sentCount + sentCount,
      failedCount: campaign.failedCount + failedCount,
      lastSentAt: now,
      updatedAt: now,
    };
    this.campaigns.set(id, updated);

    const log: NotificationDeliveryLog = {
      id: `log-${Date.now().toString(36)}`,
      campaignId: updated.id,
      campaignTitle: updated.title,
      category: updated.category,
      locale: updated.locale,
      sentCount,
      failedCount,
      mode: matchingSubs.length > 0 ? 'web-push' : 'no-subscribers',
      sentAt: now,
    };
    this.deliveryLogs.unshift(log);

    return { campaign: updated, log };
  }

  private maskEndpoint(endpoint: string): string {
    try {
      const url = new URL(endpoint);
      const tail = url.pathname.slice(-10);
      return `${url.hostname}/...${tail}`;
    } catch {
      return `${endpoint.slice(0, 24)}...`;
    }
  }
}

export const notificationService = new NotificationService();

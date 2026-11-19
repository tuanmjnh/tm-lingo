import * as webpushNamespace from 'web-push';
import type { PushSubscription } from 'web-push';
import { env } from '../config/env.ts';
import { getMongoCollection } from '../db/mongo.ts';
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

function createInitialCampaigns(): NotificationCampaign[] {
  const now = new Date().toISOString();
  return [
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
}

class NotificationService {
  private vapidPublicKey: string;
  private vapidPrivateKey: string;
  private subscriptions: Map<string, StoredSubscription> = new Map();
  private campaigns: Map<string, NotificationCampaign> = new Map();
  private deliveryLogs: NotificationDeliveryLog[] = [];
  private seededMongoCampaigns = false;

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

    for (const c of createInitialCampaigns()) {
      this.campaigns.set(c.id, c);
    }
  }

  getPublicKey(): string {
    return this.vapidPublicKey;
  }

  private async ensureSeedCampaignsInMongo(): Promise<void> {
    if (this.seededMongoCampaigns) return;
    const col = await getMongoCollection<NotificationCampaign>(
      'notification_campaigns'
    );
    if (!col) return;
    const count = await col.estimatedDocumentCount();
    if (count === 0) {
      await col.insertMany(createInitialCampaigns());
    }
    this.seededMongoCampaigns = true;
  }

  async listSubscriptions(): Promise<PushSubscriptionSummary[]> {
    const col = await getMongoCollection<StoredSubscription>('push_subscriptions');
    if (col) {
      const docs = await col
        .find({}, { projection: { _id: 0 } })
        .sort({ createdAt: -1 })
        .toArray();
      return docs.map((sub) => this.toSummary(sub));
    }

    return Array.from(this.subscriptions.values()).map((sub) =>
      this.toSummary(sub)
    );
  }

  async subscribe(input: {
    subscription: PushSubscription;
    deviceLabel: string;
    locale: string;
    topics: NotificationCategory[];
  }): Promise<PushSubscriptionSummary> {
    const col = await getMongoCollection<StoredSubscription>('push_subscriptions');
    const existing = col
      ? await col.findOne(
          { 'subscription.endpoint': input.subscription.endpoint },
          { projection: { _id: 0 } }
        )
      : Array.from(this.subscriptions.values()).find(
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
    if (col) {
      await col.updateOne(
        { 'subscription.endpoint': input.subscription.endpoint },
        { $set: record },
        { upsert: true }
      );
    }

    return this.toSummary(record);
  }

  async unsubscribe(subscriptionId: string): Promise<boolean> {
    const col = await getMongoCollection<StoredSubscription>('push_subscriptions');
    const localDeleted = this.subscriptions.delete(subscriptionId);
    if (col) {
      const res = await col.deleteOne({ id: subscriptionId });
      return res.deletedCount > 0 || localDeleted;
    }
    return localDeleted;
  }

  async listCampaigns(): Promise<NotificationCampaign[]> {
    await this.ensureSeedCampaignsInMongo();
    const col = await getMongoCollection<NotificationCampaign>(
      'notification_campaigns'
    );
    if (col) {
      return col
        .find({}, { projection: { _id: 0 } })
        .sort({ updatedAt: -1 })
        .toArray();
    }

    return Array.from(this.campaigns.values()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  }

  async listDeliveryLogs(): Promise<NotificationDeliveryLog[]> {
    const col = await getMongoCollection<NotificationDeliveryLog>(
      'notification_delivery_logs'
    );
    if (col) {
      return col
        .find({}, { projection: { _id: 0 } })
        .sort({ sentAt: -1 })
        .limit(30)
        .toArray();
    }
    return this.deliveryLogs.slice(0, 30);
  }

  async createCampaign(input: {
    title: string;
    body: string;
    category: NotificationCategory;
    locale: string;
    targetUrl: string;
    status: NotificationStatus;
    scheduledFor: string | null;
  }): Promise<NotificationCampaign> {
    await this.ensureSeedCampaignsInMongo();
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
    const col = await getMongoCollection<NotificationCampaign>(
      'notification_campaigns'
    );
    if (col) {
      await col.insertOne({ ...campaign });
    }
    return campaign;
  }

  async updateCampaign(
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
  ): Promise<NotificationCampaign | undefined> {
    const col = await getMongoCollection<NotificationCampaign>(
      'notification_campaigns'
    );
    if (col) {
      const existing = await col.findOne({ id }, { projection: { _id: 0 } });
      if (!existing) return undefined;
      const updated: NotificationCampaign = {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      await col.updateOne({ id }, { $set: updated });
      this.campaigns.set(id, updated);
      return updated;
    }

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

  async deleteCampaign(id: string): Promise<boolean> {
    const localDeleted = this.campaigns.delete(id);
    const col = await getMongoCollection<NotificationCampaign>(
      'notification_campaigns'
    );
    if (col) {
      const res = await col.deleteOne({ id });
      return res.deletedCount > 0 || localDeleted;
    }
    return localDeleted;
  }

  async sendCampaign(id: string): Promise<{
    campaign: NotificationCampaign;
    log: NotificationDeliveryLog;
  } | null> {
    const campaignCol = await getMongoCollection<NotificationCampaign>(
      'notification_campaigns'
    );
    const subCol = await getMongoCollection<StoredSubscription>('push_subscriptions');
    const logCol = await getMongoCollection<NotificationDeliveryLog>(
      'notification_delivery_logs'
    );

    const campaign = campaignCol
      ? await campaignCol.findOne({ id }, { projection: { _id: 0 } })
      : this.campaigns.get(id) ?? null;

    if (!campaign) return null;

    const allSubs = subCol
      ? await subCol.find({}, { projection: { _id: 0 } }).toArray()
      : Array.from(this.subscriptions.values());

    const matchingSubs = allSubs.filter((sub) =>
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
          if (subCol) {
            await subCol.deleteOne({ id: sub.id }).catch(() => undefined);
          }
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
    if (campaignCol) {
      await campaignCol.updateOne({ id }, { $set: updated });
    }

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
    if (logCol) {
      await logCol.insertOne({ ...log });
    }

    return { campaign: updated, log };
  }

  private toSummary(sub: StoredSubscription): PushSubscriptionSummary {
    return {
      id: sub.id,
      endpointPreview: this.maskEndpoint(sub.subscription.endpoint),
      deviceLabel: sub.deviceLabel,
      locale: sub.locale,
      topics: sub.topics,
      createdAt: sub.createdAt,
    };
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

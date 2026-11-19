import { MongoClient, type Collection, type Db, type Document } from 'mongodb';
import { env } from '../config/env.ts';

let client: MongoClient | null = null;
let database: Db | null = null;
let connectPromise: Promise<Db | null> | null = null;
let lastConnectionError: string | null = null;
let indexesEnsured = false;

export async function connectMongo(): Promise<Db | null> {
  if (database) return database;
  if (!env.MONGODB_URI?.trim()) {
    lastConnectionError = 'MONGODB_URI is not configured';
    return null;
  }

  if (!connectPromise) {
    connectPromise = (async () => {
      try {
        const nextClient = new MongoClient(env.MONGODB_URI.trim(), {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
        });
        await nextClient.connect();
        const db = nextClient.db(env.MONGODB_DATABASE || 'tm_lingo');
        await db.command({ ping: 1 });

        client = nextClient;
        database = db;
        lastConnectionError = null;

        if (!indexesEnsured) {
          indexesEnsured = true;
          await ensureIndexes(db);
        }

        console.log(
          `[MongoDB] Connected to database "${db.databaseName}" successfully.`
        );
        return db;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown MongoDB connection error';
        lastConnectionError = message;
        console.warn(`[MongoDB] Connection unavailable, using fallback: ${message}`);
        connectPromise = null;
        return null;
      }
    })();
  }

  return connectPromise;
}

async function ensureIndexes(db: Db): Promise<void> {
  await Promise.allSettled([
    db.collection('learners').createIndex({ id: 1 }, { unique: true }),
    db.collection('learners').createIndex({ parentAccountId: 1 }),
    db.collection('lesson_progress').createIndex(
      {
        parentAccountId: 1,
        learnerId: 1,
        lessonId: 1,
        learningLocale: 1,
        mode: 1,
      },
      { unique: true }
    ),
    db.collection('story_positions').createIndex(
      { parentAccountId: 1, learnerId: 1, storyId: 1 },
      { unique: true }
    ),
    db
      .collection('push_subscriptions')
      .createIndex({ 'subscription.endpoint': 1 }, { unique: true }),
    db
      .collection('notification_campaigns')
      .createIndex({ id: 1 }, { unique: true }),
    db
      .collection('notification_delivery_logs')
      .createIndex({ sentAt: -1 }),
    db.collection('media_assets').createIndex({ id: 1 }, { unique: true }),
    db.collection('media_assets').createIndex({ parentAccountId: 1, createdAt: -1 }),
    db.collection('user_roles').createIndex({ userId: 1 }, { unique: true }),
    db.collection('user_roles').createIndex({ email: 1 }),
  ]);
}

export async function getMongoCollection<T extends Document>(
  name: string
): Promise<Collection<T> | null> {
  const db = await connectMongo();
  return db ? db.collection<T>(name) : null;
}

export function getMongoStatus() {
  return {
    configured: Boolean(env.MONGODB_URI?.trim()),
    connected: Boolean(database),
    databaseName: env.MONGODB_DATABASE || 'tm_lingo',
    lastError: lastConnectionError,
  };
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close().catch(() => undefined);
    client = null;
    database = null;
    connectPromise = null;
  }
}

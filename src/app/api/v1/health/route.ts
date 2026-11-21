import { NextResponse } from 'next/server';
import {
  getRuntimeEnvironmentSummary,
  isTmHubConfigured,
} from '../../../../../server/config/env';
import { getMongoStatus } from '../../../../../server/db/mongo';
import { ensureServerInit } from '../../../../../server/auth/guards';
import { getActiveStorageSummary } from '../../../../../server/providers/storageManager';

export async function GET() {
  await ensureServerInit();
  const mongo = getMongoStatus();
  const storage = await getActiveStorageSummary();

  return NextResponse.json({
    status: 'ok',
    service: 'tm-lingo-api',
    version: '2.0',
    environment: getRuntimeEnvironmentSummary({
      connected: mongo.connected,
      lastError: mongo.lastError,
    }),
    iamMode: isTmHubConfigured() ? 'tm-hub' : 'local-dev',
    storageBucket: storage.bucket,
    storageProvider: storage.provider,
    timestamp: new Date().toISOString(),
  });
}

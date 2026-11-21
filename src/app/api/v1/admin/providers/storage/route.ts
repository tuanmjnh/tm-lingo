import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../server/auth/hubClient';
import {
  listStorageConnections,
  upsertStorageConnection,
} from '../../../../../../../server/providers/storageManager';

const upsertStorageSchema = z.object({
  connectionId: z.string().max(80).optional(),
  name: z.string().min(1).max(80),
  provider: z.enum(['cloudflare_r2', 'aws_s3', 's3_compatible']),
  endpoint: z.string().url().max(240),
  region: z.string().max(40).optional(),
  bucket: z.string().min(1).max(120),
  publicBaseUrl: z.string().max(240).optional(),
  pathPrefix: z.string().max(120).optional(),
  accessKeyId: z.string().max(256).optional(),
  secretAccessKey: z.string().max(512).optional(),
  isDefault: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.providers.manage',
    async () => {
      const includeArchived =
        request.nextUrl.searchParams.get('includeArchived') === '1';
      const data = await listStorageConnections({ includeArchived });
      return NextResponse.json(data);
    }
  );
}

export async function POST(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.providers.manage',
    async ({ staff }) => {
      const body = await request.json().catch(() => ({}));
      const parsed = upsertStorageSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid storage provider configuration', 400);
      }

      try {
        const connection = await upsertStorageConnection(parsed.data);
        await recordStaffAudit({
          action: 'provider.storage.upsert',
          modelName: 'storage_connections',
          docId: connection.connectionId,
          actorName: staff.displayName || staff.email || 'Admin',
          actorEmail: staff.email || undefined,
          summary: `Saved storage connection "${connection.name}" (${connection.provider})`,
        });
        return NextResponse.json({ connection }, { status: 201 });
      } catch (err) {
        return jsonError(
          err instanceof Error ? err.message : 'Failed to save storage provider',
          400
        );
      }
    }
  );
}

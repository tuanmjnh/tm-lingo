import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../../server/auth/hubClient';
import {
  getSupportedAIProviders,
  listAIConnections,
  upsertAIConnection,
} from '../../../../../../../server/providers/aiManager';

const upsertAISchema = z.object({
  connectionId: z.string().max(80).optional(),
  providerKey: z.string().min(2).max(40),
  baseUrl: z.string().max(240).optional(),
  apiKey: z.string().max(512).optional(),
  enabled: z.boolean().optional(),
  models: z
    .array(
      z.object({
        modelId: z.string().min(1).max(120),
        displayName: z.string().max(120).optional(),
        enabled: z.boolean().optional(),
        isPrimary: z.boolean().optional(),
      })
    )
    .optional(),
});

export async function GET(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.providers.manage',
    async () => {
      const includeArchived =
        request.nextUrl.searchParams.get('includeArchived') === '1';
      const data = await listAIConnections({ includeArchived });
      return NextResponse.json({
        ...data,
        supportedProviders: getSupportedAIProviders(),
      });
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
      const parsed = upsertAISchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid AI provider configuration', 400);
      }

      try {
        const connection = await upsertAIConnection(parsed.data);
        await recordStaffAudit({
          action: 'provider.ai.upsert',
          modelName: 'ai_connections',
          docId: connection.connectionId,
          actorName: staff.displayName || staff.email || 'Admin',
          actorEmail: staff.email || undefined,
          summary: `Saved AI provider ${connection.providerName} (${connection.connectionId})`,
        });
        return NextResponse.json({ connection }, { status: 201 });
      } catch (err) {
        return jsonError(
          err instanceof Error ? err.message : 'Failed to save AI provider',
          400
        );
      }
    }
  );
}

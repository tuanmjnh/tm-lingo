import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../../../../server/auth/guards';
import { updateAIConnectionModels } from '../../../../../../../../../server/providers/aiManager';

const updateModelsSchema = z.object({
  models: z.array(
    z.object({
      modelId: z.string().min(1).max(120),
      displayName: z.string().min(1).max(120),
      enabled: z.boolean(),
      isPrimary: z.boolean().optional(),
      discoveredAt: z.string().optional(),
    })
  ),
});

type RouteContext = { params: Promise<{ connectionId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  return withStaffCapability(
    request,
    context,
    'tm-lingo.providers.manage',
    async () => {
      const { connectionId } = await context.params;
      const body = await request.json().catch(() => ({}));
      const parsed = updateModelsSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid models update payload', 400);
      }

      const updated = await updateAIConnectionModels(
        connectionId,
        parsed.data.models.map((m) => ({
          modelId: m.modelId,
          displayName: m.displayName,
          enabled: m.enabled,
          isPrimary: Boolean(m.isPrimary),
          discoveredAt: m.discoveredAt,
        }))
      );
      if (!updated) {
        return jsonError('AI connection not found', 404);
      }
      return NextResponse.json({ connection: updated });
    }
  );
}

import { NextRequest, NextResponse } from 'next/server';
import {
  jsonError,
  withStaffCapability,
} from '../../../../../../server/auth/guards';
import { recordStaffAudit } from '../../../../../../server/auth/hubClient';
import {
  listLearningMedia,
  uploadLearningMedia,
} from '../../../../../../server/modules/storage';

export async function GET(request: NextRequest) {
  return withStaffCapability(request, {}, 'tm-lingo.content.read', async () => {
    const includeArchived =
      request.nextUrl.searchParams.get('includeArchived') === '1';
    const result = await listLearningMedia({ includeArchived });
    return NextResponse.json(result);
  });
}

export async function POST(request: NextRequest) {
  return withStaffCapability(
    request,
    {},
    'tm-lingo.media.write',
    async ({ staff }) => {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return jsonError('Please select an image or audio file.', 400);
      }

      const title = (formData.get('title') as string | null) || '';
      const locale = (formData.get('locale') as string | null) || 'en';
      const arrayBuffer = await file.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      try {
        const asset = await uploadLearningMedia({
          parentAccountId: staff.id,
          title: title.slice(0, 80) || file.name,
          locale: locale.slice(0, 10),
          fileBuffer,
          originalName: file.name,
          mimeType: file.type,
        });
        await recordStaffAudit({
          action: 'media.upload',
          modelName: 'media_assets',
          docId: asset.id,
          actorName: staff.displayName || staff.email || 'Staff',
          actorEmail: staff.email || undefined,
          summary: `Uploaded ${asset.kind} "${asset.title}" to ${asset.storageBucket}`,
        });
        return NextResponse.json({ asset }, { status: 201 });
      } catch (err) {
        return jsonError(
          err instanceof Error ? err.message : 'Media upload failed',
          400
        );
      }
    }
  );
}

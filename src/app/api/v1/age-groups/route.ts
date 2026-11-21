import { NextResponse } from 'next/server';
import { ensureServerInit } from '../../../../../server/auth/guards';
import { listAgeGroups } from '../../../../../server/data/ageGroupRepository';

export async function GET() {
  await ensureServerInit();
  const ageGroups = await listAgeGroups({
    includeArchived: false,
    enabledOnly: true,
  });
  return NextResponse.json({ ageGroups });
}

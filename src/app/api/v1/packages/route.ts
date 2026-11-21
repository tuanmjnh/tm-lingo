import { NextRequest, NextResponse } from 'next/server';
import { ensureServerInit } from '../../../../../server/auth/guards';
import { listPublishedPackageSummaries } from '../../../../../server/data/cmsRepository';

export async function GET(request: NextRequest) {
  await ensureServerInit();
  const ageBand = request.nextUrl.searchParams.get('ageBand')?.trim();
  const allPackages = await listPublishedPackageSummaries();
  const packages = ageBand
    ? allPackages.filter(
        (pkg) => pkg.ageBand.length === 0 || pkg.ageBand.includes(ageBand)
      )
    : allPackages;
  return NextResponse.json({ packages });
}

import { NextRequest, NextResponse } from 'next/server';
import {
  clearStaffCookies,
  logoutStaffSession,
} from '../../../../../../../server/auth/hubClient';

export async function POST(request: NextRequest) {
  await logoutStaffSession(request);
  const response = NextResponse.json({ ok: true });
  clearStaffCookies(response, request);
  return response;
}

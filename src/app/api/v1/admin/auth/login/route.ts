import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureServerInit, jsonError } from '../../../../../../../server/auth/guards';
import {
  createStaffSessionRecord,
  loginStaffWithCredentials,
  setStaffCookies,
} from '../../../../../../../server/auth/hubClient';
import { isTmHubConfigured } from '../../../../../../../server/config/env';

const loginSchema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(4).max(128),
});

export async function POST(request: NextRequest) {
  await ensureServerInit();
  const body = await request.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Please enter a valid staff email and password.', 400);
  }

  try {
    const result = await loginStaffWithCredentials(parsed.data);
    const sessionId = await createStaffSessionRecord({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      userId: result.user.id,
      maxAgeSeconds: result.expiresIn,
    });

    const response = NextResponse.json(
      {
        user: result.user,
        iamMode: isTmHubConfigured() ? 'tm-hub' : 'local-dev',
        accessToken: result.accessToken,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
    setStaffCookies(
      response,
      {
        sessionId,
        refreshToken: result.refreshToken,
        maxAgeSeconds: result.expiresIn,
      },
      request
    );
    return response;
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : 'Staff sign-in failed',
      401
    );
  }
}

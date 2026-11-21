import { NextRequest, NextResponse } from 'next/server';
import type {
  AuthUserProfile,
  DeleteMode,
} from '../../packages/contracts/types';
import { isRootStaff } from '../../packages/contracts/permissions';
import { connectMongo } from '../db/mongo';
import { getParentUserFromRequest } from './firebaseAuth';
import {
  hasStaffCapability,
  resolveStaffSessionFromRequest,
  setStaffCookies,
} from './hubClient';

export const GUEST_PARENT_ID = 'parent-demo-01';

let initPromise: Promise<void> | null = null;

export function ensureServerInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await connectMongo();
    })().catch((err) => {
      console.error('[Server Init Error]', err);
      initPromise = null;
    });
  }
  return initPromise;
}

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function enforceHardDeleteRootGuard(
  staff: AuthUserProfile,
  mode: DeleteMode
): NextResponse | null {
  if (mode === 'hard' && !isRootStaff(staff)) {
    return jsonError(
      'Forbidden: Permanent deletion (Hard Delete) requires the root role.',
      403
    );
  }
  return null;
}

export function resolveParentId(user: AuthUserProfile | null): string {
  return user?.id ?? GUEST_PARENT_ID;
}

export async function withParentAuth<TContext = unknown>(
  request: NextRequest,
  context: TContext,
  options: { allowGuest?: boolean },
  handler: (args: {
    request: NextRequest;
    context: TContext;
    parent: AuthUserProfile | null;
    parentAccountId: string;
  }) => Promise<NextResponse>
): Promise<NextResponse> {
  await ensureServerInit();
  const parent = await getParentUserFromRequest(request);

  if (!parent && !options.allowGuest) {
    return jsonError('Parent authentication required. Please sign in with Firebase.', 401);
  }

  return handler({
    request,
    context,
    parent,
    parentAccountId: resolveParentId(parent),
  });
}

export async function withStaffCapability<TContext = unknown>(
  request: NextRequest,
  context: TContext,
  requiredCapability: string | undefined,
  handler: (args: {
    request: NextRequest;
    context: TContext;
    staff: AuthUserProfile;
    accessToken: string;
  }) => Promise<NextResponse>
): Promise<NextResponse> {
  await ensureServerInit();

  const session = await resolveStaffSessionFromRequest(request);
  if (!session) {
    return jsonError('Staff authentication required. Please sign in to the Admin Portal.', 401);
  }

  if (requiredCapability && !hasStaffCapability(session.user, requiredCapability)) {
    return jsonError(
      `Forbidden: missing required capability "${requiredCapability}".`,
      403
    );
  }

  const response = await handler({
    request,
    context,
    staff: session.user,
    accessToken: session.accessToken,
  });

  // If access token was silently refreshed via TM-Hub, update HttpOnly cookies on response
  if (session.refreshedTokens) {
    setStaffCookies(response, {
      accessToken: session.refreshedTokens.accessToken,
      refreshToken: session.refreshedTokens.refreshToken,
      maxAgeSeconds: session.refreshedTokens.expiresIn,
    });
  }

  return response;
}

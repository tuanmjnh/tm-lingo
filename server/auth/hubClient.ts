import { createHubClient, type HubClient } from '@tuanmjnh/tm-hub-client';
import { createLocalJWKSet, jwtVerify, SignJWT, type JSONWebKeySet } from 'jose';
import type { NextRequest, NextResponse } from 'next/server';
import type {
  AuthUserProfile,
  ManagedUserRecord,
  StaffAuditLogEntry,
  StaffRoleRecord,
  UserRole,
} from '../../packages/contracts/types';
import {
  HARD_DELETE_CAPABILITY,
  isRootRoleList,
  isRootStaff,
} from '../../packages/contracts/permissions';
import { env, isTmHubConfigured } from '../config/env';
import { getMongoCollection } from '../db/mongo';

export { HARD_DELETE_CAPABILITY, isRootStaff };

export const STAFF_ACCESS_COOKIE = 'tm_lingo_staff_token';
export const STAFF_REFRESH_COOKIE = 'tm_lingo_staff_refresh';

const LOCAL_STAFF_ISSUER = 'tm-lingo-local-staff';
const LOCAL_STAFF_AUDIENCE = 'tm-lingo-admin';

const ADMIN_CAPABILITIES = [
  'tm-lingo.content.read',
  'tm-lingo.content.write',
  'tm-lingo.content.review',
  'tm-lingo.content.publish',
  'tm-lingo.media.write',
  'tm-lingo.notifications.manage',
  'tm-lingo.providers.manage',
  'users.read',
  'users.update',
  'roles.read',
  'logs.read',
  'apps.logs.read',
];

const ROOT_CAPABILITIES = ['*', HARD_DELETE_CAPABILITY, ...ADMIN_CAPABILITIES];

const TEACHER_CAPABILITIES = [
  'tm-lingo.content.read',
  'tm-lingo.content.write',
  'tm-lingo.content.review',
  'tm-lingo.media.write',
  'tm-lingo.notifications.manage',
];

function getLocalSigningSecret(): Uint8Array {
  return new TextEncoder().encode(
    env.SESSION_SECRET.trim() || 'tm-lingo-local-dev-session-secret'
  );
}

export function createServerHubClient(options?: {
  accessToken?: string | null;
  refreshToken?: string | null;
}): HubClient {
  return createHubClient({
    baseUrl: env.HUB_BASE_URL.trim() || 'http://localhost:4000',
    appId: env.HUB_APP_ID.trim() || 'tm-lingo',
    getAccessToken: () => options?.accessToken ?? null,
    getRefreshToken: () => options?.refreshToken ?? null,
    getDeviceCredential: () =>
      env.HUB_DEVICE_ID.trim() && env.HUB_DEVICE_SECRET.trim()
        ? {
            deviceId: env.HUB_DEVICE_ID.trim(),
            secret: env.HUB_DEVICE_SECRET.trim(),
          }
        : null,
    getAppSecret: () => env.HUB_APP_SECRET.trim() || null,
  });
}

let cachedHubJwks: {
  jwks: ReturnType<typeof createLocalJWKSet>;
  expiresAt: number;
} | null = null;

async function getHubJwksVerifier() {
  if (cachedHubJwks && cachedHubJwks.expiresAt > Date.now()) {
    return cachedHubJwks.jwks;
  }
  const hub = createServerHubClient();
  const res = await hub.auth.jwks();
  const keySet: JSONWebKeySet = {
    keys: (res.keys ?? []).map((k) => ({
      kty: k.kty,
      kid: k.kid,
      alg: k.alg ?? 'RS256',
      use: k.use ?? 'sig',
      n: k.n,
      e: k.e,
    })),
  };
  const jwks = createLocalJWKSet(keySet);
  cachedHubJwks = {
    jwks,
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  return jwks;
}

export function setStaffCookies(
  response: NextResponse,
  tokens: { accessToken: string; refreshToken?: string | null; maxAgeSeconds?: number }
): void {
  const isProd = env.NODE_ENV === 'production';
  response.cookies.set(STAFF_ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: tokens.maxAgeSeconds ?? 60 * 60 * 8,
  });
  if (tokens.refreshToken) {
    response.cookies.set(STAFF_REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: 60 * 60 * 24 * 14,
    });
  }
}

export function clearStaffCookies(response: NextResponse): void {
  const isProd = env.NODE_ENV === 'production';
  response.cookies.set(STAFF_ACCESS_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 0,
  });
  response.cookies.set(STAFF_REFRESH_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 0,
  });
}

function derivePrimaryStaffRole(roles: string[], capabilities: string[]): UserRole {
  const lowerRoles = roles.map((r) => r.toLowerCase());
  if (
    lowerRoles.some(
      (r) => r === 'admin' || r === 'super_admin' || r === 'superadmin' || r === 'root'
    ) ||
    capabilities.includes('*') ||
    capabilities.includes('tm-lingo.providers.manage') ||
    capabilities.includes('users.read')
  ) {
    return 'admin';
  }
  return 'teacher';
}

export interface StaffLoginResult {
  user: AuthUserProfile;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export async function loginStaffWithCredentials(input: {
  email: string;
  password: string;
}): Promise<StaffLoginResult> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (isTmHubConfigured()) {
    const hub = createServerHubClient();
    const res = await hub.auth.login({
      email,
      password,
      platform: 'web',
    });

    if (!res.success || !res.data) {
      throw new Error(res.error || res.message || 'TM-Hub authentication failed');
    }

    if (res.data.totpRequired) {
      throw new Error('This TM-Hub staff account requires 2FA verification.');
    }

    const hubUser = res.data.user;
    const roles = hubUser.roles ?? [];
    const capabilities = hubUser.permissions ?? [];
    const primaryRole = derivePrimaryStaffRole(roles, capabilities);

    const profile: AuthUserProfile = {
      id: hubUser.id,
      email: hubUser.email,
      displayName: hubUser.name || hubUser.email,
      role: primaryRole,
      provider: 'tm-hub',
      roles,
      capabilities,
    };

    await recordStaffAudit({
      action: 'staff.login',
      modelName: 'staff_session',
      docId: profile.id,
      actorName: profile.displayName || profile.email || 'Staff',
      actorEmail: profile.email || undefined,
      summary: `Staff signed in via TM-Hub (${roles.join(', ') || primaryRole})`,
    });

    return {
      user: profile,
      accessToken: res.data.accessToken,
      refreshToken: res.data.refreshToken,
      expiresIn: res.data.expiresIn,
    };
  }

  // Local dev fallback ONLY when HUB_BASE_URL is not configured
  const seedRootEmail = env.SEED_ROOT_EMAIL.trim().toLowerCase();
  const seedRootPassword = (
    env.SEED_ROOT_PASSWORD.trim() || env.SEED_ADMIN_PASSWORD.trim()
  );
  const seedAdminEmail = env.SEED_ADMIN_EMAIL.trim().toLowerCase();
  const seedAdminPassword = env.SEED_ADMIN_PASSWORD.trim();

  let matchedRole: 'admin' | 'teacher' | null = null;
  let matchedRoles: string[] = [];
  let matchedCapabilities: string[] = [];
  let matchedName = 'TM-Lingo System Admin';
  let matchedId = 'local-staff-admin';

  if (email === seedRootEmail && password === seedRootPassword) {
    matchedRole = 'admin';
    matchedRoles = ['root'];
    matchedCapabilities = ROOT_CAPABILITIES;
    matchedName = 'TM-Lingo Root';
    matchedId = 'local-staff-root';
  } else if (email === seedAdminEmail && password === seedAdminPassword) {
    matchedRole = 'admin';
    matchedRoles = ['admin'];
    matchedCapabilities = ADMIN_CAPABILITIES;
    matchedName = 'TM-Lingo System Admin';
    matchedId = 'local-staff-admin';
  } else if (email === 'teacher@tm-lingo.app' && password === seedAdminPassword) {
    matchedRole = 'teacher';
    matchedRoles = ['teacher'];
    matchedCapabilities = TEACHER_CAPABILITIES;
    matchedName = 'TM-Lingo Teacher';
    matchedId = 'local-staff-teacher';
  }

  if (!matchedRole) {
    throw new Error(
      'Invalid staff credentials. Configure HUB_BASE_URL to sign in with TM-Hub, or use the local staff credentials.'
    );
  }

  const accessToken = await new SignJWT({
    sub: matchedId,
    email,
    name: matchedName,
    role: matchedRole,
    roles: matchedRoles,
    capabilities: matchedCapabilities,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(LOCAL_STAFF_ISSUER)
    .setAudience(LOCAL_STAFF_AUDIENCE)
    .setExpirationTime('8h')
    .sign(getLocalSigningSecret());

  const profile: AuthUserProfile = {
    id: matchedId,
    email,
    displayName: matchedName,
    role: matchedRole,
    provider: 'local-staff',
    roles: matchedRoles,
    capabilities: matchedCapabilities,
  };

  await ensureLocalStaffRecords();
  await recordStaffAudit({
    action: 'staff.login',
    modelName: 'staff_session',
    docId: profile.id,
    actorName: profile.displayName || email,
    actorEmail: email,
    summary: `Local staff signed in (${matchedRoles.join(', ')})`,
  });

  return {
    user: profile,
    accessToken,
    expiresIn: 60 * 60 * 8,
  };
}

export interface ResolvedStaffSession {
  user: AuthUserProfile;
  accessToken: string;
  refreshedTokens?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

async function verifyLocalStaffToken(token: string): Promise<AuthUserProfile | null> {
  try {
    const { payload } = await jwtVerify(token, getLocalSigningSecret(), {
      issuer: LOCAL_STAFF_ISSUER,
      audience: LOCAL_STAFF_AUDIENCE,
    });
    const id = typeof payload.sub === 'string' ? payload.sub : '';
    const email = typeof payload.email === 'string' ? payload.email : null;
    const name = typeof payload.name === 'string' ? payload.name : email;
    const role = payload.role === 'admin' ? 'admin' : 'teacher';
    const roles = Array.isArray(payload.roles)
      ? payload.roles.filter((r): r is string => typeof r === 'string')
      : [role];
    const capabilities = Array.isArray(payload.capabilities)
      ? payload.capabilities.filter((c): c is string => typeof c === 'string')
      : isRootRoleList(roles)
        ? ROOT_CAPABILITIES
        : role === 'admin'
          ? ADMIN_CAPABILITIES
          : TEACHER_CAPABILITIES;

    if (!id) return null;
    return {
      id,
      email,
      displayName: name,
      role,
      provider: 'local-staff',
      roles,
      capabilities,
    };
  } catch {
    return null;
  }
}

async function resolveHubStaffFromToken(
  accessToken: string
): Promise<AuthUserProfile | null> {
  const hub = createServerHubClient({ accessToken });

  // Fast path: verify RS256 via TM-Hub JWKS if available, then enrich permissions
  let verifiedByJwks = false;
  try {
    const jwks = await getHubJwksVerifier();
    await jwtVerify(accessToken, jwks, { algorithms: ['RS256'] });
    verifiedByJwks = true;
  } catch {
    verifiedByJwks = false;
  }

  try {
    const [meRes, permRes] = await Promise.all([
      hub.auth.me(),
      hub.auth.permissions().catch(() => null),
    ]);
    if (!meRes.success || !meRes.data) return null;

    const roles = permRes?.data?.roles ?? meRes.data.roles ?? [];
    const capabilities =
      permRes?.data?.permissions ?? meRes.data.permissions ?? [];
    const primaryRole = derivePrimaryStaffRole(roles, capabilities);

    return {
      id: meRes.data.id,
      email: meRes.data.email ?? null,
      displayName: meRes.data.name ?? meRes.data.email ?? null,
      role: primaryRole,
      provider: 'tm-hub',
      roles,
      capabilities,
    };
  } catch {
    if (!verifiedByJwks) return null;
    return null;
  }
}

export async function resolveStaffSessionFromRequest(
  request: NextRequest
): Promise<ResolvedStaffSession | null> {
  const accessToken = request.cookies.get(STAFF_ACCESS_COOKIE)?.value?.trim();
  const refreshToken = request.cookies.get(STAFF_REFRESH_COOKIE)?.value?.trim();

  if (!accessToken && !refreshToken) return null;

  if (!isTmHubConfigured()) {
    if (!accessToken) return null;
    const localUser = await verifyLocalStaffToken(accessToken);
    if (!localUser) return null;
    return { user: localUser, accessToken };
  }

  if (accessToken) {
    const user = await resolveHubStaffFromToken(accessToken);
    if (user) {
      return { user, accessToken };
    }
  }

  // Silent single refresh if access token expired and refresh cookie is present
  if (refreshToken) {
    try {
      const hub = createServerHubClient();
      const refreshRes = await hub.auth.refresh(refreshToken);
      if (refreshRes.success && refreshRes.data?.accessToken) {
        const nextTokens = refreshRes.data;
        const user = await resolveHubStaffFromToken(nextTokens.accessToken);
        if (user) {
          return {
            user,
            accessToken: nextTokens.accessToken,
            refreshedTokens: {
              accessToken: nextTokens.accessToken,
              refreshToken: nextTokens.refreshToken,
              expiresIn: nextTokens.expiresIn,
            },
          };
        }
      }
    } catch {
      return null;
    }
  }

  return null;
}

export async function logoutStaffSession(request: NextRequest): Promise<void> {
  const accessToken = request.cookies.get(STAFF_ACCESS_COOKIE)?.value?.trim();
  const refreshToken = request.cookies.get(STAFF_REFRESH_COOKIE)?.value?.trim();

  if (isTmHubConfigured() && (accessToken || refreshToken)) {
    try {
      const hub = createServerHubClient({ accessToken, refreshToken });
      await hub.auth.logout(refreshToken);
    } catch {
      // Ignore upstream logout failure when clearing local cookies
    }
  }
}

export function hasStaffCapability(
  user: AuthUserProfile,
  requiredCapability?: string
): boolean {
  if (!requiredCapability) return true;
  if (requiredCapability === HARD_DELETE_CAPABILITY) {
    return isRootStaff(user);
  }

  const caps = user.capabilities ?? [];
  if (caps.includes('*')) return true;
  if (caps.includes(requiredCapability)) return true;

  // Support legacy aliases between TM-Hub standard capabilities and TM-Lingo namespaces
  const aliasMap: Record<string, string[]> = {
    'tm-lingo.content.read': ['content.read', 'apps.read'],
    'tm-lingo.content.write': ['content.write', 'content.manage'],
    'tm-lingo.content.review': ['content.review', 'content.manage'],
    'tm-lingo.content.publish': ['content.publish', 'content.manage'],
    'tm-lingo.media.write': ['media.upload', 'media.write', 'media.delete'],
    'tm-lingo.notifications.manage': ['notifications.manage', 'notifications.send'],
    'tm-lingo.providers.manage': ['connections.write', 'configs.write'],
    'users.read': ['users.manage', 'users.update'],
    'users.update': ['users.manage'],
    'logs.read': ['apps.logs.read', 'platform.audit.read'],
  };

  const aliases = aliasMap[requiredCapability] ?? [];
  if (aliases.some((alias) => caps.includes(alias))) return true;

  if (user.role === 'admin' && user.provider === 'local-staff') return true;
  return false;
}

// Local fallback staff user store (used ONLY when TM-Hub is not configured)
const localStaffMemory: Map<string, ManagedUserRecord> = new Map();
const localAuditMemory: StaffAuditLogEntry[] = [];

async function ensureLocalStaffRecords(): Promise<void> {
  const now = new Date().toISOString();
  const defaults: ManagedUserRecord[] = [
    {
      userId: 'local-staff-root',
      email: env.SEED_ROOT_EMAIL.trim().toLowerCase(),
      displayName: 'TM-Lingo Root',
      role: 'admin',
      roles: ['root'],
      isActive: true,
      source: 'local',
      createdAt: now,
      updatedAt: now,
    },
    {
      userId: 'local-staff-admin',
      email: env.SEED_ADMIN_EMAIL.trim().toLowerCase(),
      displayName: 'TM-Lingo System Admin',
      role: 'admin',
      roles: ['admin'],
      isActive: true,
      source: 'local',
      createdAt: now,
      updatedAt: now,
    },
    {
      userId: 'local-staff-teacher',
      email: 'teacher@tm-lingo.app',
      displayName: 'TM-Lingo Teacher',
      role: 'teacher',
      roles: ['teacher'],
      isActive: true,
      source: 'local',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const col = await getMongoCollection<ManagedUserRecord>('user_roles');
  for (const item of defaults) {
    if (!localStaffMemory.has(item.userId)) {
      localStaffMemory.set(item.userId, item);
    }
    if (col) {
      await col.updateOne(
        { userId: item.userId },
        { $setOnInsert: item },
        { upsert: true }
      );
    }
  }
}

export async function listStaffUsers(
  accessToken: string
): Promise<{ users: ManagedUserRecord[]; source: 'tm-hub' | 'local' }> {
  if (isTmHubConfigured()) {
    const hub = createServerHubClient({ accessToken });
    const res = await hub.users.list({ limit: 100 });
    const items = (res.data ?? []).map((u): ManagedUserRecord => {
      const roles = u.roles ?? (u.role ? [u.role] : []);
      const primaryRole = derivePrimaryStaffRole(roles, u.permissions ?? []);
      return {
        userId: u.id,
        email: u.email,
        displayName: u.name ?? u.username ?? u.email,
        role: primaryRole,
        roles,
        isActive: u.isActive ?? true,
        source: 'tm-hub',
        createdAt: u.createdAt ?? new Date().toISOString(),
        updatedAt: u.updatedAt ?? u.createdAt ?? new Date().toISOString(),
      };
    });
    return { users: items, source: 'tm-hub' };
  }

  await ensureLocalStaffRecords();
  const col = await getMongoCollection<ManagedUserRecord>('user_roles');
  if (col) {
    const docs = await col
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: 1 })
      .limit(100)
      .toArray();
    return { users: docs, source: 'local' };
  }
  return { users: Array.from(localStaffMemory.values()), source: 'local' };
}

export async function updateStaffUserRole(input: {
  accessToken: string;
  targetUserId: string;
  role: UserRole;
  actor: AuthUserProfile;
}): Promise<ManagedUserRecord | null> {
  if (isTmHubConfigured()) {
    const hub = createServerHubClient({ accessToken: input.accessToken });
    await hub.users.update(input.targetUserId, { role: input.role });
    const list = await listStaffUsers(input.accessToken);
    const updated = list.users.find((u) => u.userId === input.targetUserId) ?? null;
    await recordStaffAudit({
      action: 'staff.role.update',
      modelName: 'hub_user',
      docId: input.targetUserId,
      actorName: input.actor.displayName || input.actor.email || 'Admin',
      actorEmail: input.actor.email || undefined,
      summary: `Updated staff role to ${input.role} via TM-Hub`,
    });
    return updated;
  }

  await ensureLocalStaffRecords();
  const col = await getMongoCollection<ManagedUserRecord>('user_roles');
  const existing = col
    ? await col.findOne({ userId: input.targetUserId }, { projection: { _id: 0 } })
    : localStaffMemory.get(input.targetUserId) ?? null;
  if (!existing) return null;
  if (isRootRoleList(existing.roles) && !isRootStaff(input.actor)) {
    throw new Error('Forbidden: Only root can modify a root account.');
  }

  const updated: ManagedUserRecord = {
    ...existing,
    role: input.role,
    roles: isRootRoleList(existing.roles) ? ['root'] : [input.role],
    updatedAt: new Date().toISOString(),
  };
  localStaffMemory.set(updated.userId, updated);
  if (col) {
    await col.updateOne({ userId: updated.userId }, { $set: updated });
  }

  await recordStaffAudit({
    action: 'staff.role.update',
    modelName: 'user_roles',
    docId: updated.userId,
    actorName: input.actor.displayName || input.actor.email || 'Admin',
    actorEmail: input.actor.email || undefined,
    summary: `Updated local staff role for ${updated.email} to ${input.role}`,
  });

  return updated;
}

export async function listStaffRoles(
  accessToken: string
): Promise<{ roles: StaffRoleRecord[]; source: 'tm-hub' | 'local' }> {
  if (isTmHubConfigured()) {
    const hub = createServerHubClient({ accessToken });
    const res = await hub.roles.list({ limit: 50 });
    const roles: StaffRoleRecord[] = (res.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      permissions: (r.permissions ?? []).flatMap((p) =>
        p.actions.map((action) => `${p.module}.${action}`)
      ),
      isSystem: r.isSystem,
    }));
    return { roles, source: 'tm-hub' };
  }

  return {
    source: 'local',
    roles: [
      {
        id: 'role-root',
        name: 'root',
        description:
          'System Root — full administration plus exclusive Hard Delete (permanent removal) authority',
        permissions: ROOT_CAPABILITIES,
        isSystem: true,
      },
      {
        id: 'role-admin',
        name: 'admin',
        description:
          'TM-Lingo Administrator — providers, CMS publish, Soft Delete (Archive) & Restore, staff roles',
        permissions: ADMIN_CAPABILITIES,
        isSystem: true,
      },
      {
        id: 'role-teacher',
        name: 'teacher',
        description:
          'Curriculum authoring, media library & notification management (Soft Delete / Archive only)',
        permissions: TEACHER_CAPABILITIES,
        isSystem: true,
      },
    ],
  };
}

export async function recordStaffAudit(input: {
  action: string;
  modelName: string;
  docId: string;
  actorName: string;
  actorEmail?: string;
  summary: string;
}): Promise<void> {
  const entry: StaffAuditLogEntry = {
    id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    action: input.action,
    modelName: input.modelName,
    docId: input.docId,
    actorName: input.actorName,
    actorEmail: input.actorEmail,
    summary: input.summary,
    source: 'tm-lingo-local',
    at: new Date().toISOString(),
  };

  localAuditMemory.unshift(entry);
  if (localAuditMemory.length > 100) {
    localAuditMemory.length = 100;
  }

  try {
    const col = await getMongoCollection<StaffAuditLogEntry>('staff_audit_logs');
    if (col) {
      await col.insertOne({ ...entry });
    }
  } catch {
    // Non-blocking audit persistence
  }
}

export async function listStaffAuditLogs(
  accessToken: string,
  limit = 40
): Promise<{ logs: StaffAuditLogEntry[]; source: 'tm-hub' | 'local' }> {
  const combined: StaffAuditLogEntry[] = [];
  let source: 'tm-hub' | 'local' = 'local';

  if (isTmHubConfigured()) {
    try {
      const hub = createServerHubClient({ accessToken });
      const res = await hub.auditLogs.list({ limit });
      if (res.success && Array.isArray(res.data)) {
        source = 'tm-hub';
        for (const item of res.data) {
          combined.push({
            id: item._id,
            action: item.action,
            modelName: item.modelName,
            docId: item.docId,
            actorName: item.by?.name || item.by?.username || item.by?.email || 'Staff',
            actorEmail: item.by?.email,
            summary:
              item.summary ||
              `${item.action} on ${item.modelName} (${item.docId})`,
            source: 'tm-hub',
            at: new Date(item.at).toISOString(),
          });
        }
      }
    } catch {
      // Fallback to local audit logs if TM-Hub audit endpoint is unreachable
    }
  }

  const col = await getMongoCollection<StaffAuditLogEntry>('staff_audit_logs');
  const localDocs = col
    ? await col
        .find({}, { projection: { _id: 0 } })
        .sort({ at: -1 })
        .limit(limit)
        .toArray()
    : localAuditMemory.slice(0, limit);

  combined.push(...localDocs);
  combined.sort((a, b) => b.at.localeCompare(a.at));

  return {
    logs: combined.slice(0, limit),
    source,
  };
}

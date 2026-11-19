import type { ManagedUserRecord, UserRole } from '../../packages/contracts/types.ts';
import { env } from '../config/env.ts';
import { getMongoCollection } from '../db/mongo.ts';
import { getSupabaseAdmin } from './supabaseAuth.ts';

const memoryRoles: Map<string, ManagedUserRecord> = new Map();
let adminSeedAttempted = false;
let adminSeedReady = false;
let adminSeedError: string | null = null;

export function getAdminSeedStatus() {
  return {
    ready: adminSeedReady,
    error: adminSeedError,
  };
}

function isValidRole(value: unknown): value is UserRole {
  return value === 'parent' || value === 'teacher' || value === 'admin';
}

export async function ensureSeededAdminAccount(): Promise<void> {
  if (adminSeedAttempted) return;
  adminSeedAttempted = true;

  const adminEmail = env.SEED_ADMIN_EMAIL.trim().toLowerCase();
  const adminPassword = env.SEED_ADMIN_PASSWORD.trim();
  if (!adminEmail || adminPassword.length < 8) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  try {
    const { data: listData, error: listErr } =
      await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) {
      adminSeedError = listErr.message;
      console.warn(`[Auth] Unable to list users for admin seed: ${listErr.message}`);
      return;
    }

    let adminUser = listData.users.find(
      (u) => u.email?.toLowerCase() === adminEmail
    );

    if (!adminUser) {
      const { data: created, error: createErr } =
        await supabase.auth.admin.createUser({
          email: adminEmail,
          password: adminPassword,
          email_confirm: true,
          user_metadata: {
            full_name: 'TM-Lingo Admin',
          },
          app_metadata: {
            role: 'admin',
          },
        });
      if (createErr) {
        adminSeedError = createErr.message;
        console.warn(`[Auth] Unable to seed admin user: ${createErr.message}`);
        return;
      }
      adminUser = created.user;
      console.log(`[Auth] Created seeded admin account: ${adminEmail}`);
    } else if (adminUser.app_metadata?.role !== 'admin') {
      await supabase.auth.admin.updateUserById(adminUser.id, {
        app_metadata: { ...(adminUser.app_metadata ?? {}), role: 'admin' },
      });
    }

    if (adminUser) {
      await upsertUserRoleRecord({
        userId: adminUser.id,
        email: adminEmail,
        displayName: 'TM-Lingo Admin',
        role: 'admin',
      });
      adminSeedReady = true;
      adminSeedError = null;
      console.log(`[Auth] Seeded system admin ready: ${adminEmail}`);
    }
  } catch (err) {
    adminSeedError = err instanceof Error ? err.message : String(err);
    console.warn('[Auth] Admin seed skipped:', adminSeedError);
  }
}

export async function upsertUserRoleRecord(input: {
  userId: string;
  email: string;
  displayName: string | null;
  role: UserRole;
}): Promise<ManagedUserRecord> {
  const now = new Date().toISOString();
  const existing = memoryRoles.get(input.userId);
  const record: ManagedUserRecord = {
    userId: input.userId,
    email: input.email.toLowerCase(),
    displayName: input.displayName,
    role: input.role,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  memoryRoles.set(input.userId, record);

  const col = await getMongoCollection<ManagedUserRecord>('user_roles');
  if (col) {
    await col.updateOne(
      { userId: input.userId },
      {
        $set: {
          email: record.email,
          displayName: record.displayName,
          role: record.role,
          updatedAt: now,
        },
        $setOnInsert: {
          userId: input.userId,
          createdAt: now,
        },
      },
      { upsert: true }
    );
  }

  return record;
}

export async function resolveServerUserRole(input: {
  userId: string;
  email: string | null;
  displayName: string | null;
  appMetadataRole?: unknown;
}): Promise<UserRole> {
  const normalizedEmail = (input.email ?? '').trim().toLowerCase();
  const seedAdminEmail = env.SEED_ADMIN_EMAIL.trim().toLowerCase();

  // Seeded admin email always retains admin role
  if (normalizedEmail && normalizedEmail === seedAdminEmail) {
    await upsertUserRoleRecord({
      userId: input.userId,
      email: normalizedEmail,
      displayName: input.displayName,
      role: 'admin',
    });
    return 'admin';
  }

  const col = await getMongoCollection<ManagedUserRecord>('user_roles');
  if (col) {
    const existing = await col.findOne(
      { userId: input.userId },
      { projection: { _id: 0 } }
    );
    if (existing && isValidRole(existing.role)) {
      memoryRoles.set(input.userId, existing);
      return existing.role;
    }
  } else {
    const local = memoryRoles.get(input.userId);
    if (local && isValidRole(local.role)) {
      return local.role;
    }
  }

  const initialRole: UserRole = isValidRole(input.appMetadataRole)
    ? input.appMetadataRole
    : 'parent';

  await upsertUserRoleRecord({
    userId: input.userId,
    email: normalizedEmail || input.userId,
    displayName: input.displayName,
    role: initialRole,
  });

  return initialRole;
}

export async function listManagedUsers(): Promise<ManagedUserRecord[]> {
  const col = await getMongoCollection<ManagedUserRecord>('user_roles');
  if (col) {
    return col
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: 1 })
      .limit(200)
      .toArray();
  }
  return Array.from(memoryRoles.values()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
}

export async function setManagedUserRole(
  userId: string,
  nextRole: UserRole
): Promise<ManagedUserRecord | null> {
  const col = await getMongoCollection<ManagedUserRecord>('user_roles');
  const existing = col
    ? await col.findOne({ userId }, { projection: { _id: 0 } })
    : memoryRoles.get(userId) ?? null;

  if (!existing) return null;

  const updated = await upsertUserRoleRecord({
    userId: existing.userId,
    email: existing.email,
    displayName: existing.displayName,
    role: nextRole,
  });

  // Sync role into Supabase app_metadata as well (best-effort)
  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase.auth.admin
      .updateUserById(userId, {
        app_metadata: { role: nextRole },
      })
      .catch(() => undefined);
  }

  return updated;
}

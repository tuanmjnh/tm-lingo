import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.ts';
import type { AuthUserProfile } from '../../packages/contracts/types.ts';
import { resolveServerUserRole } from './roleStore.ts';

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUserProfile | null;
    }
  }
}

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (adminClient) return adminClient;
  const url = env.SUPABASE_URL?.trim();
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;

  adminClient = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return adminClient;
}

export function isSupabaseServerConfigured(): boolean {
  return Boolean(
    env.SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

export async function attachSupabaseUser(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  req.authUser = null;

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    next();
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    next();
    return;
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) {
      const metadata = data.user.user_metadata as Record<string, unknown> | undefined;
      const appMetadata = data.user.app_metadata as Record<string, unknown> | undefined;
      const displayName =
        typeof metadata?.full_name === 'string'
          ? metadata.full_name
          : typeof metadata?.name === 'string'
            ? metadata.name
            : data.user.email ?? null;

      const role = await resolveServerUserRole({
        userId: data.user.id,
        email: data.user.email ?? null,
        displayName,
        appMetadataRole: appMetadata?.role,
      });

      req.authUser = {
        id: data.user.id,
        email: data.user.email ?? null,
        displayName,
        role,
        provider: 'supabase',
      };
    }
  } catch {
    req.authUser = null;
  }

  next();
}

export function requireSupabaseAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.authUser) {
    res.status(401).json({
      error: 'Authentication required. Please sign in first.',
    });
    return;
  }
  next();
}

export function requireStaffRole(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.authUser) {
    res.status(401).json({
      error: 'Authentication required. Please sign in with an admin or teacher account.',
    });
    return;
  }
  if (req.authUser.role !== 'admin' && req.authUser.role !== 'teacher') {
    res.status(403).json({
      error: 'Forbidden. System administration is restricted to Admin and Teacher accounts.',
    });
    return;
  }
  next();
}

export function requireAdminRole(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.authUser) {
    res.status(401).json({
      error: 'Authentication required.',
    });
    return;
  }
  if (req.authUser.role !== 'admin') {
    res.status(403).json({
      error: 'Forbidden. Only Admin accounts can manage user roles.',
    });
    return;
  }
  next();
}

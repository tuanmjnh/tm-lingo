import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import type { AuthUserProfile } from '../../packages/contracts/types';
import { resolveServerUserRole } from './roleStore';

let adminClient: SupabaseClient | null = null;

export async function getAuthUserFromRequest(
  req: Request
): Promise<AuthUserProfile | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

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

      return {
        id: data.user.id,
        email: data.user.email ?? null,
        displayName,
        role,
        provider: 'supabase',
      };
    }
  } catch {
    return null;
  }

  return null;
}

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

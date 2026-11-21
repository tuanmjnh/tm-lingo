import type { AuthUserProfile } from './types';

export const HARD_DELETE_CAPABILITY = 'tm-lingo.system.hard_delete';

/**
 * Checks whether a role list contains the root system role.
 */
export function isRootRoleList(roles: string[] | undefined | null): boolean {
  return (roles ?? []).some((role) => role.trim().toLowerCase() === 'root');
}

/**
 * Returns true ONLY when the authenticated staff member holds root-level authority:
 * - Assigned the `root` role (from TM-Hub IAM or Local Staff IAM), OR
 * - Explicitly granted `*`, `system.root`, or `tm-lingo.system.hard_delete`.
 *
 * Standard `admin` and `teacher` accounts can soft-delete (archive) and restore,
 * but must NOT hold root hard-delete authority.
 */
export function isRootStaff(user: AuthUserProfile | null | undefined): boolean {
  if (!user) return false;
  if (isRootRoleList(user.roles)) return true;

  const caps = user.capabilities ?? [];
  return (
    caps.includes('*') ||
    caps.includes('system.root') ||
    caps.includes(HARD_DELETE_CAPABILITY)
  );
}

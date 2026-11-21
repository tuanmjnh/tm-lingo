import fs from 'node:fs';
import path from 'node:path';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AuthUserProfile } from '../../packages/contracts/types';
import { getMongoCollection } from '../db/mongo';

const FIREBASE_JWKS_URL = new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
);

const firebaseJwks = createRemoteJWKSet(FIREBASE_JWKS_URL);

let cachedProjectId: string | null = null;

export function getFirebaseProjectId(): string | null {
  if (cachedProjectId !== null) return cachedProjectId || null;

  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
        projectId?: string;
      };
      if (parsed.projectId?.trim()) {
        cachedProjectId = parsed.projectId.trim();
        return cachedProjectId;
      }
    }
  } catch {
    // ignore malformed file
  }

  const fromEnv =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    '';
  cachedProjectId = fromEnv.trim();
  return cachedProjectId || null;
}

interface ParentAccountDoc {
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
  photoUrl?: string | null;
  role: 'parent';
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
}

async function upsertParentAccount(input: {
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
  photoUrl?: string | null;
}): Promise<void> {
  try {
    const col = await getMongoCollection<ParentAccountDoc>('accounts');
    if (!col) return;
    const now = new Date().toISOString();
    await col.updateOne(
      { firebaseUid: input.firebaseUid },
      {
        $set: {
          email: input.email,
          displayName: input.displayName,
          photoUrl: input.photoUrl ?? null,
          role: 'parent',
          updatedAt: now,
          lastLoginAt: now,
        },
        $setOnInsert: {
          firebaseUid: input.firebaseUid,
          createdAt: now,
        },
      },
      { upsert: true }
    );
  } catch {
    // Non-blocking account sync
  }
}

/**
 * Verifies a Firebase ID Token purely via Google's public RS256 JWKS (no Firebase IAM needed).
 * Strictly returns role: 'parent' — Firebase parent identities can NEVER gain staff privileges.
 */
export async function verifyFirebaseParentToken(
  token: string
): Promise<AuthUserProfile | null> {
  const projectId = getFirebaseProjectId();
  if (!projectId || !token.trim()) return null;

  try {
    const { payload } = await jwtVerify(token.trim(), firebaseJwks, {
      algorithms: ['RS256'],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
    });

    const uid =
      typeof payload.user_id === 'string'
        ? payload.user_id
        : typeof payload.sub === 'string'
          ? payload.sub
          : '';
    if (!uid) return null;

    const email = typeof payload.email === 'string' ? payload.email : null;
    const displayName =
      typeof payload.name === 'string' && payload.name.trim()
        ? payload.name.trim()
        : email;
    const photoUrl =
      typeof payload.picture === 'string' ? payload.picture : null;

    void upsertParentAccount({
      firebaseUid: uid,
      email,
      displayName,
      photoUrl,
    });

    return {
      id: uid,
      email,
      displayName,
      role: 'parent',
      provider: 'firebase',
    };
  } catch {
    return null;
  }
}

export async function getParentUserFromRequest(
  request: Request
): Promise<AuthUserProfile | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;
  return verifyFirebaseParentToken(token);
}

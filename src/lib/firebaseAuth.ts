'use client';

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, firebaseProjectId, googleProvider } from '../firebase';

export const isFirebaseAuthConfigured = Boolean(firebaseProjectId);

export async function getParentIdToken(forceRefresh = false): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

export async function signInParentWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signInParentWithEmail(
  email: string,
  password: string
): Promise<User> {
  const result = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
  return result.user;
}

export async function signUpParentWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<User> {
  const result = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
  if (displayName?.trim()) {
    await updateProfile(result.user, { displayName: displayName.trim() });
  }
  return result.user;
}

export async function signOutParent(): Promise<void> {
  await signOut(auth);
}

export function subscribeParentAuth(
  callback: (user: User | null) => void
): () => void {
  try {
    return onAuthStateChanged(
      auth,
      callback,
      () => {
        callback(null);
      }
    );
  } catch {
    callback(null);
    return () => undefined;
  }
}

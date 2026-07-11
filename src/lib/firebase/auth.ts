import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
  type Unsubscribe,
  type User,
} from 'firebase/auth';

import { getFirebaseApp } from './index';

let auth: Auth | null = null;
let currentUser: User | null = null;
let authError: Error | null = null;
let initPromise: Promise<string | null> | null = null;
let unsubscribe: Unsubscribe | null = null;

export function resetAuthForTests(): void {
  unsubscribe?.();
  unsubscribe = null;
  auth = null;
  currentUser = null;
  authError = null;
  initPromise = null;
}

export function getFirebaseAuth(): Auth | null {
  return auth;
}

export function getCurrentUser(): User | null {
  return currentUser;
}

/** UID for scoping Firestore paths (`users/{uid}/...`). Null when offline-only. */
export function getAuthUid(): string | null {
  return currentUser?.uid ?? null;
}

export function isAnonymousUser(): boolean {
  return currentUser?.isAnonymous === true;
}

export function getAuthError(): Error | null {
  return authError;
}

/**
 * On first launch, sign in anonymously so a UID is ready for sync.
 * Safe when Firebase is missing or unreachable — returns null and does not throw.
 */
export async function ensureAnonymousAuth(): Promise<string | null> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = doEnsureAnonymousAuth();
  return initPromise;
}

async function doEnsureAnonymousAuth(): Promise<string | null> {
  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  try {
    auth = getAuth(app);

    const initialUser = await waitForInitialAuthState(auth);

    if (initialUser) {
      currentUser = initialUser;
    } else {
      const credential = await signInAnonymously(auth);
      currentUser = credential.user;
    }

    authError = null;
    subscribeToAuthChanges(auth);

    return currentUser.uid;
  } catch (error) {
    authError = error instanceof Error ? error : new Error('Anonymous auth failed');
    console.warn('[Firebase Auth] Anonymous sign-in failed; continuing offline.', authError);
    return null;
  }
}

function waitForInitialAuthState(authInstance: Auth): Promise<User | null> {
  return new Promise((resolve, reject) => {
    let settled = false;
    // `let` so a synchronous first callback can safely unsubscribe (TDZ-safe).
    let unsub: Unsubscribe = () => {};
    unsub = onAuthStateChanged(
      authInstance,
      (user) => {
        if (settled) {
          return;
        }
        settled = true;
        unsub();
        resolve(user);
      },
      (error) => {
        if (settled) {
          return;
        }
        settled = true;
        unsub();
        reject(error);
      },
    );
  });
}

function subscribeToAuthChanges(authInstance: Auth): void {
  unsubscribe?.();
  unsubscribe = onAuthStateChanged(authInstance, (user) => {
    currentUser = user;
  });
}

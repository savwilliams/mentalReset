import {
  EmailAuthProvider,
  GoogleAuthProvider,
  getAuth,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
  type AuthCredential,
  type Unsubscribe,
  type User,
  type UserCredential,
} from 'firebase/auth';

import { getFirebaseApp } from './index';

let auth: Auth | null = null;
let currentUser: User | null = null;
let authError: Error | null = null;
let initPromise: Promise<string | null> | null = null;
let unsubscribe: Unsubscribe | null = null;

export type AccountLinkErrorCode =
  | 'auth-unavailable'
  | 'not-signed-in'
  | 'not-anonymous'
  | 'email-already-in-use'
  | 'credential-already-in-use'
  | 'invalid-email'
  | 'weak-password'
  | 'operation-not-allowed'
  | 'requires-recent-login'
  | 'popup-closed'
  | 'network-request-failed'
  | 'unknown';

export interface AccountLinkSuccess {
  ok: true;
  uid: string;
  isAnonymous: false;
  providers: string[];
  email: string | null;
}

export interface AccountLinkFailure {
  ok: false;
  code: AccountLinkErrorCode;
  /** Calm, user-facing message — safe to show in Settings. */
  message: string;
}

export type AccountLinkResult = AccountLinkSuccess | AccountLinkFailure;

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

/** True when the current user has a linked (non-anonymous) account. */
export function hasLinkedAccount(): boolean {
  return currentUser !== null && currentUser.isAnonymous === false;
}

export function getAccountEmail(): string | null {
  return currentUser?.email ?? null;
}

export function getAccountProviders(): string[] {
  return currentUser?.providerData.map((p) => p.providerId) ?? [];
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

/**
 * Upgrade an anonymous session to email/password without changing the UID.
 * Local Dexie data and Firestore paths stay under the same user.
 * On failure, the anonymous session is left intact.
 */
export async function linkWithEmailPassword(
  email: string,
  password: string,
): Promise<AccountLinkResult> {
  const ready = requireAnonymousUserForLink();
  if (!ready.ok) {
    return ready;
  }

  try {
    const credential = EmailAuthProvider.credential(email.trim(), password);
    return await applyCredentialLink(ready.user, credential);
  } catch (error) {
    return toLinkFailure(error);
  }
}

/**
 * Upgrade an anonymous session via Google OAuth popup, preserving the UID.
 * On failure (including closed popup), the anonymous session is left intact.
 */
export async function linkWithGoogle(): Promise<AccountLinkResult> {
  const ready = requireAnonymousUserForLink();
  if (!ready.ok) {
    return ready;
  }

  try {
    const provider = new GoogleAuthProvider();
    const result = await linkWithPopup(ready.user, provider);
    return toLinkSuccess(result);
  } catch (error) {
    return toLinkFailure(error);
  }
}

/**
 * Link an arbitrary Firebase credential to the current anonymous user.
 * Prefer {@link linkWithEmailPassword} / {@link linkWithGoogle} from UI code.
 */
export async function linkAnonymousWithCredential(
  credential: AuthCredential,
): Promise<AccountLinkResult> {
  const ready = requireAnonymousUserForLink();
  if (!ready.ok) {
    return ready;
  }

  return applyCredentialLink(ready.user, credential);
}

async function applyCredentialLink(
  user: User,
  credential: AuthCredential,
): Promise<AccountLinkResult> {
  try {
    const result = await linkWithCredential(user, credential);
    return toLinkSuccess(result);
  } catch (error) {
    return toLinkFailure(error);
  }
}

function requireAnonymousUserForLink():
  | { ok: true; user: User }
  | AccountLinkFailure {
  if (!auth || !currentUser) {
    return {
      ok: false,
      code: currentUser ? 'auth-unavailable' : 'not-signed-in',
      message: currentUser
        ? 'Account linking is unavailable right now. You can keep using the app offline.'
        : 'Sign-in is not ready yet. Try again in a moment.',
    };
  }

  if (!currentUser.isAnonymous) {
    return {
      ok: false,
      code: 'not-anonymous',
      message: 'This session already has a linked account.',
    };
  }

  return { ok: true, user: currentUser };
}

function toLinkSuccess(result: UserCredential): AccountLinkSuccess {
  currentUser = result.user;
  return {
    ok: true,
    uid: result.user.uid,
    isAnonymous: false,
    providers: result.user.providerData.map((p) => p.providerId),
    email: result.user.email,
  };
}

function toLinkFailure(error: unknown): AccountLinkFailure {
  const firebaseCode =
    error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : null;

  const mapped = mapFirebaseLinkError(firebaseCode);
  console.warn('[Firebase Auth] Account link failed; keeping anonymous session.', error);
  return mapped;
}

function mapFirebaseLinkError(firebaseCode: string | null): AccountLinkFailure {
  switch (firebaseCode) {
    case 'auth/email-already-in-use':
      return {
        ok: false,
        code: 'email-already-in-use',
        message: 'That email is already in use. Try signing in instead, or use a different email.',
      };
    case 'auth/credential-already-in-use':
      return {
        ok: false,
        code: 'credential-already-in-use',
        message: 'That account is already linked elsewhere. Try signing in with it instead.',
      };
    case 'auth/invalid-email':
      return {
        ok: false,
        code: 'invalid-email',
        message: 'Please enter a valid email address.',
      };
    case 'auth/weak-password':
      return {
        ok: false,
        code: 'weak-password',
        message: 'Please choose a stronger password (at least 6 characters).',
      };
    case 'auth/operation-not-allowed':
      return {
        ok: false,
        code: 'operation-not-allowed',
        message: 'This sign-in method is not enabled yet. You can keep using the app as a guest.',
      };
    case 'auth/requires-recent-login':
      return {
        ok: false,
        code: 'requires-recent-login',
        message: 'For security, please refresh the page and try linking again.',
      };
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return {
        ok: false,
        code: 'popup-closed',
        message: 'Sign-in was cancelled. You can try again whenever you are ready.',
      };
    case 'auth/network-request-failed':
      return {
        ok: false,
        code: 'network-request-failed',
        message: 'Network issue — your guest session is still active. Try again when you are online.',
      };
    default:
      return {
        ok: false,
        code: firebaseCode === 'auth/unauthorized-domain' ? 'auth-unavailable' : 'unknown',
        message: 'Could not link your account right now. Your guest session is still active.',
      };
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

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAnonymousUser = {
  uid: 'anon-uid-123',
  isAnonymous: true,
  email: null,
  providerData: [] as { providerId: string }[],
};

const mockLinkedUser = {
  uid: 'anon-uid-123',
  isAnonymous: false,
  email: 'user@example.com',
  providerData: [{ providerId: 'password' }],
};

const mockGoogleLinkedUser = {
  uid: 'anon-uid-123',
  isAnonymous: false,
  email: 'user@gmail.com',
  providerData: [{ providerId: 'google.com' }],
};

const mockGetAuth = vi.fn();
const mockSignInAnonymously = vi.fn();
const mockOnAuthStateChanged = vi.fn();
const mockLinkWithCredential = vi.fn();
const mockLinkWithPopup = vi.fn();
const mockEmailCredential = vi.fn();

vi.mock('firebase/auth', () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...args),
  signInAnonymously: (...args: unknown[]) => mockSignInAnonymously(...args),
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  linkWithCredential: (...args: unknown[]) => mockLinkWithCredential(...args),
  linkWithPopup: (...args: unknown[]) => mockLinkWithPopup(...args),
  EmailAuthProvider: {
    credential: (...args: unknown[]) => mockEmailCredential(...args),
  },
  GoogleAuthProvider: class MockGoogleAuthProvider {},
}));

vi.mock('./index', () => ({
  getFirebaseApp: vi.fn(),
}));

import { getFirebaseApp } from './index';
import {
  ensureAnonymousAuth,
  getAccountEmail,
  getAccountProviders,
  getAuthError,
  getAuthUid,
  getCurrentUser,
  hasLinkedAccount,
  isAnonymousUser,
  linkWithEmailPassword,
  linkWithGoogle,
  resetAuthForTests,
} from './auth';

function stubAnonymousAuthReady(): void {
  vi.mocked(getFirebaseApp).mockReturnValue({ name: 'mock-app' } as never);
  mockGetAuth.mockReturnValue({ name: 'mock-auth' });
  mockSignInAnonymously.mockResolvedValue({ user: mockAnonymousUser });

  let authListenerCount = 0;
  mockOnAuthStateChanged.mockImplementation((_auth, next: (user: typeof mockAnonymousUser | null) => void) => {
    authListenerCount += 1;
    if (authListenerCount === 1) {
      next(null);
    } else {
      next(mockAnonymousUser);
    }
    return vi.fn();
  });
}

describe('ensureAnonymousAuth', () => {
  beforeEach(() => {
    resetAuthForTests();
    vi.clearAllMocks();
    stubAnonymousAuthReady();
  });

  it('returns null when Firebase is not configured (offline-only)', async () => {
    vi.mocked(getFirebaseApp).mockReturnValue(null);

    const uid = await ensureAnonymousAuth();

    expect(uid).toBeNull();
    expect(getAuthUid()).toBeNull();
    expect(getCurrentUser()).toBeNull();
    expect(getAuthError()).toBeNull();
    expect(mockGetAuth).not.toHaveBeenCalled();
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });

  it('signs in anonymously on first launch and exposes UID for sync', async () => {
    const uid = await ensureAnonymousAuth();

    expect(uid).toBe('anon-uid-123');
    expect(getAuthUid()).toBe('anon-uid-123');
    expect(isAnonymousUser()).toBe(true);
    expect(hasLinkedAccount()).toBe(false);
    expect(getAuthError()).toBeNull();
    expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('reuses an existing persisted auth session without signing in again', async () => {
    mockOnAuthStateChanged.mockImplementation((_auth, next: (user: typeof mockAnonymousUser | null) => void) => {
      next(mockAnonymousUser);
      return vi.fn();
    });

    const uid = await ensureAnonymousAuth();

    expect(uid).toBe('anon-uid-123');
    expect(getAuthUid()).toBe('anon-uid-123');
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });

  it('continues offline when anonymous sign-in fails', async () => {
    mockSignInAnonymously.mockRejectedValue(new Error('network unavailable'));

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const uid = await ensureAnonymousAuth();

    expect(uid).toBeNull();
    expect(getAuthUid()).toBeNull();
    expect(getAuthError()?.message).toBe('network unavailable');
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });

  it('is idempotent — concurrent calls share one sign-in', async () => {
    const [a, b] = await Promise.all([ensureAnonymousAuth(), ensureAnonymousAuth()]);

    expect(a).toBe('anon-uid-123');
    expect(b).toBe('anon-uid-123');
    expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
  });
});

describe('optional account linking', () => {
  beforeEach(() => {
    resetAuthForTests();
    vi.clearAllMocks();
    stubAnonymousAuthReady();
    mockEmailCredential.mockReturnValue({ providerId: 'password' });
  });

  it('links email/password and preserves the anonymous UID', async () => {
    await ensureAnonymousAuth();
    mockLinkWithCredential.mockResolvedValue({ user: mockLinkedUser });

    const result = await linkWithEmailPassword('user@example.com', 'secret123');

    expect(result).toEqual({
      ok: true,
      uid: 'anon-uid-123',
      isAnonymous: false,
      providers: ['password'],
      email: 'user@example.com',
    });
    expect(getAuthUid()).toBe('anon-uid-123');
    expect(isAnonymousUser()).toBe(false);
    expect(hasLinkedAccount()).toBe(true);
    expect(getAccountEmail()).toBe('user@example.com');
    expect(getAccountProviders()).toEqual(['password']);
    expect(mockEmailCredential).toHaveBeenCalledWith('user@example.com', 'secret123');
    expect(mockLinkWithCredential).toHaveBeenCalledWith(mockAnonymousUser, {
      providerId: 'password',
    });
  });

  it('trims email before creating the credential', async () => {
    await ensureAnonymousAuth();
    mockLinkWithCredential.mockResolvedValue({ user: mockLinkedUser });

    await linkWithEmailPassword('  user@example.com  ', 'secret123');

    expect(mockEmailCredential).toHaveBeenCalledWith('user@example.com', 'secret123');
  });

  it('keeps the anonymous session when email link fails', async () => {
    await ensureAnonymousAuth();
    mockLinkWithCredential.mockRejectedValue({
      code: 'auth/email-already-in-use',
      message: 'Firebase: Error (auth/email-already-in-use).',
    });

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await linkWithEmailPassword('taken@example.com', 'secret123');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('email-already-in-use');
      expect(result.message).toMatch(/already in use/i);
    }
    expect(getAuthUid()).toBe('anon-uid-123');
    expect(isAnonymousUser()).toBe(true);
    expect(hasLinkedAccount()).toBe(false);
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });

  it('maps credential-already-in-use to a calm error without dropping the guest session', async () => {
    await ensureAnonymousAuth();
    mockLinkWithCredential.mockRejectedValue({ code: 'auth/credential-already-in-use' });

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await linkWithEmailPassword('user@example.com', 'secret123');

    expect(result).toMatchObject({
      ok: false,
      code: 'credential-already-in-use',
    });
    expect(isAnonymousUser()).toBe(true);

    warn.mockRestore();
  });

  it('maps weak-password and invalid-email to calm validation messages', async () => {
    await ensureAnonymousAuth();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockLinkWithCredential.mockRejectedValueOnce({ code: 'auth/weak-password' });
    const weak = await linkWithEmailPassword('user@example.com', '1');
    expect(weak).toMatchObject({ ok: false, code: 'weak-password' });

    mockLinkWithCredential.mockRejectedValueOnce({ code: 'auth/invalid-email' });
    const invalid = await linkWithEmailPassword('not-an-email', 'secret123');
    expect(invalid).toMatchObject({ ok: false, code: 'invalid-email' });

    expect(isAnonymousUser()).toBe(true);
    warn.mockRestore();
  });

  it('links Google via popup and preserves the anonymous UID', async () => {
    await ensureAnonymousAuth();
    mockLinkWithPopup.mockResolvedValue({ user: mockGoogleLinkedUser });

    const result = await linkWithGoogle();

    expect(result).toEqual({
      ok: true,
      uid: 'anon-uid-123',
      isAnonymous: false,
      providers: ['google.com'],
      email: 'user@gmail.com',
    });
    expect(getAuthUid()).toBe('anon-uid-123');
    expect(hasLinkedAccount()).toBe(true);
    expect(mockLinkWithPopup).toHaveBeenCalled();
  });

  it('keeps the anonymous session when Google popup is closed', async () => {
    await ensureAnonymousAuth();
    mockLinkWithPopup.mockRejectedValue({ code: 'auth/popup-closed-by-user' });

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await linkWithGoogle();

    expect(result).toMatchObject({ ok: false, code: 'popup-closed' });
    expect(isAnonymousUser()).toBe(true);
    expect(getAuthUid()).toBe('anon-uid-123');

    warn.mockRestore();
  });

  it('returns not-signed-in when auth was never initialized', async () => {
    const result = await linkWithEmailPassword('user@example.com', 'secret123');

    expect(result).toMatchObject({ ok: false, code: 'not-signed-in' });
    expect(mockLinkWithCredential).not.toHaveBeenCalled();
  });

  it('refuses to link when the session is already linked', async () => {
    await ensureAnonymousAuth();
    mockLinkWithCredential.mockResolvedValue({ user: mockLinkedUser });
    await linkWithEmailPassword('user@example.com', 'secret123');

    const result = await linkWithEmailPassword('other@example.com', 'secret123');

    expect(result).toMatchObject({ ok: false, code: 'not-anonymous' });
    expect(mockLinkWithCredential).toHaveBeenCalledTimes(1);
  });
});

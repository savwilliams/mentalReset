import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUser = {
  uid: 'anon-uid-123',
  isAnonymous: true,
};

const mockGetAuth = vi.fn();
const mockSignInAnonymously = vi.fn();
const mockOnAuthStateChanged = vi.fn();

vi.mock('firebase/auth', () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...args),
  signInAnonymously: (...args: unknown[]) => mockSignInAnonymously(...args),
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
}));

vi.mock('./index', () => ({
  getFirebaseApp: vi.fn(),
}));

import { getFirebaseApp } from './index';
import {
  ensureAnonymousAuth,
  getAuthError,
  getAuthUid,
  getCurrentUser,
  isAnonymousUser,
  resetAuthForTests,
} from './auth';

describe('ensureAnonymousAuth', () => {
  beforeEach(() => {
    resetAuthForTests();
    vi.clearAllMocks();

    mockGetAuth.mockReturnValue({ name: 'mock-auth' });
    mockSignInAnonymously.mockResolvedValue({ user: mockUser });

    // First listener resolves initial state; later listeners mirror post-sign-in user.
    let authListenerCount = 0;
    mockOnAuthStateChanged.mockImplementation((_auth, next: (user: typeof mockUser | null) => void) => {
      authListenerCount += 1;
      if (authListenerCount === 1) {
        next(null);
      } else {
        next(mockUser);
      }
      return vi.fn();
    });
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
    vi.mocked(getFirebaseApp).mockReturnValue({ name: 'mock-app' } as never);

    const uid = await ensureAnonymousAuth();

    expect(uid).toBe('anon-uid-123');
    expect(getAuthUid()).toBe('anon-uid-123');
    expect(isAnonymousUser()).toBe(true);
    expect(getAuthError()).toBeNull();
    expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('reuses an existing persisted auth session without signing in again', async () => {
    vi.mocked(getFirebaseApp).mockReturnValue({ name: 'mock-app' } as never);
    mockOnAuthStateChanged.mockImplementation((_auth, next: (user: typeof mockUser | null) => void) => {
      next(mockUser);
      return vi.fn();
    });

    const uid = await ensureAnonymousAuth();

    expect(uid).toBe('anon-uid-123');
    expect(getAuthUid()).toBe('anon-uid-123');
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });

  it('continues offline when anonymous sign-in fails', async () => {
    vi.mocked(getFirebaseApp).mockReturnValue({ name: 'mock-app' } as never);
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
    vi.mocked(getFirebaseApp).mockReturnValue({ name: 'mock-app' } as never);

    const [a, b] = await Promise.all([ensureAnonymousAuth(), ensureAnonymousAuth()]);

    expect(a).toBe('anon-uid-123');
    expect(b).toBe('anon-uid-123');
    expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
  });
});

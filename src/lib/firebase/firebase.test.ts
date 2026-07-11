import { afterEach, describe, expect, it, vi } from 'vitest';

describe('firebase', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('continues offline when config is missing', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', '');
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', '');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '');
    vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', '');
    vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '');
    vi.stubEnv('VITE_FIREBASE_APP_ID', '');

    const { getFirebaseConfig } = await import('@/lib/firebase/config');
    const { initFirebase, isFirebaseAvailable } = await import('@/lib/firebase');

    const { isConfigured } = getFirebaseConfig();
    expect(isConfigured).toBe(false);

    const { app, error } = initFirebase();
    expect(app).toBeNull();
    expect(error).toBeNull();
    expect(isFirebaseAvailable()).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { getFirebaseConfig } from '@/lib/firebase/config';
import { initFirebase, isFirebaseAvailable } from '@/lib/firebase';

describe('firebase', () => {
  it('continues offline when config is missing', () => {
    const { isConfigured } = getFirebaseConfig();
    expect(isConfigured).toBe(false);

    const { app, error } = initFirebase();
    expect(app).toBeNull();
    expect(error).toBeNull();
    expect(isFirebaseAvailable()).toBe(false);
  });
});

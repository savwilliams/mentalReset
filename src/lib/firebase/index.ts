import { initializeApp, type FirebaseApp } from 'firebase/app';

import { getFirebaseConfig } from './config';

let app: FirebaseApp | null = null;
let initError: Error | null = null;
let initialized = false;

export function initFirebase(): { app: FirebaseApp | null; error: Error | null } {
  if (initialized) {
    return { app, error: initError };
  }

  initialized = true;
  const { config, isConfigured } = getFirebaseConfig();

  if (!isConfigured) {
    if (import.meta.env.DEV) {
      console.info('[Firebase] Config missing; continuing in offline-only mode.');
    }
    return { app: null, error: null };
  }

  try {
    app = initializeApp(config);
    return { app, error: null };
  } catch (error) {
    initError = error instanceof Error ? error : new Error('Firebase initialization failed');
    console.warn('[Firebase] Initialization failed; continuing offline.', initError);
    return { app: null, error: initError };
  }
}

export function getFirebaseApp(): FirebaseApp | null {
  return app;
}

export function isFirebaseAvailable(): boolean {
  return app !== null;
}

export function getFirebaseInitError(): Error | null {
  return initError;
}

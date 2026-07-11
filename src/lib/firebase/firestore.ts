import { getFirestore, type Firestore } from 'firebase/firestore';

import { getFirebaseApp } from './index';

let firestore: Firestore | null = null;

export function resetFirestoreForTests(): void {
  firestore = null;
}

/** Returns Firestore when Firebase is initialized; null in offline-only mode. */
export function getFirestoreDb(): Firestore | null {
  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  if (!firestore) {
    firestore = getFirestore(app);
  }

  return firestore;
}

export function isFirestoreAvailable(): boolean {
  return getFirestoreDb() !== null;
}

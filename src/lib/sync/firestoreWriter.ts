import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';

import { getAuthUid } from '@/lib/firebase/auth';
import { getFirestoreDb } from '@/lib/firebase/firestore';
import { shouldOverwriteRemote } from '@/lib/sync/conflict';
import {
  assertNoThoughts,
  settingsToFirestore,
  summaryToFirestore,
  taskToFirestore,
} from '@/lib/sync/firestoreMappers';
import type { SessionSummary } from '@/types/session';
import type { UserSettings } from '@/types/settings';
import type { Task } from '@/types/task';

export interface SyncWriter {
  writeTask(uid: string, task: Task): Promise<void>;
  writeSummary(uid: string, summary: SessionSummary): Promise<void>;
  writeSettings(uid: string, settings: UserSettings): Promise<void>;
}

function taskPath(db: Firestore, uid: string, taskId: string) {
  return doc(db, 'users', uid, 'tasks', taskId);
}

function summaryPath(db: Firestore, uid: string, summaryId: string) {
  return doc(db, 'users', uid, 'summaries', summaryId);
}

function settingsPath(db: Firestore, uid: string) {
  return doc(db, 'users', uid, 'settings', 'settings');
}

export function createFirestoreWriter(getDb: () => Firestore | null = getFirestoreDb): SyncWriter {
  return {
    async writeTask(uid, task) {
      const db = getDb();
      if (!db) {
        throw new Error('Firestore unavailable');
      }

      const payload = taskToFirestore(task);
      assertNoThoughts(payload as unknown as Record<string, unknown>);

      const ref = taskPath(db, uid, task.id);
      const existing = await getDoc(ref);
      const remoteUpdatedAt = existing.exists()
        ? (existing.data()?.updatedAt as number | undefined)
        : undefined;

      if (!shouldOverwriteRemote(task.updatedAt, remoteUpdatedAt)) {
        return;
      }

      await setDoc(
        ref,
        {
          ...payload,
          syncedAt: serverTimestamp(),
        },
        { merge: true },
      );
    },

    async writeSummary(uid, summary) {
      const db = getDb();
      if (!db) {
        throw new Error('Firestore unavailable');
      }

      const payload = summaryToFirestore(summary);
      assertNoThoughts(payload as unknown as Record<string, unknown>);

      const ref = summaryPath(db, uid, summary.id);
      const existing = await getDoc(ref);
      const remoteCompletedAt = existing.exists()
        ? (existing.data()?.completedAt as number | undefined)
        : undefined;

      if (!shouldOverwriteRemote(summary.completedAt, remoteCompletedAt)) {
        return;
      }

      await setDoc(
        ref,
        {
          ...payload,
          syncedAt: serverTimestamp(),
        },
        { merge: true },
      );
    },

    async writeSettings(uid, settings) {
      const db = getDb();
      if (!db) {
        throw new Error('Firestore unavailable');
      }

      const payload = settingsToFirestore(settings);
      assertNoThoughts(payload as unknown as Record<string, unknown>);

      const ref = settingsPath(db, uid);
      const existing = await getDoc(ref);
      const remoteUpdatedAt = existing.exists()
        ? (existing.data()?.updatedAt as number | undefined)
        : undefined;

      if (!shouldOverwriteRemote(settings.updatedAt, remoteUpdatedAt)) {
        return;
      }

      await setDoc(
        ref,
        {
          ...payload,
          syncedAt: serverTimestamp(),
        },
        { merge: true },
      );
    },
  };
}

export function resolveSyncUid(): string | null {
  return getAuthUid();
}

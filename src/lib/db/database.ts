import Dexie, { type EntityTable } from 'dexie';

import { SCHEMA_VERSION_V2, V1_STORES, V2_STORES } from '@/lib/db/migrations/v2';
import type { ActiveSession, SessionSummary } from '@/types/session';
import type { UserSettings } from '@/types/settings';
import type { Task } from '@/types/task';

export const DB_NAME = 'mentalreset';
export const DB_VERSION = SCHEMA_VERSION_V2;

export class MentalResetDatabase extends Dexie {
  tasks!: EntityTable<Task, 'id'>;
  sessions!: EntityTable<ActiveSession, 'id'>;
  sessionSummaries!: EntityTable<SessionSummary, 'id'>;
  settings!: EntityTable<UserSettings, 'id'>;

  constructor() {
    super(DB_NAME);

    this.version(1).stores({ ...V1_STORES });

    this.version(SCHEMA_VERSION_V2)
      .stores({ ...V2_STORES })
      .upgrade(async () => {
        // Index-only change — existing task/session/summary/settings rows stay intact.
      });
  }
}

export const db = new MentalResetDatabase();

export class IndexedDBUnavailableError extends Error {
  constructor(message = 'IndexedDB is not available in this environment.') {
    super(message);
    this.name = 'IndexedDBUnavailableError';
  }
}

export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

export async function openDatabase(): Promise<MentalResetDatabase> {
  if (!isIndexedDBAvailable()) {
    throw new IndexedDBUnavailableError();
  }

  try {
    await db.open();
    return db;
  } catch (error) {
    const message =
      error instanceof Error
        ? `Unable to open local storage: ${error.message}`
        : 'Unable to open local storage.';
    throw new IndexedDBUnavailableError(message);
  }
}

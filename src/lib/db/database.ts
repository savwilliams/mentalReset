import Dexie, { type EntityTable } from 'dexie';

import type { ActiveSession, SessionSummary } from '@/types/session';
import type { UserSettings } from '@/types/settings';
import type { Task } from '@/types/task';

export const DB_NAME = 'mentalreset';
export const DB_VERSION = 1;

export class MentalResetDatabase extends Dexie {
  tasks!: EntityTable<Task, 'id'>;
  sessions!: EntityTable<ActiveSession, 'id'>;
  sessionSummaries!: EntityTable<SessionSummary, 'id'>;
  settings!: EntityTable<UserSettings, 'id'>;

  constructor() {
    super(DB_NAME);

    this.version(DB_VERSION).stores({
      tasks: 'id, category, completed, updatedAt',
      sessions: 'id, state, createdAt',
      sessionSummaries: 'id, completedAt',
      settings: 'id, updatedAt',
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

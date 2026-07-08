import Dexie, { type EntityTable } from 'dexie';

import type { ActiveSession, SessionSummary } from '@/types/session';
import type { UserSettings } from '@/types/settings';
import type { Task } from '@/types/task';

export const DB_NAME = 'mentalreset';
export const DB_VERSION = 2;

const V1_STORES = {
  tasks: 'id, category, completed, updatedAt',
  sessions: 'id, state, createdAt',
  sessionSummaries: 'id, completedAt',
  settings: 'id, updatedAt',
} as const;

const V2_STORES = {
  tasks: 'id, category, completed, createdAt, updatedAt',
  sessions: 'id, state, createdAt, completedAt',
  sessionSummaries: 'id, completedAt',
  settings: 'id, updatedAt',
} as const;

const LOCAL_SETTINGS_ID = 'local';

function isThemePreference(value: unknown): value is UserSettings['theme'] {
  return value === 'system' || value === 'light' || value === 'dark';
}

export class MentalResetDatabase extends Dexie {
  tasks!: EntityTable<Task, 'id'>;
  sessions!: EntityTable<ActiveSession, 'id'>;
  sessionSummaries!: EntityTable<SessionSummary, 'id'>;
  settings!: EntityTable<UserSettings, 'id'>;

  constructor() {
    super(DB_NAME);

    this.version(1).stores(V1_STORES);
    this.version(2)
      .stores(V2_STORES)
      .upgrade(async (tx) => {
        const now = Date.now();

        await tx
          .table('tasks')
          .toCollection()
          .modify((task: Partial<Task>) => {
            if (typeof task.createdAt !== 'number') {
              task.createdAt = typeof task.updatedAt === 'number' ? task.updatedAt : now;
            }
            if (typeof task.updatedAt !== 'number') {
              task.updatedAt = task.createdAt;
            }
          });

        await tx
          .table('sessions')
          .toCollection()
          .modify((session: Partial<ActiveSession>) => {
            if (typeof session.createdAt !== 'number') {
              session.createdAt = now;
            }
            if (!Array.isArray(session.thoughts)) {
              session.thoughts = [];
            }
            if (!session.stats) {
              session.stats = {
                thoughtsCount: 0,
                tasksCreated: 0,
                releasedCount: 0,
                estimatedTimeTotal: 0,
              };
            }
          });

        const settingsTable = tx.table('settings');
        const settingsRows = (await settingsTable.toArray()) as Array<
          Partial<UserSettings> & { id?: string | null; notificationsEnabled?: unknown; theme?: unknown }
        >;

        if (settingsRows.length > 0) {
          const existingLocal = settingsRows.find((row) => row.id === LOCAL_SETTINGS_ID);
          const fallback = settingsRows.reduce(
            (latest, row) =>
              (row.updatedAt ?? 0) > (latest?.updatedAt ?? 0) ? row : latest,
            settingsRows[0],
          );
          const source = existingLocal ?? fallback;

          await settingsTable.put({
            id: LOCAL_SETTINGS_ID,
            notificationsEnabled: Boolean(source.notificationsEnabled),
            theme: isThemePreference(source.theme) ? source.theme : 'system',
            updatedAt: typeof source.updatedAt === 'number' ? source.updatedAt : now,
          } satisfies UserSettings);
        }
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

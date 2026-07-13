import type { Page } from '@playwright/test';

import type { SeedSessionSummary, SeedTask } from './tasks';

export const DB_NAME = 'mentalreset';

export async function resetAppStorage(page: Page): Promise<void> {
  await page.goto('/');
  await deleteIndexedDB(page);
  await page.goto('/');
}

export async function deleteIndexedDB(page: Page): Promise<void> {
  await page.evaluate(async (dbName) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Failed to delete IndexedDB'));
      request.onblocked = () => resolve();
    });
  }, DB_NAME);
}

export async function seedTasksInIndexedDB(page: Page, tasks: SeedTask[]): Promise<void> {
  await page.goto('/');

  await page.evaluate(
    async ({ dbName, tasksToSeed }) => {
      await new Promise<void>((resolve, reject) => {
        const openRequest = indexedDB.open(dbName);

        openRequest.onerror = () => reject(openRequest.error ?? new Error('Failed to open IndexedDB'));

        openRequest.onsuccess = () => {
          const db = openRequest.result;

          if (!db.objectStoreNames.contains('tasks')) {
            db.close();
            reject(new Error('Tasks store is not available'));
            return;
          }

          const transaction = db.transaction('tasks', 'readwrite');
          const store = transaction.objectStore('tasks');

          for (const task of tasksToSeed) {
            store.put(task);
          }

          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error ?? new Error('Failed to seed tasks'));
        };
      });
    },
    { dbName: DB_NAME, tasksToSeed: tasks },
  );
}

export async function getTaskFromIndexedDB(
  page: Page,
  taskId: string,
): Promise<SeedTask | null> {
  return page.evaluate(
    async ({ dbName, id }) => {
      return new Promise<SeedTask | null>((resolve, reject) => {
        const openRequest = indexedDB.open(dbName);

        openRequest.onerror = () => reject(openRequest.error ?? new Error('Failed to open IndexedDB'));

        openRequest.onsuccess = () => {
          const db = openRequest.result;

          if (!db.objectStoreNames.contains('tasks')) {
            db.close();
            resolve(null);
            return;
          }

          const transaction = db.transaction('tasks', 'readonly');
          const store = transaction.objectStore('tasks');
          const getRequest = store.get(id);

          getRequest.onsuccess = () => {
            db.close();
            resolve((getRequest.result as SeedTask | undefined) ?? null);
          };
          getRequest.onerror = () => reject(getRequest.error ?? new Error('Failed to read task'));
        };
      });
    },
    { dbName: DB_NAME, id: taskId },
  );
}

export async function seedSessionSummariesInIndexedDB(
  page: Page,
  summaries: SeedSessionSummary[],
): Promise<void> {
  await page.goto('/');

  await page.evaluate(
    async ({ dbName, summariesToSeed }) => {
      await new Promise<void>((resolve, reject) => {
        const openRequest = indexedDB.open(dbName);

        openRequest.onerror = () => reject(openRequest.error ?? new Error('Failed to open IndexedDB'));

        openRequest.onsuccess = () => {
          const db = openRequest.result;

          if (!db.objectStoreNames.contains('sessionSummaries')) {
            db.close();
            reject(new Error('Session summaries store is not available'));
            return;
          }

          const transaction = db.transaction('sessionSummaries', 'readwrite');
          const store = transaction.objectStore('sessionSummaries');

          for (const summary of summariesToSeed) {
            store.put(summary);
          }

          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () =>
            reject(transaction.error ?? new Error('Failed to seed session summaries'));
        };
      });
    },
    { dbName: DB_NAME, summariesToSeed: summaries },
  );
}

export async function countSessionsInIndexedDB(page: Page): Promise<number> {
  return page.evaluate(async (dbName) => {
    return new Promise<number>((resolve, reject) => {
      const openRequest = indexedDB.open(dbName);

      openRequest.onerror = () => reject(openRequest.error ?? new Error('Failed to open IndexedDB'));

      openRequest.onsuccess = () => {
        const db = openRequest.result;

        if (!db.objectStoreNames.contains('sessions')) {
          db.close();
          resolve(0);
          return;
        }

        const transaction = db.transaction('sessions', 'readonly');
        const store = transaction.objectStore('sessions');
        const countRequest = store.count();

        countRequest.onsuccess = () => {
          db.close();
          resolve(countRequest.result);
        };
        countRequest.onerror = () => reject(countRequest.error ?? new Error('Failed to count sessions'));
      };
    });
  }, DB_NAME);
}

export async function getActiveSessionStateFromIndexedDB(page: Page): Promise<string | null> {
  const session = await getActiveSessionFromIndexedDB(page);
  return session?.state && session.state !== 'IDLE' ? session.state : null;
}

export type StoredSession = {
  id: string;
  state: string;
  thoughts: Array<{ id: string; text: string }>;
  stats?: {
    tasksCreated?: number;
    releasedCount?: number;
    estimatedTimeTotal?: number;
  };
};

export async function getActiveSessionFromIndexedDB(page: Page): Promise<StoredSession | null> {
  return page.evaluate(async (dbName) => {
    return new Promise<StoredSession | null>((resolve, reject) => {
      const openRequest = indexedDB.open(dbName);

      openRequest.onerror = () => reject(openRequest.error ?? new Error('Failed to open IndexedDB'));

      openRequest.onsuccess = () => {
        const db = openRequest.result;

        if (!db.objectStoreNames.contains('sessions')) {
          db.close();
          resolve(null);
          return;
        }

        const transaction = db.transaction('sessions', 'readonly');
        const store = transaction.objectStore('sessions');
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
          db.close();
          const sessions = getAllRequest.result as StoredSession[];
          const active = sessions.find((session) => session.state && session.state !== 'IDLE');
          resolve(active ?? null);
        };
        getAllRequest.onerror = () =>
          reject(getAllRequest.error ?? new Error('Failed to read sessions'));
      };
    });
  }, DB_NAME);
}

export async function getAllTasksFromIndexedDB(page: Page): Promise<SeedTask[]> {
  return page.evaluate(async (dbName) => {
    return new Promise<SeedTask[]>((resolve, reject) => {
      const openRequest = indexedDB.open(dbName);

      openRequest.onerror = () => reject(openRequest.error ?? new Error('Failed to open IndexedDB'));

      openRequest.onsuccess = () => {
        const db = openRequest.result;

        if (!db.objectStoreNames.contains('tasks')) {
          db.close();
          resolve([]);
          return;
        }

        const transaction = db.transaction('tasks', 'readonly');
        const store = transaction.objectStore('tasks');
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
          db.close();
          resolve(getAllRequest.result as SeedTask[]);
        };
        getAllRequest.onerror = () => reject(getAllRequest.error ?? new Error('Failed to read tasks'));
      };
    });
  }, DB_NAME);
}

export async function getAllSessionSummariesFromIndexedDB(
  page: Page,
): Promise<SeedSessionSummary[]> {
  return page.evaluate(async (dbName) => {
    return new Promise<SeedSessionSummary[]>((resolve, reject) => {
      const openRequest = indexedDB.open(dbName);

      openRequest.onerror = () => reject(openRequest.error ?? new Error('Failed to open IndexedDB'));

      openRequest.onsuccess = () => {
        const db = openRequest.result;

        if (!db.objectStoreNames.contains('sessionSummaries')) {
          db.close();
          resolve([]);
          return;
        }

        const transaction = db.transaction('sessionSummaries', 'readonly');
        const store = transaction.objectStore('sessionSummaries');
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
          db.close();
          resolve(getAllRequest.result as SeedSessionSummary[]);
        };
        getAllRequest.onerror = () =>
          reject(getAllRequest.error ?? new Error('Failed to read session summaries'));
      };
    });
  }, DB_NAME);
}

export type SeedActiveSession = {
  id: string;
  state: string;
  createdAt: number;
  completedAt?: number;
  stats: {
    thoughtsCount: number;
    tasksCreated: number;
    releasedCount: number;
    estimatedTimeTotal: number;
  };
  thoughts: Array<{ id: string; text: string }>;
};

export async function seedActiveSessionInIndexedDB(
  page: Page,
  session: SeedActiveSession,
): Promise<void> {
  await page.goto('/');

  await page.evaluate(
    async ({ dbName, sessionToSeed }) => {
      await new Promise<void>((resolve, reject) => {
        const openRequest = indexedDB.open(dbName);

        openRequest.onerror = () => reject(openRequest.error ?? new Error('Failed to open IndexedDB'));

        openRequest.onsuccess = () => {
          const db = openRequest.result;

          if (!db.objectStoreNames.contains('sessions')) {
            db.close();
            reject(new Error('Sessions store is not available'));
            return;
          }

          const transaction = db.transaction('sessions', 'readwrite');
          const store = transaction.objectStore('sessions');
          store.put(sessionToSeed);

          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () =>
            reject(transaction.error ?? new Error('Failed to seed active session'));
        };
      });
    },
    { dbName: DB_NAME, sessionToSeed: session },
  );
}

export async function getSessionSummaryFromIndexedDB(
  page: Page,
  summaryId: string,
): Promise<SeedSessionSummary | null> {
  return page.evaluate(
    async ({ dbName, id }) => {
      return new Promise<SeedSessionSummary | null>((resolve, reject) => {
        const openRequest = indexedDB.open(dbName);

        openRequest.onerror = () => reject(openRequest.error ?? new Error('Failed to open IndexedDB'));

        openRequest.onsuccess = () => {
          const db = openRequest.result;

          if (!db.objectStoreNames.contains('sessionSummaries')) {
            db.close();
            resolve(null);
            return;
          }

          const transaction = db.transaction('sessionSummaries', 'readonly');
          const store = transaction.objectStore('sessionSummaries');
          const getRequest = store.get(id);

          getRequest.onsuccess = () => {
            db.close();
            resolve((getRequest.result as SeedSessionSummary | undefined) ?? null);
          };
          getRequest.onerror = () =>
            reject(getRequest.error ?? new Error('Failed to read session summary'));
        };
      });
    },
    { dbName: DB_NAME, id: summaryId },
  );
}

import type { Page } from '@playwright/test';

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
  return page.evaluate(async (dbName) => {
    return new Promise<string | null>((resolve, reject) => {
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
          const sessions = getAllRequest.result as Array<{ state?: string }>;
          const active = sessions.find((session) => session.state && session.state !== 'IDLE');
          resolve(active?.state ?? null);
        };
        getAllRequest.onerror = () =>
          reject(getAllRequest.error ?? new Error('Failed to read sessions'));
      };
    });
  }, DB_NAME);
}

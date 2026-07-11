import type { Page } from '@playwright/test';

/** Matches `QUEUE_STORAGE_KEY` in `src/lib/sync/syncEngine.ts`. */
export const SYNC_QUEUE_STORAGE_KEY = 'mentalreset:syncQueue';

export type SyncQueueJob = {
  id: string;
  entityType: string;
  entityId: string;
  queuedAt?: number;
  attempts?: number;
};

export async function getSyncQueueFromLocalStorage(page: Page): Promise<SyncQueueJob[]> {
  return page.evaluate((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as SyncQueueJob[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, SYNC_QUEUE_STORAGE_KEY);
}

export async function getPendingTaskSyncJobIds(page: Page): Promise<string[]> {
  const queue = await getSyncQueueFromLocalStorage(page);
  return queue.filter((job) => job.entityType === 'task').map((job) => job.entityId);
}

import { getSettings } from '@/lib/db/repositories/settingsRepository';
import { getAllSessionSummaries } from '@/lib/db/repositories/sessionSummaryRepository';
import { getAllTasks } from '@/lib/db/repositories/taskRepository';
import {
  createFirestoreWriter,
  resolveSyncUid,
  type SyncWriter,
} from '@/lib/sync/firestoreWriter';
import { useSyncStore } from '@/stores/syncStore';

export type SyncEntityType = 'task' | 'summary' | 'settings';

export interface SyncJob {
  /** Deduped key: `${entityType}:${entityId}` */
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  queuedAt: number;
  attempts: number;
}

export type { SyncWriter };

const SETTINGS_ENTITY_ID = 'settings';
const FLUSH_DEBOUNCE_MS = 400;
const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 500;
const QUEUE_STORAGE_KEY = 'mentalreset:syncQueue';

let queue: SyncJob[] = [];
let writer: SyncWriter = createFirestoreWriter();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let backoffTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let initialized = false;
let consecutiveFailures = 0;

function jobId(entityType: SyncEntityType, entityId: string): string {
  return `${entityType}:${entityId}`;
}

function updatePendingCount(): void {
  useSyncStore.getState().setPendingCount(queue.length);
}

function persistQueue(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Quota / private mode — in-memory queue still works for this session.
  }
}

function loadPersistedQueue(): SyncJob[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as SyncJob[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (job) =>
        job &&
        typeof job.id === 'string' &&
        typeof job.entityType === 'string' &&
        typeof job.entityId === 'string',
    );
  } catch {
    return [];
  }
}

function scheduleFlush(delayMs = FLUSH_DEBOUNCE_MS): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
  }

  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushSyncQueue();
  }, delayMs);
}

function scheduleBackoff(): void {
  consecutiveFailures += 1;
  const delay = Math.min(BASE_BACKOFF_MS * 2 ** (consecutiveFailures - 1), MAX_BACKOFF_MS);

  if (backoffTimer) {
    clearTimeout(backoffTimer);
  }

  backoffTimer = setTimeout(() => {
    backoffTimer = null;
    void flushSyncQueue();
  }, delay);
}

function enqueue(entityType: SyncEntityType, entityId: string): void {
  const id = jobId(entityType, entityId);
  const existing = queue.find((job) => job.id === id);

  if (existing) {
    existing.queuedAt = Date.now();
  } else {
    queue.push({
      id,
      entityType,
      entityId,
      queuedAt: Date.now(),
      attempts: 0,
    });
  }

  persistQueue();
  updatePendingCount();

  if (typeof navigator === 'undefined' || navigator.onLine) {
    scheduleFlush();
  }
}

export function enqueueTaskSync(taskId: string): void {
  enqueue('task', taskId);
}

export function enqueueSummarySync(summaryId: string): void {
  enqueue('summary', summaryId);
}

export function enqueueSettingsSync(): void {
  enqueue('settings', SETTINGS_ENTITY_ID);
}

export function getPendingSyncJobs(): readonly SyncJob[] {
  return queue;
}

export function getPendingSyncCount(): number {
  return queue.length;
}

async function processJob(job: SyncJob, uid: string): Promise<void> {
  switch (job.entityType) {
    case 'task': {
      const tasks = await getAllTasks();
      const task = tasks.find((item) => item.id === job.entityId);
      if (!task) {
        return;
      }
      await writer.writeTask(uid, task);
      return;
    }
    case 'summary': {
      const summaries = await getAllSessionSummaries();
      const summary = summaries.find((item) => item.id === job.entityId);
      if (!summary) {
        return;
      }
      await writer.writeSummary(uid, summary);
      return;
    }
    case 'settings': {
      const settings = await getSettings();
      await writer.writeSettings(uid, settings);
      return;
    }
  }
}

/**
 * Flush pending sync jobs to Firestore when online and authenticated.
 * Failed jobs stay queued; local Dexie data is never rolled back.
 */
export async function flushSyncQueue(): Promise<void> {
  if (flushing) {
    return;
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    useSyncStore.getState().setOnline(false);
    return;
  }

  const uid = resolveSyncUid();
  if (!uid) {
    // Firebase blocked / no auth — app stays usable offline; keep queue.
    return;
  }

  if (queue.length === 0) {
    return;
  }

  flushing = true;
  useSyncStore.getState().setOnline(true);

  const snapshot = [...queue];
  const completedIds = new Set<string>();

  try {
    for (const job of snapshot) {
      try {
        await processJob(job, uid);
        completedIds.add(job.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sync failed';
        useSyncStore.getState().setLastError(message);

        queue = queue
          .filter((j) => !completedIds.has(j.id))
          .map((j) => (j.id === job.id ? { ...j, attempts: j.attempts + 1 } : j));
        persistQueue();
        updatePendingCount();
        scheduleBackoff();
        return;
      }
    }

    queue = queue.filter((j) => !completedIds.has(j.id));
    persistQueue();
    updatePendingCount();
    consecutiveFailures = 0;
    useSyncStore.getState().setLastError(null);
    useSyncStore.getState().setLastSyncAt(Date.now());
  } finally {
    flushing = false;
  }
}

function handleOnline(): void {
  useSyncStore.getState().setOnline(true);
  scheduleFlush(0);
}

function handleOffline(): void {
  useSyncStore.getState().setOnline(false);
}

export function initSyncEngine(options?: { writer?: SyncWriter }): void {
  if (options?.writer) {
    writer = options.writer;
  }

  if (initialized) {
    updatePendingCount();
    if (typeof navigator === 'undefined' || navigator.onLine) {
      scheduleFlush(0);
    }
    return;
  }

  initialized = true;
  queue = loadPersistedQueue();
  updatePendingCount();

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  if (typeof navigator === 'undefined' || navigator.onLine) {
    scheduleFlush(0);
  }
}

export function resetSyncEngineForTests(options?: { writer?: SyncWriter }): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (backoffTimer) {
    clearTimeout(backoffTimer);
    backoffTimer = null;
  }

  queue = [];
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
  }
  flushing = false;
  initialized = false;
  consecutiveFailures = 0;
  writer = options?.writer ?? createFirestoreWriter();

  useSyncStore.getState().setPendingCount(0);
  useSyncStore.getState().setLastError(null);
  useSyncStore.getState().setLastSyncAt(null);
}

/** Test helper: replace the Firestore writer without re-init. */
export function setSyncWriterForTests(next: SyncWriter): void {
  writer = next;
}

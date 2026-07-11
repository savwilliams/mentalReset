import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/lib/db/database';
import { saveSessionSummary } from '@/lib/db/repositories/sessionSummaryRepository';
import { saveSettings } from '@/lib/db/repositories/settingsRepository';
import { saveTask, saveTasks } from '@/lib/db/repositories/taskRepository';
import type { SyncWriter } from '@/lib/sync/firestoreWriter';
import {
  enqueueTaskSync,
  flushSyncQueue,
  getPendingSyncCount,
  getPendingSyncJobs,
  initSyncEngine,
  resetSyncEngineForTests,
} from '@/lib/sync/syncEngine';
import { useSyncStore } from '@/stores/syncStore';
import type { SessionSummary } from '@/types/session';
import type { UserSettings } from '@/types/settings';
import type { Task } from '@/types/task';

vi.mock('@/lib/firebase/auth', () => ({
  getAuthUid: vi.fn(() => 'uid-test'),
}));

import { getAuthUid } from '@/lib/firebase/auth';

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    text: 'Ship sync',
    category: 'TODAY',
    completed: false,
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

function createSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: 'sum-1',
    completedAt: 10,
    tasksCreated: 1,
    releasedCount: 0,
    estimatedTimeTotal: 15,
    ...overrides,
  };
}

function createSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    id: 'local',
    notificationsEnabled: false,
    theme: 'system',
    updatedAt: 5,
    ...overrides,
  };
}

describe('syncEngine', () => {
  let writer: SyncWriter;
  let writtenTasks: Task[];
  let writtenSummaries: SessionSummary[];
  let writtenSettings: UserSettings[];

  beforeEach(async () => {
    writtenTasks = [];
    writtenSummaries = [];
    writtenSettings = [];

    writer = {
      writeTask: vi.fn(async (_uid, task) => {
        writtenTasks.push(task);
      }),
      writeSummary: vi.fn(async (_uid, summary) => {
        writtenSummaries.push(summary);
      }),
      writeSettings: vi.fn(async (_uid, settings) => {
        writtenSettings.push(settings);
      }),
    };

    resetSyncEngineForTests({ writer });
    vi.mocked(getAuthUid).mockReturnValue('uid-test');

    if (db.isOpen()) {
      await db.close();
    }
    await db.delete();
    await db.open();

    useSyncStore.setState({
      isOnline: true,
      pendingCount: 0,
      lastSyncAt: null,
      lastError: null,
    });

    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });
  });

  afterEach(async () => {
    resetSyncEngineForTests();
    vi.useRealTimers();
    if (db.isOpen()) {
      await db.tasks.clear();
      await db.sessionSummaries.clear();
      await db.settings.clear();
    }
  });

  it('enqueues after Dexie task writes and dedupes by entity id', async () => {
    const task = createTask();
    await saveTask(task);
    await saveTask({ ...task, updatedAt: 3, text: 'Updated' });

    const jobs = getPendingSyncJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.entityType).toBe('task');
    expect(jobs[0]?.entityId).toBe('task-1');
    expect(useSyncStore.getState().pendingCount).toBe(1);
  });

  it('queues offline and flushes when online (AC-4)', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });

    await saveTask(createTask());
    await saveSessionSummary(createSummary());
    await saveSettings(createSettings());

    expect(getPendingSyncCount()).toBe(3);

    await flushSyncQueue();
    expect(writtenTasks).toHaveLength(0);

    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });

    initSyncEngine({ writer });
    await flushSyncQueue();

    expect(writtenTasks).toHaveLength(1);
    expect(writtenSummaries).toHaveLength(1);
    expect(writtenSettings).toHaveLength(1);
    expect(getPendingSyncCount()).toBe(0);
    expect(useSyncStore.getState().lastSyncAt).not.toBeNull();
    expect(useSyncStore.getState().lastError).toBeNull();
  });

  it('keeps the queue and local data when Firebase auth is unavailable (AC-2)', async () => {
    vi.mocked(getAuthUid).mockReturnValue(null);

    await saveTask(createTask());
    expect(getPendingSyncCount()).toBe(1);

    await flushSyncQueue();

    expect(writtenTasks).toHaveLength(0);
    expect(getPendingSyncCount()).toBe(1);
    expect(await db.tasks.get('task-1')).toMatchObject({ text: 'Ship sync' });
  });

  it('retries after mid-batch failure without rolling back Dexie', async () => {
    writer.writeTask = vi
      .fn()
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValue(undefined);

    resetSyncEngineForTests({ writer });

    await saveTasks([createTask({ id: 'a' }), createTask({ id: 'b', text: 'B' })]);
    expect(getPendingSyncCount()).toBe(2);

    await flushSyncQueue();

    expect(useSyncStore.getState().lastError).toBe('network blip');
    expect(getPendingSyncCount()).toBeGreaterThan(0);
    expect(await db.tasks.count()).toBe(2);

    await flushSyncQueue();

    expect(getPendingSyncCount()).toBe(0);
    expect(useSyncStore.getState().lastError).toBeNull();
    expect(await db.tasks.count()).toBe(2);
  });

  it('does not enqueue thought/session blobs — only syncable entities', () => {
    enqueueTaskSync('task-1');
    const types = getPendingSyncJobs().map((job) => job.entityType);
    expect(types).toEqual(['task']);
    expect(types).not.toContain('session');
    expect(types).not.toContain('thought');
  });
});

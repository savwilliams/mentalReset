import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DB_NAME, db, openDatabase } from '@/lib/db/database';
import { initDataLayer, resetDataLayerForTests } from '@/lib/db/init';
import { settingsPersist, taskPersist } from '@/lib/db/middleware/persistControllers';
import { persistSessionSnapshot } from '@/lib/db/persist';
import { getActiveSession } from '@/lib/db/repositories/sessionRepository';
import { getSettings } from '@/lib/db/repositories/settingsRepository';
import { getAllTasks } from '@/lib/db/repositories/taskRepository';
import { hydrateSessionStore, useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTaskStore } from '@/stores/taskStore';
import type { Task } from '@/types/task';

function createTask(text: string, id = crypto.randomUUID()): Task {
  const now = Date.now();
  return {
    id,
    text,
    category: 'TODAY',
    completed: false,
    createdAt: now,
    updatedAt: now,
  };
}

describe('Dexie persist middleware', () => {
  beforeEach(async () => {
    resetDataLayerForTests();

    if (db.isOpen()) {
      await db.close();
    }
    await db.delete();
    await db.open();

    useSessionStore.setState({
      state: 'IDLE',
      sessionId: null,
      createdAt: null,
      thoughts: [],
      stats: {
        thoughtsCount: 0,
        tasksCreated: 0,
        releasedCount: 0,
        estimatedTimeTotal: 0,
      },
      isTransitioning: false,
      isHydrated: false,
    });
    useTaskStore.setState({ tasks: [], isHydrated: false });
    useSettingsStore.setState({ settings: null, isHydrated: false });
  });

  afterEach(async () => {
    resetDataLayerForTests();
    if (db.isOpen()) {
      await db.tasks.clear();
      await db.sessions.clear();
      await db.settings.clear();
    }
  });

  it('persists and rehydrates an active session', async () => {
    useSessionStore.getState().startSession();
    useSessionStore.getState().setThoughts([{ id: 't1', text: 'Buy milk' }]);
    await persistSessionSnapshot();

    const stored = await getActiveSession();
    expect(stored?.state).toBe('BRAIN_DUMP');
    expect(stored?.thoughts).toEqual([{ id: 't1', text: 'Buy milk' }]);

    useSessionStore.getState().resetToIdle();
    useSessionStore.setState({ isHydrated: false });
    hydrateSessionStore(stored);

    expect(useSessionStore.getState().state).toBe('BRAIN_DUMP');
    expect(useSessionStore.getState().thoughts).toEqual([{ id: 't1', text: 'Buy milk' }]);
  });

  it('initializes stores from Dexie', async () => {
    useSessionStore.getState().startSession();
    useSessionStore.getState().applyTransition('SORTING');
    await persistSessionSnapshot();

    useSessionStore.getState().resetToIdle();
    useSessionStore.setState({ isHydrated: false });
    useTaskStore.setState({ isHydrated: false });
    useSettingsStore.setState({ isHydrated: false });

    await initDataLayer();

    expect(useSessionStore.getState().state).toBe('SORTING');
    expect(useSessionStore.getState().isHydrated).toBe(true);
  });

  it('persists task store changes after middleware starts', async () => {
    await initDataLayer();

    const task = createTask('Write tests');
    useTaskStore.getState().setTasks([task]);
    await taskPersist.flush();

    const stored = await getAllTasks();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.text).toBe('Write tests');
  });

  it('persists settings store changes after middleware starts', async () => {
    await initDataLayer();

    const settings = useSettingsStore.getState().settings;
    expect(settings).not.toBeNull();

    useSettingsStore.getState().setSettings({
      ...settings!,
      notificationsEnabled: true,
      updatedAt: Date.now(),
    });

    await settingsPersist.flush();

    const stored = await getSettings();
    expect(stored.notificationsEnabled).toBe(true);
  });

  it('does not overwrite Dexie tasks during hydration', async () => {
    const task = createTask('Keep me');
    await db.tasks.put(task);

    await initDataLayer();

    const stored = await getAllTasks();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.text).toBe('Keep me');
    expect(useTaskStore.getState().tasks).toHaveLength(1);
  });

  it('migrates v1 data to v2 without data loss', async () => {
    if (db.isOpen()) {
      db.close();
    }
    await db.delete();

    const legacyDb = new Dexie(DB_NAME);
    legacyDb.version(1).stores({
      tasks: 'id, category, completed, updatedAt',
      sessions: 'id, state, createdAt',
      sessionSummaries: 'id, completedAt',
      settings: 'id, updatedAt',
    });
    await legacyDb.open();

    await legacyDb.table('tasks').put({
      id: 'legacy-task-1',
      text: 'Legacy task',
      category: 'TODAY',
      completed: false,
      updatedAt: 101,
    });
    await legacyDb.table('sessions').put({
      id: 'legacy-session-1',
      state: 'BRAIN_DUMP',
      createdAt: 102,
      thoughts: [{ id: 'thought-1', text: 'Legacy thought' }],
    });
    await legacyDb.table('sessionSummaries').put({
      id: 'legacy-summary-1',
      completedAt: 103,
      tasksCreated: 2,
      releasedCount: 1,
      estimatedTimeTotal: 30,
    });
    await legacyDb.table('settings').put({
      id: 'legacy-settings-id',
      notificationsEnabled: 1,
      updatedAt: 104,
    });
    await legacyDb.close();

    await openDatabase();

    const migratedTask = await db.tasks.get('legacy-task-1');
    expect(migratedTask?.id).toBe('legacy-task-1');
    expect(migratedTask?.text).toBe('Legacy task');
    expect(migratedTask?.updatedAt).toBe(101);
    expect(migratedTask?.createdAt).toBe(101);

    const migratedSession = await db.sessions.get('legacy-session-1');
    expect(migratedSession?.id).toBe('legacy-session-1');
    expect(migratedSession?.state).toBe('BRAIN_DUMP');
    expect(migratedSession?.thoughts).toEqual([{ id: 'thought-1', text: 'Legacy thought' }]);
    expect(migratedSession?.stats).toBeDefined();

    const migratedSummary = await db.sessionSummaries.get('legacy-summary-1');
    expect(migratedSummary).toEqual({
      id: 'legacy-summary-1',
      completedAt: 103,
      tasksCreated: 2,
      releasedCount: 1,
      estimatedTimeTotal: 30,
    });

    const migratedSettings = await db.settings.get('local');
    expect(migratedSettings).toEqual({
      id: 'local',
      notificationsEnabled: true,
      theme: 'system',
      updatedAt: 104,
    });
  });
});

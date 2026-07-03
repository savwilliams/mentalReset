import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/db/database';
import { initDataLayer, resetDataLayerForTests } from '@/lib/db/init';
import { persistSessionSnapshot } from '@/lib/db/persist';
import { getActiveSession } from '@/lib/db/repositories/sessionRepository';
import { hydrateSessionStore, useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTaskStore } from '@/stores/taskStore';

describe('Dexie session persistence', () => {
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
      await db.sessions.clear();
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
});

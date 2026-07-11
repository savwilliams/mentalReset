import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/lib/db/database';
import { initDataLayer, resetDataLayerForTests } from '@/lib/db/init';
import { persistSessionSnapshot } from '@/lib/db/persist';
import {
  parseActiveSession,
  recoverActiveSessionFromDb,
} from '@/lib/db/sessionRecovery';
import { saveSessionSummary } from '@/lib/db/repositories/sessionSummaryRepository';
import { hydrateSessionStore, useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTaskStore } from '@/stores/taskStore';
import { createActiveSession, createEmptySessionStats } from '@/types/session';

function resetStores(): void {
  useSessionStore.setState({
    state: 'IDLE',
    sessionId: null,
    createdAt: null,
    thoughts: [],
    stats: createEmptySessionStats(),
    isTransitioning: false,
    isHydrated: false,
  });
  useTaskStore.setState({ tasks: [], isHydrated: false });
  useSettingsStore.setState({ settings: null, isHydrated: false });
}

describe('session recovery hardening', () => {
  beforeEach(async () => {
    resetDataLayerForTests();
    vi.restoreAllMocks();

    if (db.isOpen()) {
      await db.close();
    }
    await db.delete();
    await db.open();
    resetStores();
  });

  afterEach(async () => {
    resetDataLayerForTests();
    if (db.isOpen()) {
      await db.sessions.clear();
      await db.sessionSummaries.clear();
    }
  });

  describe('parseActiveSession', () => {
    it('accepts a valid active session including SUMMARY', () => {
      const session = createActiveSession('SUMMARY');
      session.thoughts = [{ id: 't1', text: 'Ship it', resolvedAs: 'TASK', priority: 'TODAY' }];

      expect(parseActiveSession(session)).toEqual(session);
    });

    it('rejects corrupt blobs', () => {
      expect(parseActiveSession(null)).toBeNull();
      expect(parseActiveSession({ id: 'x' })).toBeNull();
      expect(
        parseActiveSession({
          id: 'x',
          state: 'NOT_A_STATE',
          createdAt: 1,
          stats: createEmptySessionStats(),
          thoughts: [],
        }),
      ).toBeNull();
      expect(
        parseActiveSession({
          id: 'x',
          state: 'BRAIN_DUMP',
          createdAt: 1,
          stats: createEmptySessionStats(),
          thoughts: [{ id: 't1' }],
        }),
      ).toBeNull();
    });
  });

  it('rehydrates SUMMARY so the user can Finish', async () => {
    const session = createActiveSession('SUMMARY');
    session.thoughts = [{ id: 't1', text: 'Done thinking', resolvedAs: 'RELEASE' }];
    session.stats = {
      thoughtsCount: 1,
      tasksCreated: 0,
      releasedCount: 1,
      estimatedTimeTotal: 0,
    };
    await db.sessions.put(session);

    const outcome = await recoverActiveSessionFromDb();
    expect(outcome).toEqual({ status: 'active', session });

    hydrateSessionStore(session);
    expect(useSessionStore.getState().state).toBe('SUMMARY');
    expect(useSessionStore.getState().thoughts).toHaveLength(1);
  });

  it('clears a completed session row and keeps the summary', async () => {
    const session = createActiveSession('SUMMARY');
    session.completedAt = Date.now();
    session.stats = {
      thoughtsCount: 2,
      tasksCreated: 1,
      releasedCount: 1,
      estimatedTimeTotal: 25,
    };
    await db.sessions.put(session);
    await saveSessionSummary({
      id: session.id,
      completedAt: session.completedAt,
      tasksCreated: 1,
      releasedCount: 1,
      estimatedTimeTotal: 25,
    });

    const outcome = await recoverActiveSessionFromDb();
    expect(outcome.status).toBe('cleared_completed');
    expect(await db.sessions.count()).toBe(0);
    expect(await db.sessionSummaries.get(session.id)).toMatchObject({
      id: session.id,
      tasksCreated: 1,
      releasedCount: 1,
      estimatedTimeTotal: 25,
    });
  });

  it('salvages a summary when completedAt is set but summary is missing', async () => {
    const session = createActiveSession('SUMMARY');
    session.completedAt = 1_700_000_000_000;
    session.stats = {
      thoughtsCount: 3,
      tasksCreated: 2,
      releasedCount: 1,
      estimatedTimeTotal: 40,
    };
    await db.sessions.put(session);

    const outcome = await recoverActiveSessionFromDb();
    expect(outcome.status).toBe('cleared_completed');
    expect(await db.sessions.count()).toBe(0);
    expect(await db.sessionSummaries.get(session.id)).toEqual({
      id: session.id,
      completedAt: session.completedAt,
      tasksCreated: 2,
      releasedCount: 1,
      estimatedTimeTotal: 40,
    });
  });

  it('treats a session with a matching summary as completed', async () => {
    const session = createActiveSession('RELEASE');
    await db.sessions.put(session);
    await saveSessionSummary({
      id: session.id,
      completedAt: Date.now(),
      tasksCreated: 0,
      releasedCount: 0,
      estimatedTimeTotal: 0,
    });

    const outcome = await recoverActiveSessionFromDb();
    expect(outcome.status).toBe('cleared_completed');
    expect(await db.sessions.count()).toBe(0);
    expect(await db.sessionSummaries.count()).toBe(1);
  });

  it('resets corrupt session blobs to IDLE and logs an error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await db.sessions.put({
      id: 'corrupt',
      state: 'BRAIN_DUMP',
      createdAt: Date.now(),
      stats: createEmptySessionStats(),
      thoughts: 'not-an-array',
    } as never);

    const outcome = await recoverActiveSessionFromDb();
    expect(outcome.status).toBe('cleared_corrupt');
    expect(await db.sessions.count()).toBe(0);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('initializes IDLE when the recovered session was corrupt', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await db.sessions.put({
      id: 'bad',
      state: 'SORTING',
      createdAt: -1,
      stats: createEmptySessionStats(),
      thoughts: [],
    } as never);

    await initDataLayer();

    expect(useSessionStore.getState().state).toBe('IDLE');
    expect(useSessionStore.getState().isHydrated).toBe(true);
    expect(await db.sessions.count()).toBe(0);
  });

  it('rehydrates mid-session FSM state through initDataLayer (AC-6)', async () => {
    useSessionStore.getState().startSession('PRIORITIZATION');
    useSessionStore.getState().setThoughts([
      { id: 't1', text: 'Write tests', resolvedAs: 'TASK', priority: 'TODAY' },
    ]);
    await persistSessionSnapshot();

    resetStores();
    await initDataLayer();

    expect(useSessionStore.getState().state).toBe('PRIORITIZATION');
    expect(useSessionStore.getState().thoughts[0]?.text).toBe('Write tests');
    expect(useSessionStore.getState().isHydrated).toBe(true);
  });

  it('clears IDLE rows left in Dexie instead of rehydrating them', async () => {
    await db.sessions.put({
      ...createActiveSession('BRAIN_DUMP'),
      state: 'IDLE',
    });

    const outcome = await recoverActiveSessionFromDb();
    expect(outcome.status).toBe('idle');
    expect(await db.sessions.count()).toBe(0);
  });
});

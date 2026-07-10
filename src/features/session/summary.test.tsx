import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SessionView } from '@/features/session';
import { SessionGuardProvider } from '@/features/shell';
import { completeSession } from '@/lib/db/persist';
import { db } from '@/lib/db/database';
import { resetDataLayerForTests } from '@/lib/db/init';
import { getActiveSession, saveActiveSession } from '@/lib/db/repositories/sessionRepository';
import { getAllSessionSummaries } from '@/lib/db/repositories/sessionSummaryRepository';
import { useSessionActions } from '@/lib/sessionMachine/useSessionActions';
import { useSessionStore } from '@/stores/sessionStore';
import {
  buildSessionSummary,
  createEmptySessionStats,
  type ActiveSession,
  type Thought,
} from '@/types/session';

function resetStores(
  state: 'IDLE' | 'SUMMARY' = 'SUMMARY',
  thoughts: Thought[] = [],
  stats = {
    ...createEmptySessionStats(),
    thoughtsCount: 3,
    tasksCreated: 2,
    releasedCount: 1,
    estimatedTimeTotal: 45,
  },
) {
  useSessionStore.setState({
    state,
    sessionId: state === 'IDLE' ? null : 'session-summary',
    createdAt: state === 'IDLE' ? null : 1_700_000_000_000,
    thoughts,
    stats,
    isTransitioning: false,
    isHydrated: true,
  });
}

function renderSummary() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <SessionGuardProvider>
        <SessionView />
      </SessionGuardProvider>
    </MemoryRouter>,
  );
}

const remainingThoughts: Thought[] = [
  { id: 'keep-1', text: 'Call dentist', resolvedAs: 'TASK', priority: 'TODAY' },
  { id: 'keep-2', text: 'Buy groceries', resolvedAs: 'TASK', priority: 'SOON' },
];

describe('buildSessionSummary', () => {
  it('maps stats only and never includes thought text', () => {
    const session: ActiveSession = {
      id: 'session-1',
      state: 'SUMMARY',
      createdAt: 100,
      thoughts: [
        { id: 't1', text: 'Secret worry that must not leak' },
        { id: 't2', text: 'Call dentist', resolvedAs: 'TASK', priority: 'TODAY' },
      ],
      stats: {
        thoughtsCount: 2,
        tasksCreated: 1,
        releasedCount: 1,
        estimatedTimeTotal: 30,
      },
    };

    const summary = buildSessionSummary(session, 200);

    expect(summary).toEqual({
      id: 'session-1',
      completedAt: 200,
      tasksCreated: 1,
      releasedCount: 1,
      estimatedTimeTotal: 30,
    });
    expect(JSON.stringify(summary)).not.toMatch(/Secret worry/);
    expect(JSON.stringify(summary)).not.toMatch(/Call dentist/);
  });
});

describe('completeSession', () => {
  beforeEach(async () => {
    resetDataLayerForTests();
    if (db.isOpen()) {
      await db.close();
    }
    await db.delete();
    await db.open();
  });

  it('atomically writes SessionSummary and clears the active session', async () => {
    const session: ActiveSession = {
      id: 'session-complete',
      state: 'SUMMARY',
      createdAt: 100,
      thoughts: remainingThoughts,
      stats: {
        thoughtsCount: 2,
        tasksCreated: 2,
        releasedCount: 1,
        estimatedTimeTotal: 45,
      },
    };

    await saveActiveSession(session);
    expect(await getActiveSession()).toBeDefined();

    const summary = await completeSession(session);

    expect(summary.id).toBe('session-complete');
    expect(await getActiveSession()).toBeUndefined();
    expect(await getAllSessionSummaries()).toEqual([
      expect.objectContaining({
        id: 'session-complete',
        tasksCreated: 2,
        releasedCount: 1,
        estimatedTimeTotal: 45,
      }),
    ]);
    expect(JSON.stringify(await getAllSessionSummaries())).not.toMatch(/Call dentist/);
  });
});

describe('SummaryScreen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    resetDataLayerForTests();
    if (db.isOpen()) {
      await db.close();
    }
    await db.delete();
    await db.open();
    resetStores('SUMMARY', remainingThoughts);
  });

  it('shows tasks created, estimated time, and items released', () => {
    renderSummary();

    expect(screen.getByRole('heading', { name: /^summary$/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /session summary/i })).toBeInTheDocument();
    expect(screen.getByText('2 tasks created')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('1 item released')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /finish session/i })).toBeEnabled();
  });

  it('Finish writes SessionSummary, clears ephemeral data, and returns to IDLE', async () => {
    await saveActiveSession({
      id: 'session-summary',
      state: 'SUMMARY',
      createdAt: 1_700_000_000_000,
      thoughts: remainingThoughts,
      stats: {
        thoughtsCount: 2,
        tasksCreated: 2,
        releasedCount: 1,
        estimatedTimeTotal: 45,
      },
    });

    renderSummary();

    fireEvent.click(screen.getByRole('button', { name: /finish session/i }));

    await waitFor(() => {
      expect(useSessionStore.getState().state).toBe('IDLE');
    });

    expect(useSessionStore.getState().sessionId).toBeNull();
    expect(useSessionStore.getState().thoughts).toEqual([]);
    expect(await getActiveSession()).toBeUndefined();

    const summaries = await getAllSessionSummaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toEqual(
      expect.objectContaining({
        id: 'session-summary',
        tasksCreated: 2,
        releasedCount: 1,
        estimatedTimeTotal: 45,
      }),
    );
    expect(JSON.stringify(summaries)).not.toMatch(/Call dentist/);
    expect(JSON.stringify(summaries)).not.toMatch(/Buy groceries/);
  });

  it('Abandon clears the session without writing a SessionSummary', async () => {
    await saveActiveSession({
      id: 'session-summary',
      state: 'SUMMARY',
      createdAt: 1_700_000_000_000,
      thoughts: remainingThoughts,
      stats: {
        thoughtsCount: 2,
        tasksCreated: 2,
        releasedCount: 1,
        estimatedTimeTotal: 45,
      },
    });

    function Probe() {
      const { abandon } = useSessionActions();
      return (
        <button type="button" onClick={() => void abandon()}>
          Force abandon
        </button>
      );
    }

    render(
      <MemoryRouter>
        <SessionGuardProvider>
          <Probe />
        </SessionGuardProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /force abandon/i }));

    await waitFor(() => {
      expect(useSessionStore.getState().state).toBe('IDLE');
    });

    expect(await getActiveSession()).toBeUndefined();
    expect(await getAllSessionSummaries()).toEqual([]);
  });
});

import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionView } from '@/features/session';
import {
  discardReleaseQueue,
  getCanDoWithoutThoughts,
  getReleaseQueueThoughts,
  getSortingReleaseThoughts,
  isCanDoWithoutThought,
  isReleaseComplete,
  isReleaseQueueThought,
  isSortingReleaseThought,
} from '@/features/session/hooks/useReleaseQueue';
import { SessionGuardProvider } from '@/features/shell';
import { db } from '@/lib/db/database';
import { resetDataLayerForTests } from '@/lib/db/init';
import { getActiveSession } from '@/lib/db/repositories/sessionRepository';
import { awaitInFlightSessionPersist, useSessionActions } from '@/lib/sessionMachine/useSessionActions';
import { useSessionStore } from '@/stores/sessionStore';
import { createEmptySessionStats } from '@/types/session';
import type { Thought } from '@/types/session';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return {
    ...actual,
    useReducedMotion: () => true,
  };
});

function resetStores(state: 'IDLE' | 'RELEASE' = 'RELEASE', thoughts: Thought[] = []) {
  useSessionStore.setState({
    state,
    sessionId: state === 'IDLE' ? null : 'session-release',
    createdAt: state === 'IDLE' ? null : Date.now(),
    thoughts,
    stats: {
      ...createEmptySessionStats(),
      thoughtsCount: thoughts.length,
      tasksCreated: thoughts.filter(
        (thought) =>
          thought.priority === 'TODAY' ||
          thought.priority === 'SOON' ||
          thought.priority === 'LATER',
      ).length,
    },
    isTransitioning: false,
    isHydrated: true,
  });
}

function renderRelease() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <SessionGuardProvider>
        <SessionView />
      </SessionGuardProvider>
    </MemoryRouter>,
  );
}

const mixedThoughts: Thought[] = [
  { id: 'keep-1', text: 'Call dentist', resolvedAs: 'TASK', priority: 'TODAY' },
  { id: 'rel-1', text: 'Worry about weather', resolvedAs: 'RELEASE' },
  { id: 'cdw-1', text: 'Reorganize entire garage', resolvedAs: 'TASK', priority: 'CAN_DO_WITHOUT' },
  { id: 'keep-2', text: 'Buy groceries', resolvedAs: 'TASK', priority: 'SOON' },
];

describe('release helpers', () => {
  it('splits sorting releases and can-do-without into the release queue', () => {
    expect(isSortingReleaseThought(mixedThoughts[1]!)).toBe(true);
    expect(isCanDoWithoutThought(mixedThoughts[2]!)).toBe(true);
    expect(isReleaseQueueThought(mixedThoughts[0]!)).toBe(false);
    expect(getSortingReleaseThoughts(mixedThoughts).map((t) => t.id)).toEqual(['rel-1']);
    expect(getCanDoWithoutThoughts(mixedThoughts).map((t) => t.id)).toEqual(['cdw-1']);
    expect(getReleaseQueueThoughts(mixedThoughts).map((t) => t.id)).toEqual(['rel-1', 'cdw-1']);
  });

  it('discards release-queue items and leaves task thoughts intact', () => {
    const { remaining, releasedCount } = discardReleaseQueue(mixedThoughts);

    expect(releasedCount).toBe(2);
    expect(remaining).toEqual([
      expect.objectContaining({ id: 'keep-1' }),
      expect.objectContaining({ id: 'keep-2' }),
    ]);
    expect(remaining.some((thought) => thought.text.includes('Worry'))).toBe(false);
    expect(isReleaseComplete(remaining)).toBe(true);
  });

  it('treats an empty queue as already complete', () => {
    expect(isReleaseComplete([{ id: '1', text: 'Task', resolvedAs: 'TASK', priority: 'LATER' }])).toBe(
      true,
    );
    expect(discardReleaseQueue([]).releasedCount).toBe(0);
  });
});

describe('ReleaseScreen', () => {
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
    resetStores('RELEASE', mixedThoughts);
  });

  it('renders both release lists and disables Continue until Release All', () => {
    renderRelease();

    expect(screen.getByRole('heading', { name: /^release$/i })).toBeInTheDocument();
    expect(screen.getByText('Worry about weather')).toBeInTheDocument();
    expect(screen.getByText('Reorganize entire garage')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /release list/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /can do without/i })).toBeInTheDocument();
    expect(screen.queryByText('Call dentist')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /release all/i })).toBeInTheDocument();
  });

  it('Release All discards content, updates releasedCount, and enables Continue', async () => {
    renderRelease();

    fireEvent.click(screen.getByRole('button', { name: /release all/i }));

    expect(useSessionStore.getState().stats.releasedCount).toBe(2);
    expect(useSessionStore.getState().thoughts).toEqual([
      expect.objectContaining({ id: 'keep-1' }),
      expect.objectContaining({ id: 'keep-2' }),
    ]);
    expect(useSessionStore.getState().thoughts.some((t) => t.text.includes('Worry'))).toBe(false);
    expect(useSessionStore.getState().thoughts.some((t) => t.text.includes('garage'))).toBe(false);

    expect(screen.queryByRole('button', { name: /release all/i })).not.toBeInTheDocument();
    expect(screen.getByText(/these thoughts have been released/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => {
      expect(useSessionStore.getState().state).toBe('SUMMARY');
    });
  });

  it('shows an affirming empty state and allows Continue when both lists are empty', () => {
    resetStores('RELEASE', [
      { id: 'keep-1', text: 'Call dentist', resolvedAs: 'TASK', priority: 'TODAY' },
    ]);
    renderRelease();

    expect(screen.getByText(/nothing to release right now/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /release all/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeEnabled();
  });

  it('persists discarded release queue and releasedCount to Dexie', async () => {
    renderRelease();

    fireEvent.click(screen.getByRole('button', { name: /release all/i }));
    await awaitInFlightSessionPersist();

    const storedSession = await getActiveSession();
    expect(storedSession?.stats.releasedCount).toBe(2);
    expect(storedSession?.thoughts).toEqual([
      expect.objectContaining({ id: 'keep-1' }),
      expect.objectContaining({ id: 'keep-2' }),
    ]);
    expect(JSON.stringify(storedSession?.thoughts)).not.toMatch(/Worry about weather/);
    expect(JSON.stringify(storedSession?.thoughts)).not.toMatch(/Reorganize entire garage/);
  });
});

describe('Release continue guard', () => {
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
    resetStores('RELEASE', [
      { id: 'rel-1', text: 'Still here', resolvedAs: 'RELEASE' },
    ]);
  });

  it('ignores CONTINUE while release-queue items remain', async () => {
    function Probe() {
      const { continue: continueSession } = useSessionActions();
      return (
        <button type="button" onClick={() => void continueSession()}>
          Force continue
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

    fireEvent.click(screen.getByRole('button', { name: /force continue/i }));

    await waitFor(() => {
      expect(useSessionStore.getState().state).toBe('RELEASE');
    });
  });
});

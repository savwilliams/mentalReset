import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SessionView } from '@/features/session';
import {
  areAllThoughtsResolved,
  isThoughtResolved,
} from '@/features/session/hooks/useSortingQueue';
import { SessionGuardProvider } from '@/features/shell';
import { db } from '@/lib/db/database';
import { resetDataLayerForTests } from '@/lib/db/init';
import { getActiveSession } from '@/lib/db/repositories/sessionRepository';
import { useSessionActions, awaitInFlightSessionPersist } from '@/lib/sessionMachine/useSessionActions';
import { useSessionStore } from '@/stores/sessionStore';
import { createEmptySessionStats } from '@/types/session';
import type { Thought } from '@/types/session';

function resetStores(state: 'IDLE' | 'SORTING' = 'SORTING', thoughts: Thought[] = []) {
  useSessionStore.setState({
    state,
    sessionId: state === 'IDLE' ? null : 'session-sorting',
    createdAt: state === 'IDLE' ? null : Date.now(),
    thoughts,
    stats: {
      ...createEmptySessionStats(),
      thoughtsCount: thoughts.length,
    },
    isTransitioning: false,
    isHydrated: true,
  });
}

function renderSorting() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <SessionGuardProvider>
        <SessionView />
      </SessionGuardProvider>
    </MemoryRouter>,
  );
}

describe('sorting helpers', () => {
  it('treats TASK and RELEASE as resolved', () => {
    expect(isThoughtResolved({ id: '1', text: 'a' })).toBe(false);
    expect(isThoughtResolved({ id: '1', text: 'a', resolvedAs: 'TASK' })).toBe(true);
    expect(isThoughtResolved({ id: '1', text: 'a', resolvedAs: 'RELEASE' })).toBe(true);
  });

  it('requires every thought resolved before continue', () => {
    expect(areAllThoughtsResolved([])).toBe(false);
    expect(
      areAllThoughtsResolved([
        { id: '1', text: 'a', resolvedAs: 'TASK' },
        { id: '2', text: 'b' },
      ]),
    ).toBe(false);
    expect(
      areAllThoughtsResolved([
        { id: '1', text: 'a', resolvedAs: 'TASK' },
        { id: '2', text: 'b', resolvedAs: 'RELEASE' },
      ]),
    ).toBe(true);
  });
});

describe('Sorting screen', () => {
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
    resetStores('SORTING', [
      { id: 't1', text: 'Call dentist' },
      { id: 't2', text: 'Worry about weather' },
    ]);
  });

  it('renders one thought at a time and disables Continue until all are resolved', () => {
    renderSorting();

    expect(screen.getByRole('heading', { name: /^sorting$/i })).toBeInTheDocument();
    expect(screen.getByText('Call dentist')).toBeInTheDocument();
    expect(screen.queryByText('Worry about weather')).not.toBeInTheDocument();
    expect(screen.getByText('0 of 2 sorted')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeDisabled();
  });

  it('resolves actionable thoughts as TASK and advances the queue', () => {
    renderSorting();

    fireEvent.click(screen.getByRole('button', { name: /i can act on this/i }));

    expect(useSessionStore.getState().thoughts[0]).toMatchObject({
      id: 't1',
      resolvedAs: 'TASK',
    });
    expect(screen.getByText('Worry about weather')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 sorted')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeDisabled();
  });

  it('resolves non-actionable thoughts as RELEASE without creating tasks', () => {
    renderSorting();

    fireEvent.click(screen.getByRole('button', { name: /i cannot act on this/i }));

    expect(useSessionStore.getState().thoughts[0]).toMatchObject({
      id: 't1',
      resolvedAs: 'RELEASE',
    });
    expect(screen.getByText('Worry about weather')).toBeInTheDocument();
  });

  it('uses the same one-at-a-time UI for a single thought', () => {
    resetStores('SORTING', [{ id: 'only', text: 'Only thought' }]);
    renderSorting();

    expect(screen.getByText('Only thought')).toBeInTheDocument();
    expect(screen.getByText('0 of 1 sorted')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /i can act on this/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /i cannot act on this/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /i can act on this/i }));

    expect(screen.getByText(/all thoughts are sorted/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeEnabled();
  });

  it('includes pulled Save for Later thoughts in the sort queue', () => {
    resetStores('SORTING', [
      {
        id: 'pulled-1',
        text: 'Review budget',
        source: 'SAVE_FOR_LATER',
        sourceTaskId: 'task-1',
      },
      { id: 't2', text: 'New idea' },
    ]);
    renderSorting();

    expect(screen.getByText('Review budget')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /i can act on this/i }));

    expect(useSessionStore.getState().thoughts[0]).toMatchObject({
      id: 'pulled-1',
      source: 'SAVE_FOR_LATER',
      resolvedAs: 'TASK',
    });
    expect(screen.getByText('New idea')).toBeInTheDocument();
  });

  it('enables Continue only after every thought is resolved', async () => {
    renderSorting();

    fireEvent.click(screen.getByRole('button', { name: /i can act on this/i }));
    fireEvent.click(screen.getByRole('button', { name: /i cannot act on this/i }));

    expect(screen.getByText('2 of 2 sorted')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => {
      expect(useSessionStore.getState().state).toBe('PRIORITIZATION');
    });
    expect(useSessionStore.getState().thoughts).toEqual([
      expect.objectContaining({ id: 't1', resolvedAs: 'TASK' }),
      expect.objectContaining({ id: 't2', resolvedAs: 'RELEASE' }),
    ]);
  });

  it('persists resolutions to Dexie', async () => {
    renderSorting();

    fireEvent.click(screen.getByRole('button', { name: /i can act on this/i }));
    await awaitInFlightSessionPersist();

    const stored = await getActiveSession();
    expect(stored?.thoughts[0]).toMatchObject({ id: 't1', resolvedAs: 'TASK' });
  });
});

describe('Sorting continue guard', () => {
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
    resetStores('SORTING', [
      { id: 't1', text: 'Unresolved' },
      { id: 't2', text: 'Also unresolved' },
    ]);
  });

  it('ignores CONTINUE while unresolved thoughts remain', async () => {
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
      expect(useSessionStore.getState().state).toBe('SORTING');
    });
  });
});

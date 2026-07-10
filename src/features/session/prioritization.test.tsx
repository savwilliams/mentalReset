import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SessionView } from '@/features/session';
import {
  areAllActionableThoughtsPrioritized,
  isActionableThought,
  isThoughtPrioritized,
  promoteThoughtToTaskStore,
} from '@/features/session/hooks/usePrioritizationQueue';
import { SessionGuardProvider } from '@/features/shell';
import { db } from '@/lib/db/database';
import { resetDataLayerForTests } from '@/lib/db/init';
import { getActiveSession } from '@/lib/db/repositories/sessionRepository';
import { getAllTasks } from '@/lib/db/repositories/taskRepository';
import { awaitInFlightSessionPersist, useSessionActions } from '@/lib/sessionMachine/useSessionActions';
import { useSessionStore } from '@/stores/sessionStore';
import { useTaskStore } from '@/stores/taskStore';
import { createEmptySessionStats } from '@/types/session';
import type { Thought } from '@/types/session';
import type { Task } from '@/types/task';

function resetStores(
  state: 'IDLE' | 'PRIORITIZATION' = 'PRIORITIZATION',
  thoughts: Thought[] = [],
  tasks: Task[] = [],
) {
  useSessionStore.setState({
    state,
    sessionId: state === 'IDLE' ? null : 'session-prioritization',
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
  useTaskStore.setState({ tasks, isHydrated: true });
}

function renderPrioritization() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <SessionGuardProvider>
        <SessionView />
      </SessionGuardProvider>
    </MemoryRouter>,
  );
}

const actionableThoughts: Thought[] = [
  { id: 't1', text: 'Call dentist', resolvedAs: 'TASK' },
  { id: 't2', text: 'Buy groceries', resolvedAs: 'TASK' },
  { id: 't3', text: 'Worry about weather', resolvedAs: 'RELEASE' },
];

describe('prioritization helpers', () => {
  it('treats only TASK-resolved thoughts as actionable', () => {
    expect(isActionableThought({ id: '1', text: 'a', resolvedAs: 'TASK' })).toBe(true);
    expect(isActionableThought({ id: '1', text: 'a', resolvedAs: 'RELEASE' })).toBe(false);
    expect(isActionableThought({ id: '1', text: 'a' })).toBe(false);
  });

  it('requires every actionable thought to have a priority before continue', () => {
    expect(areAllActionableThoughtsPrioritized([])).toBe(true);
    expect(
      areAllActionableThoughtsPrioritized([
        { id: '1', text: 'a', resolvedAs: 'TASK' },
        { id: '2', text: 'b', resolvedAs: 'RELEASE' },
      ]),
    ).toBe(false);
    expect(
      areAllActionableThoughtsPrioritized([
        { id: '1', text: 'a', resolvedAs: 'TASK', priority: 'TODAY' },
        { id: '2', text: 'b', resolvedAs: 'RELEASE' },
      ]),
    ).toBe(true);
    expect(isThoughtPrioritized({ id: '1', text: 'a', priority: 'SOON' })).toBe(true);
  });

  it('promotes TODAY/SOON/LATER to tasks and skips CAN_DO_WITHOUT', () => {
    const thought: Thought = { id: 't1', text: 'Call dentist', resolvedAs: 'TASK' };

    const withToday = promoteThoughtToTaskStore(thought, 'TODAY', []);
    expect(withToday).toHaveLength(1);
    expect(withToday[0]).toMatchObject({
      text: 'Call dentist',
      category: 'TODAY',
      source: 'SESSION',
      completed: false,
    });

    expect(promoteThoughtToTaskStore(thought, 'CAN_DO_WITHOUT', [])).toEqual([]);
  });

  it('updates existing Save for Later source tasks instead of duplicating', () => {
    const now = 1_700_000_000_000;
    const existing: Task = {
      id: 'task-1',
      text: 'Review budget',
      category: 'LATER',
      completed: false,
      createdAt: now,
      updatedAt: now,
      source: 'SAVE_FOR_LATER',
    };
    const thought: Thought = {
      id: 'thought-1',
      text: 'Review budget',
      resolvedAs: 'TASK',
      source: 'SAVE_FOR_LATER',
      sourceTaskId: 'task-1',
    };

    const next = promoteThoughtToTaskStore(thought, 'SOON', [existing], now + 5);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      id: 'task-1',
      category: 'SOON',
      updatedAt: now + 5,
    });
  });

  it('removes source tasks when prioritized as CAN_DO_WITHOUT', () => {
    const existing: Task = {
      id: 'task-1',
      text: 'Optional chore',
      category: 'LATER',
      completed: false,
      createdAt: 1,
      updatedAt: 1,
      source: 'SAVE_FOR_LATER',
    };
    const thought: Thought = {
      id: 'thought-1',
      text: 'Optional chore',
      resolvedAs: 'TASK',
      source: 'SAVE_FOR_LATER',
      sourceTaskId: 'task-1',
    };

    expect(promoteThoughtToTaskStore(thought, 'CAN_DO_WITHOUT', [existing])).toEqual([]);
  });
});

describe('Prioritization screen', () => {
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
    resetStores('PRIORITIZATION', actionableThoughts);
  });

  it('renders one actionable thought at a time and disables Continue until all are prioritized', () => {
    renderPrioritization();

    expect(screen.getByRole('heading', { name: /^prioritization$/i })).toBeInTheDocument();
    expect(screen.getByText('Call dentist')).toBeInTheDocument();
    expect(screen.queryByText('Buy groceries')).not.toBeInTheDocument();
    expect(screen.queryByText('Worry about weather')).not.toBeInTheDocument();
    expect(screen.getByText('0 of 2 prioritized')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /needs attention today/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /important if time allows/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save for later/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /can do without/i })).toBeInTheDocument();
  });

  it('promotes TODAY/SOON/LATER to the task store and increments tasksCreated', () => {
    renderPrioritization();

    fireEvent.click(screen.getByRole('button', { name: /needs attention today/i }));

    expect(useSessionStore.getState().thoughts[0]).toMatchObject({
      id: 't1',
      priority: 'TODAY',
    });
    expect(useSessionStore.getState().stats.tasksCreated).toBe(1);
    expect(useTaskStore.getState().tasks).toEqual([
      expect.objectContaining({
        text: 'Call dentist',
        category: 'TODAY',
        source: 'SESSION',
      }),
    ]);
    expect(screen.getByText('Buy groceries')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 prioritized')).toBeInTheDocument();
  });

  it('never creates a Task for CAN_DO_WITHOUT', () => {
    renderPrioritization();

    fireEvent.click(screen.getByRole('button', { name: /can do without/i }));

    expect(useSessionStore.getState().thoughts[0]).toMatchObject({
      id: 't1',
      priority: 'CAN_DO_WITHOUT',
    });
    expect(useSessionStore.getState().stats.tasksCreated).toBe(0);
    expect(useTaskStore.getState().tasks).toEqual([]);
    expect(screen.getByText('Buy groceries')).toBeInTheDocument();
  });

  it('allows duplicate task text as distinct items', () => {
    resetStores('PRIORITIZATION', [
      { id: 'a', text: 'Same text', resolvedAs: 'TASK' },
      { id: 'b', text: 'Same text', resolvedAs: 'TASK' },
    ]);
    renderPrioritization();

    fireEvent.click(screen.getByRole('button', { name: /needs attention today/i }));
    fireEvent.click(screen.getByRole('button', { name: /important if time allows/i }));

    expect(useTaskStore.getState().tasks).toHaveLength(2);
    expect(useTaskStore.getState().tasks.map((task) => task.text)).toEqual([
      'Same text',
      'Same text',
    ]);
    expect(useSessionStore.getState().stats.tasksCreated).toBe(2);
  });

  it('skips the queue when there are zero actionable thoughts', () => {
    resetStores('PRIORITIZATION', [
      { id: 'r1', text: 'Let go', resolvedAs: 'RELEASE' },
    ]);
    renderPrioritization();

    expect(screen.getByText(/no actionable items to prioritize/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeEnabled();
  });

  it('enables Continue only after every actionable thought is prioritized', async () => {
    renderPrioritization();

    fireEvent.click(screen.getByRole('button', { name: /needs attention today/i }));
    fireEvent.click(screen.getByRole('button', { name: /save for later/i }));

    expect(screen.getByText('2 of 2 prioritized')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => {
      expect(useSessionStore.getState().state).toBe('TIME_ESTIMATION');
    });
    expect(useSessionStore.getState().thoughts).toEqual([
      expect.objectContaining({ id: 't1', priority: 'TODAY' }),
      expect.objectContaining({ id: 't2', priority: 'LATER' }),
      expect.objectContaining({ id: 't3', resolvedAs: 'RELEASE' }),
    ]);
  });

  it('persists priorities and promoted tasks to Dexie', async () => {
    renderPrioritization();

    fireEvent.click(screen.getByRole('button', { name: /important if time allows/i }));
    await awaitInFlightSessionPersist();

    const storedSession = await getActiveSession();
    expect(storedSession?.thoughts[0]).toMatchObject({ id: 't1', priority: 'SOON' });
    expect(storedSession?.stats.tasksCreated).toBe(1);

    const storedTasks = await getAllTasks();
    expect(storedTasks).toEqual([
      expect.objectContaining({
        text: 'Call dentist',
        category: 'SOON',
        source: 'SESSION',
      }),
    ]);
  });
});

describe('Prioritization continue guard', () => {
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
    resetStores('PRIORITIZATION', [
      { id: 't1', text: 'Unresolved', resolvedAs: 'TASK' },
    ]);
  });

  it('ignores CONTINUE while unprioritized actionable thoughts remain', async () => {
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
      expect(useSessionStore.getState().state).toBe('PRIORITIZATION');
    });
  });
});

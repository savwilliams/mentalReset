import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SessionView } from '@/features/session';
import {
  areAllEstimableTasksEstimated,
  applyEstimateToTask,
  getEstimableTasks,
  hasEstimableTasks,
  isEstimableTask,
  isTaskEstimated,
  parseCustomEstimateMinutes,
  sumEstimatedMinutes,
} from '@/features/session/hooks/useTimeEstimationQueue';
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

function makeTask(overrides: Partial<Task> & Pick<Task, 'id' | 'text' | 'category'>): Task {
  return {
    completed: false,
    createdAt: 1,
    updatedAt: 1,
    source: 'SESSION',
    ...overrides,
  };
}

function resetStores(
  state: 'IDLE' | 'TIME_ESTIMATION' | 'PRIORITIZATION' = 'TIME_ESTIMATION',
  thoughts: Thought[] = [],
  tasks: Task[] = [],
  estimatedTimeTotal = 0,
) {
  useSessionStore.setState({
    state,
    sessionId: state === 'IDLE' ? null : 'session-time-estimation',
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
      estimatedTimeTotal,
    },
    isTransitioning: false,
    isHydrated: true,
  });
  useTaskStore.setState({ tasks, isHydrated: true });
}

function renderTimeEstimation() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <SessionGuardProvider>
        <SessionView />
      </SessionGuardProvider>
    </MemoryRouter>,
  );
}

const estimableTasks: Task[] = [
  makeTask({ id: 'task-1', text: 'Call dentist', category: 'TODAY' }),
  makeTask({ id: 'task-2', text: 'Buy groceries', category: 'SOON' }),
  makeTask({ id: 'task-3', text: 'Organize closet', category: 'LATER' }),
];

describe('time estimation helpers', () => {
  it('treats only TODAY and SOON tasks as estimable', () => {
    expect(isEstimableTask(makeTask({ id: '1', text: 'a', category: 'TODAY' }))).toBe(true);
    expect(isEstimableTask(makeTask({ id: '2', text: 'b', category: 'SOON' }))).toBe(true);
    expect(isEstimableTask(makeTask({ id: '3', text: 'c', category: 'LATER' }))).toBe(false);
    expect(getEstimableTasks(estimableTasks)).toHaveLength(2);
    expect(hasEstimableTasks(estimableTasks)).toBe(true);
    expect(hasEstimableTasks([estimableTasks[2]!])).toBe(false);
  });

  it('requires positive estimatedMinutes before a task counts as estimated', () => {
    expect(isTaskEstimated(makeTask({ id: '1', text: 'a', category: 'TODAY' }))).toBe(false);
    expect(
      isTaskEstimated(makeTask({ id: '1', text: 'a', category: 'TODAY', estimatedMinutes: 0 })),
    ).toBe(false);
    expect(
      isTaskEstimated(makeTask({ id: '1', text: 'a', category: 'TODAY', estimatedMinutes: 15 })),
    ).toBe(true);
  });

  it('requires every estimable task to have an estimate before continue', () => {
    expect(areAllEstimableTasksEstimated([])).toBe(true);
    expect(areAllEstimableTasksEstimated(estimableTasks)).toBe(false);
    expect(
      areAllEstimableTasksEstimated([
        makeTask({ id: '1', text: 'a', category: 'TODAY', estimatedMinutes: 5 }),
        makeTask({ id: '2', text: 'b', category: 'SOON', estimatedMinutes: 30 }),
        makeTask({ id: '3', text: 'c', category: 'LATER' }),
      ]),
    ).toBe(true);
  });

  it('validates custom estimates as positive integers within the max', () => {
    expect(parseCustomEstimateMinutes('15')).toBe(15);
    expect(parseCustomEstimateMinutes(' 480 ')).toBe(480);
    expect(parseCustomEstimateMinutes('0')).toBeNull();
    expect(parseCustomEstimateMinutes('-5')).toBeNull();
    expect(parseCustomEstimateMinutes('481')).toBeNull();
    expect(parseCustomEstimateMinutes('1.5')).toBeNull();
    expect(parseCustomEstimateMinutes('abc')).toBeNull();
    expect(parseCustomEstimateMinutes('')).toBeNull();
  });

  it('applies estimates and sums only TODAY/SOON minutes', () => {
    const next = applyEstimateToTask(estimableTasks, 'task-1', 15, 100);
    expect(next[0]).toMatchObject({ id: 'task-1', estimatedMinutes: 15, updatedAt: 100 });
    expect(sumEstimatedMinutes(next)).toBe(15);

    const both = applyEstimateToTask(next, 'task-2', 30, 200);
    expect(sumEstimatedMinutes(both)).toBe(45);
  });
});

describe('Time Estimation screen', () => {
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
    resetStores('TIME_ESTIMATION', [], estimableTasks);
  });

  it('renders one TODAY/SOON task at a time and never shows LATER tasks', () => {
    renderTimeEstimation();

    expect(screen.getByRole('heading', { name: /^time estimation$/i })).toBeInTheDocument();
    expect(screen.getByText('Call dentist')).toBeInTheDocument();
    expect(screen.getByText('Needs Attention Today')).toBeInTheDocument();
    expect(screen.queryByText('Buy groceries')).not.toBeInTheDocument();
    expect(screen.queryByText('Organize closet')).not.toBeInTheDocument();
    expect(screen.getByText('0 of 2 estimated')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^5 min$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^15 min$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^30 min$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^60 min$/i })).toBeInTheDocument();
  });

  it('saves preset estimates on tasks and updates estimatedTimeTotal', () => {
    renderTimeEstimation();

    fireEvent.click(screen.getByRole('button', { name: /^15 min$/i }));

    expect(useTaskStore.getState().tasks[0]).toMatchObject({
      id: 'task-1',
      estimatedMinutes: 15,
    });
    expect(useSessionStore.getState().stats.estimatedTimeTotal).toBe(15);
    expect(screen.getByText('Buy groceries')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 estimated')).toBeInTheDocument();
  });

  it('accepts a valid custom estimate and rejects invalid input', () => {
    renderTimeEstimation();

    fireEvent.change(screen.getByLabelText(/custom minutes/i), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /set custom time/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/whole number/i);
    expect(useTaskStore.getState().tasks[0]?.estimatedMinutes).toBeUndefined();

    fireEvent.change(screen.getByLabelText(/custom minutes/i), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: /set custom time/i }));

    expect(useTaskStore.getState().tasks[0]).toMatchObject({
      id: 'task-1',
      estimatedMinutes: 45,
    });
    expect(useSessionStore.getState().stats.estimatedTimeTotal).toBe(45);
    expect(screen.getByText('Buy groceries')).toBeInTheDocument();
  });

  it('enables Continue only after every TODAY/SOON task is estimated', async () => {
    renderTimeEstimation();

    fireEvent.click(screen.getByRole('button', { name: /^5 min$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^30 min$/i }));

    expect(screen.getByText('2 of 2 estimated')).toBeInTheDocument();
    expect(useSessionStore.getState().stats.estimatedTimeTotal).toBe(35);
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => {
      expect(useSessionStore.getState().state).toBe('RELEASE');
    });
  });

  it('shows an empty state when there are no TODAY/SOON tasks', () => {
    resetStores('TIME_ESTIMATION', [], [
      makeTask({ id: 'later-1', text: 'Organize closet', category: 'LATER' }),
    ]);
    renderTimeEstimation();

    expect(screen.getByText(/no today or soon tasks to estimate/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeEnabled();
  });

  it('persists estimates and session stats to Dexie', async () => {
    renderTimeEstimation();

    fireEvent.click(screen.getByRole('button', { name: /^60 min$/i }));
    await awaitInFlightSessionPersist();

    const storedTasks = await getAllTasks();
    expect(storedTasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'task-1', estimatedMinutes: 60 }),
      ]),
    );

    const storedSession = await getActiveSession();
    expect(storedSession?.stats.estimatedTimeTotal).toBe(60);
  });
});

describe('Time estimation auto-skip from prioritization', () => {
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
  });

  it('skips TIME_ESTIMATION when Continue leaves prioritization with no TODAY/SOON tasks', async () => {
    resetStores(
      'PRIORITIZATION',
      [
        { id: 't1', text: 'Organize closet', resolvedAs: 'TASK', priority: 'LATER' },
        { id: 't2', text: 'Worry', resolvedAs: 'RELEASE' },
      ],
      [makeTask({ id: 'later-1', text: 'Organize closet', category: 'LATER' })],
    );

    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionGuardProvider>
          <SessionView />
        </SessionGuardProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /^prioritization$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => {
      expect(useSessionStore.getState().state).toBe('RELEASE');
    });
  });

  it('enters TIME_ESTIMATION when TODAY/SOON tasks exist', async () => {
    resetStores(
      'PRIORITIZATION',
      [{ id: 't1', text: 'Call dentist', resolvedAs: 'TASK', priority: 'TODAY' }],
      [makeTask({ id: 'task-1', text: 'Call dentist', category: 'TODAY' })],
    );

    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionGuardProvider>
          <SessionView />
        </SessionGuardProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => {
      expect(useSessionStore.getState().state).toBe('TIME_ESTIMATION');
    });
    expect(screen.getByRole('heading', { name: /^time estimation$/i })).toBeInTheDocument();
    expect(screen.getByText('Call dentist')).toBeInTheDocument();
  });
});

describe('Time estimation continue guard', () => {
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
    resetStores('TIME_ESTIMATION', [], [
      makeTask({ id: 'task-1', text: 'Call dentist', category: 'TODAY' }),
    ]);
  });

  it('ignores CONTINUE while unestimated TODAY/SOON tasks remain', async () => {
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
      expect(useSessionStore.getState().state).toBe('TIME_ESTIMATION');
    });
  });
});

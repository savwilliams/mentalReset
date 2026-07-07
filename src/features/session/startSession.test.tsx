import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SessionView } from '@/features/session';
import { SessionGuardProvider, ShellRoutes } from '@/features/shell';
import { db } from '@/lib/db/database';
import { resetDataLayerForTests } from '@/lib/db/init';
import { useSessionStore } from '@/stores/sessionStore';
import { useTaskStore } from '@/stores/taskStore';
import { createEmptySessionStats } from '@/types/session';
import type { Task } from '@/types/task';

function NavigationHarness() {
  const isActive = useSessionStore((store) => store.state !== 'IDLE');

  return isActive ? <SessionView /> : <ShellRoutes />;
}

function createLaterTask(text: string, id = crypto.randomUUID()): Task {
  const now = Date.now();
  return {
    id,
    text,
    category: 'LATER',
    completed: false,
    createdAt: now,
    updatedAt: now,
    source: 'SAVE_FOR_LATER',
  };
}

function resetStores() {
  useSessionStore.setState({
    state: 'IDLE',
    sessionId: null,
    createdAt: null,
    thoughts: [],
    stats: createEmptySessionStats(),
    isTransitioning: false,
    isHydrated: true,
  });
  useTaskStore.setState({ tasks: [], isHydrated: true });
}

describe('start session with Save for Later pull-in', () => {
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
    resetStores();
  });

  it('skips review and goes directly to Brain Dump when no LATER tasks exist', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionGuardProvider>
          <NavigationHarness />
        </SessionGuardProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /start mental reset/i }));

    await waitFor(() => {
      expect(useSessionStore.getState().state).toBe('BRAIN_DUMP');
    });
    expect(screen.getByText(/brain dump/i)).toBeInTheDocument();
    expect(screen.queryByText(/saved for later/i)).not.toBeInTheDocument();
  });

  it('shows Save for Later review when LATER tasks exist', async () => {
    useTaskStore.setState({
      tasks: [createLaterTask('Finish quarterly report')],
      isHydrated: true,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionGuardProvider>
          <NavigationHarness />
        </SessionGuardProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /start mental reset/i }));

    await waitFor(() => {
      expect(useSessionStore.getState().state).toBe('START_REVIEW');
    });
    expect(screen.getByText(/finish quarterly report/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /finish quarterly report/i })).not.toBeChecked();
  });

  it('never auto-imports LATER tasks into session thoughts', async () => {
    useTaskStore.setState({
      tasks: [createLaterTask('Call dentist')],
      isHydrated: true,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionGuardProvider>
          <NavigationHarness />
        </SessionGuardProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /start mental reset/i }));

    await waitFor(() => {
      expect(useSessionStore.getState().state).toBe('START_REVIEW');
    });
    expect(useSessionStore.getState().thoughts).toEqual([]);
  });

  it('pulls in only opted-in LATER tasks when continuing from review', async () => {
    const pulledTask = createLaterTask('Review budget', 'task-pulled');
    const skippedTask = createLaterTask('Organize garage', 'task-skipped');

    useTaskStore.setState({
      tasks: [pulledTask, skippedTask],
      isHydrated: true,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionGuardProvider>
          <NavigationHarness />
        </SessionGuardProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /start mental reset/i }));

    await waitFor(() => {
      expect(useSessionStore.getState().state).toBe('START_REVIEW');
    });

    fireEvent.click(screen.getByRole('checkbox', { name: /review budget/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => {
      expect(useSessionStore.getState().state).toBe('BRAIN_DUMP');
    });

    const thoughts = useSessionStore.getState().thoughts;
    expect(thoughts).toHaveLength(1);
    expect(thoughts[0]?.text).toBe('Review budget');
    expect(thoughts[0]?.source).toBe('SAVE_FOR_LATER');
    expect(thoughts[0]?.sourceTaskId).toBe('task-pulled');
  });

  it('skips pull-in when user chooses Skip for now', async () => {
    useTaskStore.setState({
      tasks: [createLaterTask('Water plants')],
      isHydrated: true,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionGuardProvider>
          <NavigationHarness />
        </SessionGuardProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /start mental reset/i }));
    await waitFor(() => {
      expect(useSessionStore.getState().state).toBe('START_REVIEW');
    });

    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));

    await waitFor(() => {
      expect(useSessionStore.getState().state).toBe('BRAIN_DUMP');
    });
    expect(useSessionStore.getState().thoughts).toEqual([]);
  });
});

describe('createThoughtsFromLaterTasks', () => {
  it('maps selected LATER tasks to session thoughts', async () => {
    const { createThoughtsFromLaterTasks } = await import('@/features/session/hooks/pullInLaterTasks');

    useTaskStore.setState({
      tasks: [
        createLaterTask('One', 'task-1'),
        createLaterTask('Two', 'task-2'),
        {
          id: 'task-today',
          text: 'Today item',
          category: 'TODAY',
          completed: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      isHydrated: true,
    });

    const thoughts = createThoughtsFromLaterTasks(['task-2']);

    expect(thoughts).toHaveLength(1);
    expect(thoughts[0]).toMatchObject({
      text: 'Two',
      source: 'SAVE_FOR_LATER',
      sourceTaskId: 'task-2',
    });
  });
});

describe('resolveSessionView', () => {
  it('maps START_REVIEW to the start session screen', async () => {
    const { resolveSessionView } = await import('@/features/session/SessionView');

    expect(resolveSessionView('START_REVIEW')).not.toBeNull();
  });
});

import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SessionHistoryScreen } from '@/features/tasks/screens/SessionHistoryScreen';
import { db } from '@/lib/db/database';
import { resetDataLayerForTests } from '@/lib/db/init';
import {
  clearSessionSummaries,
  saveSessionSummary,
} from '@/lib/db/repositories/sessionSummaryRepository';
import type { SessionSummary } from '@/types/session';

function createSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: crypto.randomUUID(),
    completedAt: Date.now(),
    tasksCreated: 2,
    releasedCount: 1,
    estimatedTimeTotal: 45,
    ...overrides,
  };
}

describe('SessionHistoryScreen', () => {
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

  it('shows an empty state when there is no history', async () => {
    render(
      <MemoryRouter>
        <SessionHistoryScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no sessions yet/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/summary stats only/i)).toBeInTheDocument();
  });

  it('lists session summaries newest first with stats only', async () => {
    const older: SessionSummary = createSummary({
      id: 'older',
      completedAt: new Date('2026-01-10T12:00:00').getTime(),
      tasksCreated: 1,
      releasedCount: 0,
      estimatedTimeTotal: 30,
    });
    const newer: SessionSummary = createSummary({
      id: 'newer',
      completedAt: new Date('2026-02-15T12:00:00').getTime(),
      tasksCreated: 3,
      releasedCount: 2,
      estimatedTimeTotal: 90,
    });

    await saveSessionSummary(older);
    await saveSessionSummary(newer);

    render(
      <MemoryRouter>
        <SessionHistoryScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/3 tasks created/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/1 task created/i)).toBeInTheDocument();
    expect(screen.getByText(/2 items released/i)).toBeInTheDocument();
    expect(screen.getByText(/1h 30m/i)).toBeInTheDocument();
    expect(screen.getByText(/30 min/i)).toBeInTheDocument();
    expect(screen.queryByText(/thought/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(2);
    expect(listItems[0]).toHaveTextContent(/3 tasks created/i);
    expect(listItems[1]).toHaveTextContent(/1 task created/i);
  });

  it('is read-only with no interactive summary actions', async () => {
    await saveSessionSummary(createSummary());

    render(
      <MemoryRouter>
        <SessionHistoryScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('list', { name: /past sessions/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('sessionSummaryRepository', () => {
  beforeEach(async () => {
    resetDataLayerForTests();

    if (db.isOpen()) {
      await db.close();
    }
    await db.delete();
    await db.open();
    await clearSessionSummaries();
  });

  it('returns summaries ordered by completedAt descending', async () => {
    await saveSessionSummary(
      createSummary({
        id: 'first',
        completedAt: 100,
      }),
    );
    await saveSessionSummary(
      createSummary({
        id: 'second',
        completedAt: 300,
      }),
    );
    await saveSessionSummary(
      createSummary({
        id: 'third',
        completedAt: 200,
      }),
    );

    const { getAllSessionSummaries } = await import(
      '@/lib/db/repositories/sessionSummaryRepository'
    );
    const summaries = await getAllSessionSummaries();

    expect(summaries.map((summary) => summary.id)).toEqual(['second', 'third', 'first']);
  });
});

import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionView } from '@/features/session';
import {
  MAX_THOUGHT_LENGTH,
  THOUGHT_LENGTH_WARNING_AT,
  createThought,
  isThoughtTextValid,
  normalizeThoughtText,
} from '@/features/session/hooks/useThoughtQueue';
import { SessionGuardProvider } from '@/features/shell';
import { db } from '@/lib/db/database';
import { resetDataLayerForTests } from '@/lib/db/init';
import { getActiveSession } from '@/lib/db/repositories/sessionRepository';
import { useSessionActions, awaitInFlightSessionPersist } from '@/lib/sessionMachine/useSessionActions';
import { useSessionStore } from '@/stores/sessionStore';
import { createEmptySessionStats } from '@/types/session';

function resetStores(state: 'IDLE' | 'BRAIN_DUMP' = 'BRAIN_DUMP') {
  useSessionStore.setState({
    state,
    sessionId: state === 'IDLE' ? null : 'session-brain-dump',
    createdAt: state === 'IDLE' ? null : Date.now(),
    thoughts: [],
    stats: createEmptySessionStats(),
    isTransitioning: false,
    isHydrated: true,
  });
}

function renderBrainDump() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <SessionGuardProvider>
        <SessionView />
      </SessionGuardProvider>
    </MemoryRouter>,
  );
}

describe('thought text helpers', () => {
  it('blocks empty and whitespace-only text', () => {
    expect(isThoughtTextValid('')).toBe(false);
    expect(isThoughtTextValid('   ')).toBe(false);
    expect(createThought('')).toBeNull();
    expect(createThought('   ')).toBeNull();
  });

  it('trims and caps text at the max length', () => {
    const long = 'a'.repeat(MAX_THOUGHT_LENGTH + 40);
    expect(normalizeThoughtText(`  ${long}  `)).toHaveLength(MAX_THOUGHT_LENGTH);
    expect(createThought('  Buy milk  ')?.text).toBe('Buy milk');
  });
});

describe('Brain Dump screen', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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

  it('renders Brain Dump and disables Continue with no thoughts', () => {
    renderBrainDump();

    expect(screen.getByRole('heading', { name: /brain dump/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeDisabled();
    expect(screen.getByText(/add at least one thought/i)).toBeInTheDocument();
  });

  it('blocks adding empty thought text', () => {
    renderBrainDump();

    fireEvent.click(screen.getByRole('button', { name: /add thought/i }));

    expect(useSessionStore.getState().thoughts).toEqual([]);
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeDisabled();
  });

  it('adds, edits, and deletes thoughts', () => {
    renderBrainDump();

    const input = screen.getByLabelText(/new thought/i);
    fireEvent.change(input, { target: { value: 'Call dentist' } });
    fireEvent.click(screen.getByRole('button', { name: /add thought/i }));

    expect(screen.getByText('Call dentist')).toBeInTheDocument();
    expect(useSessionStore.getState().thoughts).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    const editInput = screen.getByLabelText(/edit thought/i);
    fireEvent.change(editInput, { target: { value: 'Call dentist tomorrow' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(screen.getByText('Call dentist tomorrow')).toBeInTheDocument();
    expect(useSessionStore.getState().thoughts[0]?.text).toBe('Call dentist tomorrow');

    fireEvent.click(screen.getByRole('button', { name: /delete thought/i }));

    expect(screen.queryByText('Call dentist tomorrow')).not.toBeInTheDocument();
    expect(useSessionStore.getState().thoughts).toEqual([]);
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeDisabled();
  });

  it('shows a soft warning near the character limit', () => {
    renderBrainDump();

    const nearLimit = 'x'.repeat(THOUGHT_LENGTH_WARNING_AT);
    fireEvent.change(screen.getByLabelText(/new thought/i), { target: { value: nearLimit } });

    expect(
      screen.getByText(`${THOUGHT_LENGTH_WARNING_AT}/${MAX_THOUGHT_LENGTH} characters`),
    ).toBeInTheDocument();
  });

  it('disables Continue after deleting the last thought', () => {
    useSessionStore.setState({
      thoughts: [{ id: 't1', text: 'Only thought' }],
      stats: { ...createEmptySessionStats(), thoughtsCount: 1 },
    });

    renderBrainDump();

    expect(screen.getByRole('button', { name: /^continue$/i })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /delete thought/i }));
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeDisabled();
  });

  it('continues to Sorting when at least one thought exists', async () => {
    renderBrainDump();

    fireEvent.change(screen.getByLabelText(/new thought/i), {
      target: { value: 'Plan weekend' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add thought/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => {
      expect(useSessionStore.getState().state).toBe('SORTING');
    });
    expect(screen.getByText(/sorting/i)).toBeInTheDocument();
  });

  it('debounces Dexie writes when thoughts change', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderBrainDump();

    fireEvent.change(screen.getByLabelText(/new thought/i), {
      target: { value: 'Persist me' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add thought/i }));

    expect(await getActiveSession()).toBeUndefined();

    await vi.advanceTimersByTimeAsync(300);
    await awaitInFlightSessionPersist();

    const stored = await getActiveSession();
    expect(stored?.thoughts).toEqual([expect.objectContaining({ text: 'Persist me' })]);
  });

  it('keeps pulled Save for Later thoughts editable in Brain Dump', () => {
    useSessionStore.setState({
      thoughts: [
        {
          id: 'pulled-1',
          text: 'Review budget',
          source: 'SAVE_FOR_LATER',
          sourceTaskId: 'task-1',
        },
      ],
      stats: { ...createEmptySessionStats(), thoughtsCount: 1 },
    });

    renderBrainDump();

    expect(screen.getByText('Review budget')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    fireEvent.change(screen.getByLabelText(/edit thought/i), {
      target: { value: 'Review budget carefully' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(useSessionStore.getState().thoughts[0]).toMatchObject({
      text: 'Review budget carefully',
      source: 'SAVE_FOR_LATER',
      sourceTaskId: 'task-1',
    });
  });
});

describe('Brain Dump continue guard', () => {
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

  it('ignores CONTINUE while Brain Dump has no thoughts', async () => {
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
      expect(useSessionStore.getState().state).toBe('BRAIN_DUMP');
    });
  });
});

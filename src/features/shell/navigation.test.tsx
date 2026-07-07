import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AbandonSessionDialog } from '@/components/ui';
import { SessionView } from '@/features/session';
import { SessionGuardProvider, ShellRoutes, useSessionGuard } from '@/features/shell';
import { db } from '@/lib/db/database';
import { resetDataLayerForTests } from '@/lib/db/init';
import { useSessionStore } from '@/stores/sessionStore';
import { createEmptySessionStats } from '@/types/session';

function NavigationHarness() {
  const isActive = useSessionStore((store) => store.state !== 'IDLE');
  const { isDialogOpen, confirmAbandon, cancelAbandon } = useSessionGuard();

  return (
    <>
      {isActive ? <SessionView /> : <ShellRoutes />}
      <AbandonSessionDialog
        open={isDialogOpen}
        onConfirm={() => {
          void confirmAbandon();
        }}
        onCancel={cancelAbandon}
      />
    </>
  );
}

function ShellNavigationTrigger() {
  const { guardShellNavigation } = useSessionGuard();

  return (
    <button type="button" onClick={() => guardShellNavigation('/plan')}>
      Open Today&apos;s Plan
    </button>
  );
}

function resetSessionStore(state: 'IDLE' | 'BRAIN_DUMP' = 'IDLE') {
  useSessionStore.setState({
    state,
    sessionId: state === 'IDLE' ? null : 'session-test',
    createdAt: state === 'IDLE' ? null : Date.now(),
    thoughts: [],
    stats: createEmptySessionStats(),
    isTransitioning: false,
    isHydrated: true,
  });
}

describe('app navigation', () => {
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
    resetSessionStore();
  });

  it('starts a session from idle and blocks the shell', async () => {
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
    expect(screen.queryByRole('button', { name: /today's plan/i })).not.toBeInTheDocument();
  });

  it('renders shell routes when session is idle', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionGuardProvider>
          <NavigationHarness />
        </SessionGuardProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /mentalreset/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /today's plan/i })).toBeInTheDocument();
  });

  it('shows session view instead of shell during an active session', () => {
    resetSessionStore('BRAIN_DUMP');

    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionGuardProvider>
          <NavigationHarness />
        </SessionGuardProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/brain dump/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /today's plan/i })).not.toBeInTheDocument();
  });

  it('prompts to abandon when navigating to shell routes mid-session', async () => {
    resetSessionStore('BRAIN_DUMP');

    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionGuardProvider>
          <NavigationHarness />
          <ShellNavigationTrigger />
        </SessionGuardProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /open today's plan/i }));

    expect(screen.getByRole('dialog', { name: /leave this session/i })).toBeInTheDocument();
    expect(useSessionStore.getState().state).toBe('BRAIN_DUMP');
  });

  it('keeps the session when abandon is cancelled', async () => {
    resetSessionStore('BRAIN_DUMP');

    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionGuardProvider>
          <NavigationHarness />
          <ShellNavigationTrigger />
        </SessionGuardProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /open today's plan/i }));
    fireEvent.click(screen.getByRole('button', { name: /keep going/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(useSessionStore.getState().state).toBe('BRAIN_DUMP');
    expect(screen.getByText(/brain dump/i)).toBeInTheDocument();
  });

  it('returns to idle and navigates after confirmed abandon', async () => {
    resetSessionStore('BRAIN_DUMP');

    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionGuardProvider>
          <NavigationHarness />
          <ShellNavigationTrigger />
        </SessionGuardProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /open today's plan/i }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: /leave this session/i })).getByRole('button', {
        name: /leave session/i,
      }),
    );

    await waitFor(() => {
      expect(useSessionStore.getState().state).toBe('IDLE');
      expect(screen.getByRole('heading', { name: /today's plan/i })).toBeInTheDocument();
    });
  });

  it('guards deep links to shell routes during an active session', async () => {
    resetSessionStore('BRAIN_DUMP');

    render(
      <MemoryRouter initialEntries={['/plan']}>
        <SessionGuardProvider>
          <NavigationHarness />
        </SessionGuardProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('dialog', { name: /leave this session/i })).toBeInTheDocument();
    expect(screen.getByText(/brain dump/i)).toBeInTheDocument();
  });

  it("navigates to Today's Plan from idle shell", () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionGuardProvider>
          <NavigationHarness />
        </SessionGuardProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /today's plan/i }));

    expect(screen.getByRole('heading', { name: /today's plan/i })).toBeInTheDocument();
  });
});

describe('resolveSessionView', () => {
  it('maps active FSM states to session views', async () => {
    const { resolveSessionView } = await import('@/features/session/SessionView');

    expect(resolveSessionView('IDLE')).toBeNull();
    expect(resolveSessionView('START_REVIEW')).not.toBeNull();
    expect(resolveSessionView('BRAIN_DUMP')).not.toBeNull();
    expect(resolveSessionView('SUMMARY')).not.toBeNull();
  });
});

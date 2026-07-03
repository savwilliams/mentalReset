import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '@/app/App';
import { useSessionStore } from '@/stores/sessionStore';
import { createEmptySessionStats } from '@/types/session';

describe('App', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the IDLE shell using Screen layout', () => {
    useSessionStore.setState({
      state: 'IDLE',
      sessionId: null,
      createdAt: null,
      thoughts: [],
      stats: createEmptySessionStats(),
      isTransitioning: false,
      isHydrated: true,
    });

    render(<App />);

    expect(screen.getByRole('heading', { name: /mentalreset/i })).toBeInTheDocument();
    expect(screen.getByText(/calm space to reset your mind/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start mental reset/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /today's plan/i })).toBeInTheDocument();
  });
});

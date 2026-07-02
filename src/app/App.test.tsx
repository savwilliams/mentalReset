import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '@/app/App';

describe('App', () => {
  it('renders the IDLE shell using Screen layout', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /mentalreset/i })).toBeInTheDocument();
    expect(screen.getByText(/calm space to reset your mind/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start mental reset/i })).toBeInTheDocument();
  });
});

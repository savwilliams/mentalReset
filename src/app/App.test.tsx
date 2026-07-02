import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '@/app/App';

describe('App', () => {
  it('renders the app shell placeholder', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /mentalreset/i })).toBeInTheDocument();
    expect(screen.getByText(/calm space to reset your mind/i)).toBeInTheDocument();
  });
});

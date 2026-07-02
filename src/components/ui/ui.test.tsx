import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AbandonSessionDialog, Card, ConfirmDialog, Input, PrimaryCTA, Screen, SecondaryButton } from '@/components/ui';

afterEach(() => {
  cleanup();
});

describe('Screen', () => {
  it('renders title, content, and footer CTA slot', () => {
    render(
      <Screen title="MentalReset" footer={<PrimaryCTA>Start Mental Reset</PrimaryCTA>}>
        <p>Body copy</p>
      </Screen>,
    );

    expect(screen.getByRole('heading', { name: 'MentalReset' })).toBeInTheDocument();
    expect(screen.getByText('Body copy')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Mental Reset' })).toBeInTheDocument();
  });

  it('prevents horizontal overflow on narrow viewports', () => {
    const { container } = render(
      <Screen title="MentalReset">
        <p>Body copy</p>
      </Screen>,
    );

    const shell = container.firstElementChild;
    expect(shell).toHaveClass('overflow-x-hidden');
    expect(shell).toHaveClass('max-w-lg');
  });
});

describe('PrimaryCTA', () => {
  it('meets minimum touch target height', () => {
    render(<PrimaryCTA>Continue</PrimaryCTA>);

    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass('min-h-11');
  });
});

describe('SecondaryButton', () => {
  it('meets minimum touch target height', () => {
    render(<SecondaryButton>Cancel</SecondaryButton>);

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('min-h-11');
  });
});

describe('Card', () => {
  it('renders children inside an elevated surface', () => {
    render(<Card>Thought item</Card>);

    expect(screen.getByText('Thought item')).toBeInTheDocument();
  });
});

describe('Input', () => {
  it('uses at least 16px font size for mobile zoom safety', () => {
    render(<Input label="Thought" placeholder="Add a thought" />);

    const input = screen.getByLabelText('Thought');
    expect(input).toHaveClass('text-[length:var(--font-size-input)]');
    expect(input).toHaveClass('min-h-11');
  });
});

describe('ConfirmDialog', () => {
  function DialogHarness() {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);

    return (
      <>
        <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
          Open dialog
        </button>
        <ConfirmDialog
          open={open}
          title="Leave this session?"
          description="Your in-progress work will not be saved."
          confirmLabel="Leave session"
          cancelLabel="Keep going"
          onConfirm={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </>
    );
  }

  it('traps focus while open and restores focus on close', () => {
    render(<DialogHarness />);

    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);

    const leaveButton = screen.getByRole('button', { name: 'Leave session' });
    const keepButton = screen.getByRole('button', { name: 'Keep going' });

    expect(leaveButton).toHaveFocus();

    fireEvent.keyDown(leaveButton, { key: 'Tab' });
    expect(keepButton).toHaveFocus();

    fireEvent.keyDown(keepButton, { key: 'Tab' });
    expect(leaveButton).toHaveFocus();

    fireEvent.keyDown(leaveButton, { key: 'Tab', shiftKey: true });
    expect(keepButton).toHaveFocus();

    fireEvent.click(keepButton);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('AbandonSessionDialog', () => {
  it('uses calm, non-judgmental copy', () => {
    render(
      <AbandonSessionDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Leave this session?' })).toBeInTheDocument();
    expect(screen.getByText(/will not be saved/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave session' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep going' })).toBeInTheDocument();
  });
});

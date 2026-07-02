import { useId, useRef } from 'react';

import { PrimaryCTA } from '@/components/ui/PrimaryCTA';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { useFocusTrap } from '@/components/ui/useFocusTrap';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(open, dialogRef);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-[var(--spacing-screen-x)] sm:items-center"
      onClick={onCancel}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-[var(--spacing-screen-x)] shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id={titleId}
          className="text-[length:var(--font-size-heading)] font-medium text-[var(--color-text-primary)]"
        >
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-[var(--color-text-secondary)]">
          {description}
        </p>
        <div className="mt-[var(--spacing-section)] flex flex-col gap-3">
          <PrimaryCTA type="button" onClick={onConfirm}>
            {confirmLabel}
          </PrimaryCTA>
          <SecondaryButton type="button" onClick={onCancel}>
            {cancelLabel}
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

/** Calm, non-judgmental copy for leaving an active session (Phase 4 navigation). */
export const ABANDON_SESSION_COPY = {
  title: 'Leave this session?',
  description:
    'Your in-progress work will not be saved. You can start a fresh session whenever you are ready.',
  confirmLabel: 'Leave session',
  cancelLabel: 'Keep going',
} as const;

export function AbandonSessionDialog({
  open,
  onConfirm,
  onCancel,
}: Pick<ConfirmDialogProps, 'open' | 'onConfirm' | 'onCancel'>) {
  return (
    <ConfirmDialog
      open={open}
      title={ABANDON_SESSION_COPY.title}
      description={ABANDON_SESSION_COPY.description}
      confirmLabel={ABANDON_SESSION_COPY.confirmLabel}
      cancelLabel={ABANDON_SESSION_COPY.cancelLabel}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

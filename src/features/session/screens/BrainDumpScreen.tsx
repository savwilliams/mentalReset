import { useCallback, useId, useState } from 'react';

import { Input, PrimaryCTA, Screen, SecondaryButton } from '@/components/ui';
import { ThoughtCard } from '@/features/session/components/ThoughtCard';
import {
  MAX_THOUGHT_LENGTH,
  THOUGHT_LENGTH_WARNING_AT,
  isThoughtTextValid,
  useThoughtQueue,
} from '@/features/session/hooks/useThoughtQueue';
import { useSessionGuard } from '@/features/shell';
import { useSessionActions } from '@/lib/sessionMachine';

export function BrainDumpScreen() {
  const inputId = useId();
  const { requestAbandon } = useSessionGuard();
  const { continue: continueSession, isTransitioning } = useSessionActions();
  const { thoughts, addThought, editThought, deleteThought, canContinue } = useThoughtQueue();
  const [draft, setDraft] = useState('');

  const showLengthWarning = draft.length >= THOUGHT_LENGTH_WARNING_AT;
  const canAdd = isThoughtTextValid(draft);

  const handleAdd = useCallback(() => {
    if (!addThought(draft)) {
      return;
    }
    setDraft('');
  }, [addThought, draft]);

  const handleContinue = useCallback(() => {
    if (!canContinue) {
      return;
    }
    void continueSession();
  }, [canContinue, continueSession]);

  return (
    <Screen
      title="Mental Reset"
      footer={
        <PrimaryCTA
          type="button"
          onClick={handleContinue}
          disabled={isTransitioning || !canContinue}
        >
          Continue
        </PrimaryCTA>
      }
    >
      <h2 className="text-[length:var(--font-size-heading)] font-medium text-[var(--color-text-primary)]">
        Brain Dump
      </h2>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        Write down whatever is on your mind. You can edit or remove thoughts before continuing.
      </p>

      <form
        className="mt-[var(--spacing-section)] flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          handleAdd();
        }}
      >
        <Input
          id={inputId}
          label="New thought"
          placeholder="What's on your mind?"
          value={draft}
          maxLength={MAX_THOUGHT_LENGTH}
          disabled={isTransitioning}
          onChange={(event) => setDraft(event.target.value)}
        />
        {showLengthWarning ? (
          <p className="text-[length:var(--font-size-label)] text-[var(--color-text-secondary)]">
            {draft.length}/{MAX_THOUGHT_LENGTH} characters
          </p>
        ) : null}
        <SecondaryButton type="submit" disabled={isTransitioning || !canAdd}>
          Add thought
        </SecondaryButton>
      </form>

      {thoughts.length > 0 ? (
        <ul
          className="mt-[var(--spacing-section)] flex flex-col gap-3"
          aria-label="Session thoughts"
        >
          {thoughts.map((thought) => (
            <li key={thought.id}>
              <ThoughtCard
                thought={thought}
                disabled={isTransitioning}
                onSave={editThought}
                onDelete={deleteThought}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-[var(--spacing-section)] text-[var(--color-text-secondary)]">
          Add at least one thought to continue.
        </p>
      )}

      <SecondaryButton
        type="button"
        className="mt-[var(--spacing-section)]"
        onClick={() => requestAbandon()}
        disabled={isTransitioning}
      >
        Leave session
      </SecondaryButton>
    </Screen>
  );
}

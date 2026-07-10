import { useCallback } from 'react';

import { Card, PrimaryCTA, Screen, SecondaryButton } from '@/components/ui';
import { useSortingQueue } from '@/features/session/hooks/useSortingQueue';
import { useSessionGuard } from '@/features/shell';
import { useSessionActions } from '@/lib/sessionMachine';

export function SortingScreen() {
  const { requestAbandon } = useSessionGuard();
  const { continue: continueSession, isTransitioning } = useSessionActions();
  const {
    currentThought,
    resolvedCount,
    totalCount,
    resolveAsTask,
    resolveAsRelease,
    canContinue,
  } = useSortingQueue();

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
        Sorting
      </h2>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        Decide whether each thought is something you can act on, or something to release.
      </p>

      {totalCount > 0 ? (
        <p
          className="mt-[var(--spacing-section)] text-[length:var(--font-size-label)] text-[var(--color-text-secondary)]"
          aria-live="polite"
        >
          {resolvedCount} of {totalCount} sorted
        </p>
      ) : null}

      {currentThought ? (
        <div className="mt-4 flex flex-col gap-3">
          <Card aria-label="Current thought">
            <p className="text-[var(--color-text-primary)]">{currentThought.text}</p>
          </Card>

          <PrimaryCTA
            type="button"
            disabled={isTransitioning}
            onClick={() => resolveAsTask(currentThought.id)}
          >
            I can act on this
          </PrimaryCTA>
          <SecondaryButton
            type="button"
            disabled={isTransitioning}
            onClick={() => resolveAsRelease(currentThought.id)}
          >
            I cannot act on this
          </SecondaryButton>
        </div>
      ) : canContinue ? (
        <p className="mt-[var(--spacing-section)] text-[var(--color-text-secondary)]">
          All thoughts are sorted. Continue when you are ready.
        </p>
      ) : (
        <p className="mt-[var(--spacing-section)] text-[var(--color-text-secondary)]">
          No thoughts to sort.
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

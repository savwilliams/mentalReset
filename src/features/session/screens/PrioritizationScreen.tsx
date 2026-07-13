import { useCallback } from 'react';

import { Card, PrimaryCTA, Screen, SecondaryButton } from '@/components/ui';
import { CategoryPicker } from '@/features/session/components/CategoryPicker';
import { usePrioritizationQueue } from '@/features/session/hooks/usePrioritizationQueue';
import { useSessionGuard } from '@/features/shell';
import { useSessionActions } from '@/lib/sessionMachine';

export function PrioritizationScreen() {
  const { requestAbandon } = useSessionGuard();
  const { continue: continueSession, isTransitioning } = useSessionActions();
  const {
    currentThought,
    prioritizedCount,
    totalCount,
    assignPriority,
    canContinue,
  } = usePrioritizationQueue();

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
        Prioritization
      </h2>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        Choose how important each actionable item is right now.
      </p>

      {totalCount > 0 ? (
        <p
          className="mt-[var(--spacing-section)] text-[length:var(--font-size-label)] text-[var(--color-text-secondary)]"
          aria-live="polite"
        >
          {prioritizedCount} of {totalCount} prioritized
        </p>
      ) : null}

      {currentThought ? (
        <div className="mt-4 flex flex-col gap-3">
          <Card aria-label="Current thought">
            <p className="text-[var(--color-text-primary)]">{currentThought.text}</p>
          </Card>

          <CategoryPicker
            disabled={isTransitioning}
            onSelect={(priority) => assignPriority(currentThought.id, priority)}
          />
        </div>
      ) : canContinue ? (
        <p className="mt-[var(--spacing-section)] text-[var(--color-text-secondary)]">
          {totalCount === 0
            ? 'No actionable items to prioritize. Continue when you are ready.'
            : 'All actionable items are prioritized. Continue when you are ready.'}
        </p>
      ) : (
        <p className="mt-[var(--spacing-section)] text-[var(--color-text-secondary)]">
          No actionable items to prioritize.
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

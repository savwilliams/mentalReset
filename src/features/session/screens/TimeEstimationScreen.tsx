import { useCallback } from 'react';

import { Card, PrimaryCTA, Screen, SecondaryButton } from '@/components/ui';
import { TimePreset } from '@/features/session/components/TimePreset';
import { PRIORITY_LABELS } from '@/features/session/constants';
import { useTimeEstimationQueue } from '@/features/session/hooks/useTimeEstimationQueue';
import { useSessionGuard } from '@/features/shell';
import { useSessionActions } from '@/lib/sessionMachine';

export function TimeEstimationScreen() {
  const { requestAbandon } = useSessionGuard();
  const { continue: continueSession, isTransitioning } = useSessionActions();
  const {
    currentTask,
    estimatedCount,
    totalCount,
    assignEstimate,
    canContinue,
  } = useTimeEstimationQueue();

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
        Time Estimation
      </h2>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        Estimate how long each Today and Soon task will take.
      </p>

      {totalCount > 0 ? (
        <p
          className="mt-[var(--spacing-section)] text-[length:var(--font-size-label)] text-[var(--color-text-secondary)]"
          aria-live="polite"
        >
          {estimatedCount} of {totalCount} estimated
        </p>
      ) : null}

      {currentTask ? (
        <div className="mt-4 flex flex-col gap-3">
          <Card aria-label="Current task">
            <p className="text-[length:var(--font-size-label)] text-[var(--color-text-secondary)]">
              {PRIORITY_LABELS[currentTask.category]}
            </p>
            <p className="mt-1 text-[var(--color-text-primary)]">{currentTask.text}</p>
          </Card>

          <TimePreset
            key={currentTask.id}
            disabled={isTransitioning}
            onSelect={(minutes) => assignEstimate(currentTask.id, minutes)}
          />
        </div>
      ) : canContinue ? (
        <p className="mt-[var(--spacing-section)] text-[var(--color-text-secondary)]">
          {totalCount === 0
            ? 'No Today or Soon tasks to estimate. Continue when you are ready.'
            : 'All Today and Soon tasks are estimated. Continue when you are ready.'}
        </p>
      ) : (
        <p className="mt-[var(--spacing-section)] text-[var(--color-text-secondary)]">
          No Today or Soon tasks to estimate.
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

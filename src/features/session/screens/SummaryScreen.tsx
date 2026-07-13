import { useCallback } from 'react';

import { Card, PrimaryCTA, Screen, SecondaryButton } from '@/components/ui';
import { useSessionGuard } from '@/features/shell';
import {
  formatEstimatedMinutes,
  formatReleasedCount,
  formatTaskCount,
} from '@/features/tasks/utils/formatSessionHistory';
import { useSessionActions } from '@/lib/sessionMachine';
import { useSessionStats } from '@/stores/sessionStore';

export function SummaryScreen() {
  const { requestAbandon } = useSessionGuard();
  const { finish, isTransitioning } = useSessionActions();
  const stats = useSessionStats();

  const handleFinish = useCallback(() => {
    void finish();
  }, [finish]);

  return (
    <Screen
      title="Mental Reset"
      footer={
        <PrimaryCTA type="button" onClick={handleFinish} disabled={isTransitioning}>
          Finish session
        </PrimaryCTA>
      }
    >
      <h2 className="text-[length:var(--font-size-heading)] font-medium text-[var(--color-text-primary)]">
        Summary
      </h2>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        Your session is complete. Here is what you sorted out.
      </p>

      <Card className="mt-[var(--spacing-section)]" role="region" aria-label="Session summary">
        <dl className="grid gap-3 text-[var(--color-text-secondary)]">
          <div className="flex items-baseline justify-between gap-3">
            <dt>Tasks created</dt>
            <dd className="text-[var(--color-text-primary)]">
              {formatTaskCount(stats.tasksCreated)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt>Estimated time</dt>
            <dd className="text-[var(--color-text-primary)]">
              {formatEstimatedMinutes(stats.estimatedTimeTotal)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt>Released</dt>
            <dd className="text-[var(--color-text-primary)]">
              {formatReleasedCount(stats.releasedCount)}
            </dd>
          </div>
        </dl>
      </Card>

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

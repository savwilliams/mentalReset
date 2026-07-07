import { Card } from '@/components/ui';
import {
  formatEstimatedMinutes,
  formatReleasedCount,
  formatSessionDate,
  formatTaskCount,
} from '@/features/tasks/utils/formatSessionHistory';
import type { SessionSummary } from '@/types/session';

type SessionSummaryRowProps = {
  summary: SessionSummary;
};

export function SessionSummaryRow({ summary }: SessionSummaryRowProps) {
  const dateLabel = formatSessionDate(summary.completedAt);

  return (
    <Card aria-label={`Session on ${dateLabel}`}>
      <p className="font-medium text-[var(--color-text-primary)]">{dateLabel}</p>
      <dl className="mt-3 grid gap-2 text-[var(--color-text-secondary)]">
        <div className="flex items-baseline justify-between gap-3">
          <dt>Tasks created</dt>
          <dd className="text-[var(--color-text-primary)]">{formatTaskCount(summary.tasksCreated)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt>Released</dt>
          <dd className="text-[var(--color-text-primary)]">
            {formatReleasedCount(summary.releasedCount)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt>Estimated time</dt>
          <dd className="text-[var(--color-text-primary)]">
            {formatEstimatedMinutes(summary.estimatedTimeTotal)}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

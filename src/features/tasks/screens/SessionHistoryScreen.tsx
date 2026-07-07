import { useNavigate } from 'react-router-dom';

import { Screen, SecondaryButton } from '@/components/ui';
import { SessionSummaryRow } from '@/features/tasks/components/SessionSummaryRow';
import { useSessionSummaries } from '@/features/tasks/hooks/useSessionSummaries';

export function SessionHistoryScreen() {
  const navigate = useNavigate();
  const { summaries, isLoading } = useSessionSummaries();

  return (
    <Screen
      title="Session History"
      footer={
        <SecondaryButton type="button" onClick={() => navigate('/')}>
          Back to home
        </SecondaryButton>
      }
    >
      {isLoading ? (
        <p className="text-[var(--color-text-secondary)]" aria-live="polite">
          Loading session history…
        </p>
      ) : summaries.length === 0 ? (
        <div className="text-[var(--color-text-secondary)]">
          <p className="font-medium text-[var(--color-text-primary)]">No sessions yet</p>
          <p className="mt-2">
            Completed Mental Reset sessions will appear here with summary stats only — tasks
            created, items released, and estimated time.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Past sessions">
          {summaries.map((summary) => (
            <li key={summary.id}>
              <SessionSummaryRow summary={summary} />
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}

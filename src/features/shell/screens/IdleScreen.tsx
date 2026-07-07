import { useNavigate } from 'react-router-dom';

import { PrimaryCTA, Screen, SecondaryButton } from '@/components/ui';
import { useSessionActions } from '@/lib/sessionMachine';

export function IdleScreen() {
  const navigate = useNavigate();
  const { start, isTransitioning } = useSessionActions();

  return (
    <Screen
      title="MentalReset"
      footer={
        <PrimaryCTA
          type="button"
          onClick={() => {
            void start();
          }}
          disabled={isTransitioning}
        >
          Start Mental Reset
        </PrimaryCTA>
      }
    >
      <p className="text-center text-[var(--color-text-secondary)]">
        A calm space to reset your mind and plan your day.
      </p>
      <nav
        aria-label="App navigation"
        className="mt-[var(--spacing-section)] flex flex-col gap-3"
      >
        <SecondaryButton type="button" onClick={() => navigate('/plan')}>
          Today&apos;s Plan
        </SecondaryButton>
        <SecondaryButton type="button" onClick={() => navigate('/history')}>
          Session History
        </SecondaryButton>
        <SecondaryButton type="button" onClick={() => navigate('/settings')}>
          Settings
        </SecondaryButton>
      </nav>
    </Screen>
  );
}

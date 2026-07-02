import { useNavigate } from 'react-router-dom';

import { Screen, SecondaryButton } from '@/components/ui';

export function HistoryScreen() {
  const navigate = useNavigate();

  return (
    <Screen
      title="Session History"
      footer={
        <SecondaryButton type="button" onClick={() => navigate('/')}>
          Back to home
        </SecondaryButton>
      }
    >
      <p className="text-[var(--color-text-secondary)]">
        Past session summaries will appear here in a later feature.
      </p>
    </Screen>
  );
}

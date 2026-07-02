import { useNavigate } from 'react-router-dom';

import { Screen, SecondaryButton } from '@/components/ui';

export function TodaysPlanScreen() {
  const navigate = useNavigate();

  return (
    <Screen
      title="Today's Plan"
      footer={
        <SecondaryButton type="button" onClick={() => navigate('/')}>
          Back to home
        </SecondaryButton>
      }
    >
      <p className="text-[var(--color-text-secondary)]">
        Task management views will be added in a later feature. For now, this route confirms
        shell navigation is wired.
      </p>
    </Screen>
  );
}

import { useNavigate } from 'react-router-dom';

import { Screen, SecondaryButton } from '@/components/ui';

export function SettingsScreen() {
  const navigate = useNavigate();

  return (
    <Screen
      title="Settings"
      footer={
        <SecondaryButton type="button" onClick={() => navigate('/')}>
          Back to home
        </SecondaryButton>
      }
    >
      <p className="text-[var(--color-text-secondary)]">
        Settings and account preferences will be added in a later feature.
      </p>
    </Screen>
  );
}

import { PrimaryCTA, Screen } from '@/components/ui';

export function App() {
  return (
    <Screen
      title="MentalReset"
      footer={<PrimaryCTA type="button">Start Mental Reset</PrimaryCTA>}
    >
      <p className="text-center text-[var(--color-text-secondary)]">
        A calm space to reset your mind and plan your day.
      </p>
    </Screen>
  );
}

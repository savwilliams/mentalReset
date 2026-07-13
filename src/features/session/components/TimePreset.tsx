import { useId, useState, type FormEvent } from 'react';

import { Input, PrimaryCTA, SecondaryButton } from '@/components/ui';
import {
  MAX_ESTIMATED_MINUTES,
  TIME_PRESETS,
} from '@/features/session/constants';
import { parseCustomEstimateMinutes } from '@/features/session/hooks/useTimeEstimationQueue';

interface TimePresetProps {
  disabled?: boolean;
  onSelect: (minutes: number) => void;
}

export function TimePreset({ disabled = false, onSelect }: TimePresetProps) {
  const customId = useId();
  const [customValue, setCustomValue] = useState('');
  const [customError, setCustomError] = useState<string | undefined>();

  const handleCustomSubmit = (event: FormEvent) => {
    event.preventDefault();
    const minutes = parseCustomEstimateMinutes(customValue);
    if (minutes === null) {
      setCustomError(`Enter a whole number from 1 to ${MAX_ESTIMATED_MINUTES}.`);
      return;
    }

    setCustomError(undefined);
    setCustomValue('');
    onSelect(minutes);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3" role="group" aria-label="Time presets">
        {TIME_PRESETS.map((minutes) => (
          <SecondaryButton
            key={minutes}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(minutes)}
          >
            {minutes} min
          </SecondaryButton>
        ))}
      </div>

      <form className="flex flex-col gap-2" onSubmit={handleCustomSubmit}>
        <Input
          id={customId}
          label="Custom minutes"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder={`1–${MAX_ESTIMATED_MINUTES}`}
          value={customValue}
          error={customError}
          disabled={disabled}
          onChange={(event) => {
            setCustomValue(event.target.value);
            if (customError) {
              setCustomError(undefined);
            }
          }}
        />
        <PrimaryCTA type="submit" disabled={disabled || customValue.trim().length === 0}>
          Set custom time
        </PrimaryCTA>
      </form>
    </div>
  );
}

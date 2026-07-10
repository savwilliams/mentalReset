import { PrimaryCTA, SecondaryButton } from '@/components/ui';
import { PRIORITY_LABELS, PRIORITY_OPTIONS } from '@/features/session/constants';
import type { ThoughtPriority } from '@/types/session';

interface CategoryPickerProps {
  disabled?: boolean;
  onSelect: (priority: ThoughtPriority) => void;
}

export function CategoryPicker({ disabled = false, onSelect }: CategoryPickerProps) {
  return (
    <div className="flex flex-col gap-3" role="group" aria-label="Priority options">
      {PRIORITY_OPTIONS.map((priority, index) => {
        const label = PRIORITY_LABELS[priority];
        const Button = index === 0 ? PrimaryCTA : SecondaryButton;

        return (
          <Button
            key={priority}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(priority)}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}

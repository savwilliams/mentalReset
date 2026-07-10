import { useId, useState } from 'react';

import { Card, Input, SecondaryButton } from '@/components/ui';
import {
  MAX_THOUGHT_LENGTH,
  THOUGHT_LENGTH_WARNING_AT,
  isThoughtTextValid,
} from '@/features/session/hooks/useThoughtQueue';
import type { Thought } from '@/types/session';

type ThoughtCardProps = {
  thought: Thought;
  onSave: (id: string, text: string) => boolean;
  onDelete: (id: string) => void;
  disabled?: boolean;
};

export function ThoughtCard({ thought, onSave, onDelete, disabled = false }: ThoughtCardProps) {
  const editInputId = useId();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(thought.text);

  const showLengthWarning = draft.length >= THOUGHT_LENGTH_WARNING_AT;
  const canSave = isThoughtTextValid(draft);

  if (isEditing) {
    return (
      <Card>
        <Input
          id={editInputId}
          label="Edit thought"
          value={draft}
          maxLength={MAX_THOUGHT_LENGTH}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && canSave) {
              event.preventDefault();
              if (onSave(thought.id, draft)) {
                setIsEditing(false);
              }
            }
            if (event.key === 'Escape') {
              setDraft(thought.text);
              setIsEditing(false);
            }
          }}
        />
        {showLengthWarning ? (
          <p className="mt-1.5 text-[length:var(--font-size-label)] text-[var(--color-text-secondary)]">
            {draft.length}/{MAX_THOUGHT_LENGTH} characters
          </p>
        ) : null}
        <div className="mt-3 flex gap-2">
          <SecondaryButton
            type="button"
            className="w-auto flex-1"
            disabled={disabled || !canSave}
            onClick={() => {
              if (onSave(thought.id, draft)) {
                setIsEditing(false);
              }
            }}
          >
            Save
          </SecondaryButton>
          <SecondaryButton
            type="button"
            className="w-auto flex-1"
            disabled={disabled}
            onClick={() => {
              setDraft(thought.text);
              setIsEditing(false);
            }}
          >
            Cancel
          </SecondaryButton>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-[var(--color-text-primary)]">{thought.text}</p>
      <div className="mt-3 flex gap-2">
        <SecondaryButton
          type="button"
          className="w-auto flex-1"
          disabled={disabled}
          onClick={() => {
            setDraft(thought.text);
            setIsEditing(true);
          }}
        >
          Edit
        </SecondaryButton>
        <SecondaryButton
          type="button"
          className="w-auto flex-1"
          disabled={disabled}
          aria-label={`Delete thought: ${thought.text}`}
          onClick={() => onDelete(thought.id)}
        >
          Delete
        </SecondaryButton>
      </div>
    </Card>
  );
}

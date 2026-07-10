import { useCallback } from 'react';

import { useSessionActions } from '@/lib/sessionMachine';
import { useSessionThoughts } from '@/stores/sessionStore';
import type { Thought } from '@/types/session';

export const MAX_THOUGHT_LENGTH = 500;
export const THOUGHT_LENGTH_WARNING_AT = 450;

export function normalizeThoughtText(text: string): string {
  return text.trim().slice(0, MAX_THOUGHT_LENGTH);
}

export function isThoughtTextValid(text: string): boolean {
  return normalizeThoughtText(text).length > 0;
}

export function createThought(text: string): Thought | null {
  const normalized = normalizeThoughtText(text);
  if (!normalized) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    text: normalized,
  };
}

export function useThoughtQueue() {
  const thoughts = useSessionThoughts();
  const { updateThoughts } = useSessionActions();

  const addThought = useCallback(
    (text: string): boolean => {
      const thought = createThought(text);
      if (!thought) {
        return false;
      }

      updateThoughts([...thoughts, thought]);
      return true;
    },
    [thoughts, updateThoughts],
  );

  const editThought = useCallback(
    (id: string, text: string): boolean => {
      const normalized = normalizeThoughtText(text);
      if (!normalized) {
        return false;
      }

      const next = thoughts.map((thought) =>
        thought.id === id ? { ...thought, text: normalized } : thought,
      );
      updateThoughts(next);
      return true;
    },
    [thoughts, updateThoughts],
  );

  const deleteThought = useCallback(
    (id: string) => {
      updateThoughts(thoughts.filter((thought) => thought.id !== id));
    },
    [thoughts, updateThoughts],
  );

  return {
    thoughts,
    addThought,
    editThought,
    deleteThought,
    canContinue: thoughts.length >= 1,
  };
}

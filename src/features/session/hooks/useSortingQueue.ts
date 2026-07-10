import { useCallback } from 'react';

import { useSessionActions } from '@/lib/sessionMachine';
import { useSessionThoughts } from '@/stores/sessionStore';
import type { Thought, ThoughtResolution } from '@/types/session';

export function isThoughtResolved(thought: Thought): boolean {
  return thought.resolvedAs === 'TASK' || thought.resolvedAs === 'RELEASE';
}

export function areAllThoughtsResolved(thoughts: Thought[]): boolean {
  return thoughts.length >= 1 && thoughts.every(isThoughtResolved);
}

export function useSortingQueue() {
  const thoughts = useSessionThoughts();
  const { updateThoughts } = useSessionActions();

  const unresolved = thoughts.filter((thought) => !isThoughtResolved(thought));
  const currentThought = unresolved[0] ?? null;
  const resolvedCount = thoughts.length - unresolved.length;
  const canContinue = areAllThoughtsResolved(thoughts);

  const resolveThought = useCallback(
    (id: string, resolvedAs: ThoughtResolution) => {
      const next = thoughts.map((thought) =>
        thought.id === id ? { ...thought, resolvedAs } : thought,
      );
      updateThoughts(next);
    },
    [thoughts, updateThoughts],
  );

  const resolveAsTask = useCallback(
    (id: string) => {
      resolveThought(id, 'TASK');
    },
    [resolveThought],
  );

  const resolveAsRelease = useCallback(
    (id: string) => {
      resolveThought(id, 'RELEASE');
    },
    [resolveThought],
  );

  return {
    thoughts,
    currentThought,
    resolvedCount,
    totalCount: thoughts.length,
    resolveAsTask,
    resolveAsRelease,
    canContinue,
  };
}

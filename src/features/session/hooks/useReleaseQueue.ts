import { useCallback } from 'react';

import { useSessionActions } from '@/lib/sessionMachine';
import { useSessionThoughts } from '@/stores/sessionStore';
import type { Thought } from '@/types/session';

/** Fade/dissolve duration for Release All — intentionally above the 300ms UI cap. */
export const RELEASE_ANIMATION_MS = 700;

export function isSortingReleaseThought(thought: Thought): boolean {
  return thought.resolvedAs === 'RELEASE';
}

export function isCanDoWithoutThought(thought: Thought): boolean {
  return thought.priority === 'CAN_DO_WITHOUT';
}

export function isReleaseQueueThought(thought: Thought): boolean {
  return isSortingReleaseThought(thought) || isCanDoWithoutThought(thought);
}

export function getSortingReleaseThoughts(thoughts: Thought[]): Thought[] {
  return thoughts.filter(isSortingReleaseThought);
}

export function getCanDoWithoutThoughts(thoughts: Thought[]): Thought[] {
  return thoughts.filter(isCanDoWithoutThought);
}

export function getReleaseQueueThoughts(thoughts: Thought[]): Thought[] {
  return thoughts.filter(isReleaseQueueThought);
}

export function discardReleaseQueue(thoughts: Thought[]): {
  remaining: Thought[];
  releasedCount: number;
} {
  const queue = getReleaseQueueThoughts(thoughts);
  const releaseIds = new Set(queue.map((thought) => thought.id));

  return {
    remaining: thoughts.filter((thought) => !releaseIds.has(thought.id)),
    releasedCount: queue.length,
  };
}

export function isReleaseComplete(thoughts: Thought[]): boolean {
  return getReleaseQueueThoughts(thoughts).length === 0;
}

export function useReleaseQueue() {
  const thoughts = useSessionThoughts();
  const { updateThoughts, updateReleasedCount } = useSessionActions();

  const releaseList = getSortingReleaseThoughts(thoughts);
  const canDoWithoutList = getCanDoWithoutThoughts(thoughts);
  const releaseQueue = getReleaseQueueThoughts(thoughts);
  const canContinue = isReleaseComplete(thoughts);
  const hasItemsToRelease = releaseQueue.length > 0;

  const releaseAll = useCallback(() => {
    if (!hasItemsToRelease) {
      return { releasedCount: 0, discarded: [] as Thought[] };
    }

    const { remaining, releasedCount } = discardReleaseQueue(thoughts);
    const discarded = getReleaseQueueThoughts(thoughts);

    updateThoughts(remaining);
    updateReleasedCount(releasedCount);

    return { releasedCount, discarded };
  }, [hasItemsToRelease, thoughts, updateReleasedCount, updateThoughts]);

  return {
    thoughts,
    releaseList,
    canDoWithoutList,
    releaseQueue,
    hasItemsToRelease,
    canContinue,
    releaseAll,
  };
}

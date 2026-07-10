import { useCallback, useMemo, useRef } from 'react';

import { createThoughtsFromLaterTasks } from '@/features/session/hooks/pullInLaterTasks';
import { filterLaterTasks } from '@/features/session/hooks/useLaterTasks';
import { areAllActionableThoughtsPrioritized } from '@/features/session/hooks/usePrioritizationQueue';
import { isReleaseComplete } from '@/features/session/hooks/useReleaseQueue';
import { areAllThoughtsResolved } from '@/features/session/hooks/useSortingQueue';
import {
  areAllEstimableTasksEstimated,
  hasEstimableTasks,
} from '@/features/session/hooks/useTimeEstimationQueue';
import {
  clearEphemeralSessionData,
  completeSession,
  persistSessionSnapshot,
  saveActiveSession,
} from '@/lib/db/persist';
import {
  getValidEvents,
  isActiveSessionState,
  resolveStartTarget,
  resolveTimeEstimationTarget,
  transition,
} from '@/lib/sessionMachine/transitions';
import {
  getSessionSnapshot,
  useSessionState,
  useSessionStore,
} from '@/stores/sessionStore';
import { getTaskSnapshot } from '@/stores/taskStore';
import type { SessionEvent, Thought } from '@/types/session';

const THOUGHT_PERSIST_DEBOUNCE_MS = 300;

let thoughtPersistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingThoughtPersist: Promise<void> | null = null;

function scheduleThoughtPersist(): void {
  if (thoughtPersistTimer) {
    clearTimeout(thoughtPersistTimer);
  }

  thoughtPersistTimer = setTimeout(() => {
    thoughtPersistTimer = null;
    pendingThoughtPersist = persistSessionSnapshot().catch(() => {
      pendingThoughtPersist = null;
    });
  }, THOUGHT_PERSIST_DEBOUNCE_MS);
}

async function persistTransition(): Promise<void> {
  if (thoughtPersistTimer) {
    clearTimeout(thoughtPersistTimer);
    thoughtPersistTimer = null;
  }

  if (pendingThoughtPersist) {
    await pendingThoughtPersist;
    pendingThoughtPersist = null;
  }

  await persistSessionSnapshot();
}

export interface SessionActions {
  start: () => Promise<void>;
  continue: () => Promise<void>;
  completeStartReview: (selectedTaskIds: string[]) => Promise<void>;
  finish: () => Promise<void>;
  abandon: () => Promise<void>;
  updateThoughts: (thoughts: Thought[]) => void;
  updateEstimatedTimeTotal: (estimatedTimeTotal: number) => void;
  updateReleasedCount: (releasedCount: number) => void;
  validEvents: SessionEvent[];
  isTransitioning: boolean;
  isActive: boolean;
}

export function useSessionActions(): SessionActions {
  const isTransitioningRef = useRef(false);
  const state = useSessionState();
  const isTransitioning = useSessionStore((store) => store.isTransitioning);

  const dispatch = useCallback(async (event: SessionEvent) => {
    const store = useSessionStore.getState();

    if (store.isTransitioning || isTransitioningRef.current) {
      return;
    }

    const currentState = store.state;
    let nextState =
      event === 'START' && currentState === 'IDLE'
        ? resolveStartTarget(filterLaterTasks(getTaskSnapshot()).length > 0)
        : transition(currentState, event);

    if (
      event === 'CONTINUE' &&
      currentState === 'PRIORITIZATION' &&
      nextState === 'TIME_ESTIMATION' &&
      !hasEstimableTasks(getTaskSnapshot())
    ) {
      nextState = resolveTimeEstimationTarget(false);
    }

    if (nextState === currentState) {
      return;
    }

    isTransitioningRef.current = true;
    store.setTransitioning(true);

    try {
      if (event === 'START') {
        if (nextState === 'IDLE') {
          return;
        }
        store.startSession(nextState);
      } else if (event === 'FINISH') {
        const snapshot = getSessionSnapshot();
        if (snapshot) {
          await completeSession(snapshot);
        } else {
          await clearEphemeralSessionData();
        }
        store.resetToIdle();
      } else if (event === 'ABANDON') {
        store.resetToIdle();
        await clearEphemeralSessionData();
      } else {
        store.applyTransition(nextState);
      }

      if (event !== 'ABANDON' && event !== 'FINISH') {
        await persistTransition();
      }
    } finally {
      isTransitioningRef.current = false;
      useSessionStore.getState().setTransitioning(false);
    }
  }, []);

  const updateThoughts = useCallback((thoughts: Thought[]) => {
    useSessionStore.getState().setThoughts(thoughts);
    scheduleThoughtPersist();
  }, []);

  const updateEstimatedTimeTotal = useCallback((estimatedTimeTotal: number) => {
    useSessionStore.getState().setEstimatedTimeTotal(estimatedTimeTotal);
    scheduleThoughtPersist();
  }, []);

  const updateReleasedCount = useCallback((releasedCount: number) => {
    useSessionStore.getState().setReleasedCount(releasedCount);
    scheduleThoughtPersist();
  }, []);

  const completeStartReview = useCallback(
    async (selectedTaskIds: string[]) => {
      const thoughts = createThoughtsFromLaterTasks(selectedTaskIds);
      if (thoughts.length > 0) {
        useSessionStore.getState().setThoughts(thoughts);
      }
      await dispatch('CONTINUE');
    },
    [dispatch],
  );

  const validEvents = useMemo(() => getValidEvents(state), [state]);

  const continueSession = useCallback(async () => {
    const store = useSessionStore.getState();
    if (store.state === 'BRAIN_DUMP' && store.thoughts.length < 1) {
      return;
    }
    if (store.state === 'SORTING' && !areAllThoughtsResolved(store.thoughts)) {
      return;
    }
    if (
      store.state === 'PRIORITIZATION' &&
      !areAllActionableThoughtsPrioritized(store.thoughts)
    ) {
      return;
    }
    if (
      store.state === 'TIME_ESTIMATION' &&
      !areAllEstimableTasksEstimated(getTaskSnapshot())
    ) {
      return;
    }
    if (store.state === 'RELEASE' && !isReleaseComplete(store.thoughts)) {
      return;
    }
    await dispatch('CONTINUE');
  }, [dispatch]);

  return {
    start: () => dispatch('START'),
    continue: continueSession,
    completeStartReview,
    finish: () => dispatch('FINISH'),
    abandon: async () => {
      await dispatch('ABANDON');
    },
    updateThoughts,
    updateEstimatedTimeTotal,
    updateReleasedCount,
    validEvents,
    isTransitioning,
    isActive: isActiveSessionState(state),
  };
}

export async function awaitInFlightSessionPersist(): Promise<void> {
  if (thoughtPersistTimer) {
    clearTimeout(thoughtPersistTimer);
    thoughtPersistTimer = null;
    pendingThoughtPersist = persistSessionSnapshot();
  }

  if (pendingThoughtPersist) {
    await pendingThoughtPersist;
    pendingThoughtPersist = null;
  }

  const snapshot = getSessionSnapshot();
  if (snapshot) {
    await saveActiveSession(snapshot);
  }
}

export {
  getValidEvents,
  resolveStartTarget,
  resolveTimeEstimationTarget,
  transition,
} from '@/lib/sessionMachine/transitions';

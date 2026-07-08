import { useCallback, useMemo, useRef } from 'react';

import { createThoughtsFromLaterTasks } from '@/features/session/hooks/pullInLaterTasks';
import { filterLaterTasks } from '@/features/session/hooks/useLaterTasks';
import { clearEphemeralSessionData } from '@/lib/db/persist';
import {
  SESSION_THOUGHT_PERSIST_DEBOUNCE_MS,
  sessionPersist,
} from '@/lib/db/middleware/persistControllers';
import {
  getValidEvents,
  isActiveSessionState,
  resolveStartTarget,
  transition,
} from '@/lib/sessionMachine/transitions';
import {
  useSessionState,
  useSessionStore,
} from '@/stores/sessionStore';
import { getTaskSnapshot } from '@/stores/taskStore';
import type { SessionEvent, Thought } from '@/types/session';

export interface SessionActions {
  start: () => Promise<void>;
  continue: () => Promise<void>;
  completeStartReview: (selectedTaskIds: string[]) => Promise<void>;
  finish: () => Promise<void>;
  abandon: () => Promise<void>;
  updateThoughts: (thoughts: Thought[]) => void;
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
    const nextState =
      event === 'START' && currentState === 'IDLE'
        ? resolveStartTarget(filterLaterTasks(getTaskSnapshot()).length > 0)
        : transition(currentState, event);

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
      } else if (event === 'ABANDON' || event === 'FINISH') {
        store.resetToIdle();
        await clearEphemeralSessionData();
      } else {
        store.applyTransition(nextState);
      }

      if (event !== 'ABANDON' && event !== 'FINISH') {
        await sessionPersist.flush();
      }
    } finally {
      isTransitioningRef.current = false;
      useSessionStore.getState().setTransitioning(false);
    }
  }, []);

  const updateThoughts = useCallback((thoughts: Thought[]) => {
    useSessionStore.getState().setThoughts(thoughts);
    sessionPersist.schedule({ debounceMs: SESSION_THOUGHT_PERSIST_DEBOUNCE_MS });
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

  return {
    start: () => dispatch('START'),
    continue: () => dispatch('CONTINUE'),
    completeStartReview,
    finish: () => dispatch('FINISH'),
    abandon: async () => {
      await dispatch('ABANDON');
    },
    updateThoughts,
    validEvents,
    isTransitioning,
    isActive: isActiveSessionState(state),
  };
}

export async function awaitInFlightSessionPersist(): Promise<void> {
  await sessionPersist.awaitInFlight();
}

export { getValidEvents, resolveStartTarget, transition } from '@/lib/sessionMachine/transitions';

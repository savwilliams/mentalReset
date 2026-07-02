import { useCallback, useMemo, useRef } from 'react';

import {
  clearEphemeralSessionData,
  persistSessionSnapshot,
  saveActiveSession,
} from '@/lib/db/persist';
import { getValidEvents, isActiveSessionState, transition } from '@/lib/sessionMachine/transitions';
import {
  getSessionSnapshot,
  useSessionState,
  useSessionStore,
} from '@/stores/sessionStore';
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
    const nextState = transition(currentState, event);

    if (nextState === currentState) {
      return;
    }

    isTransitioningRef.current = true;
    store.setTransitioning(true);

    try {
      if (event === 'START') {
        store.startSession();
      } else if (event === 'ABANDON' || event === 'FINISH') {
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

  const validEvents = useMemo(() => getValidEvents(state), [state]);

  return {
    start: () => dispatch('START'),
    continue: () => dispatch('CONTINUE'),
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

export { getValidEvents, transition } from '@/lib/sessionMachine/transitions';

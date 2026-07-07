import { create } from 'zustand';

import type { ActiveSession, SessionState, SessionStats, Thought } from '@/types/session';
import { createActiveSession, createEmptySessionStats } from '@/types/session';

interface SessionStoreState {
  state: SessionState;
  sessionId: string | null;
  createdAt: number | null;
  thoughts: Thought[];
  stats: SessionStats;
  isTransitioning: boolean;
  isHydrated: boolean;
}

interface SessionStoreActions {
  applyTransition: (nextState: SessionState) => void;
  startSession: (initialState?: Exclude<SessionState, 'IDLE'>) => void;
  resetToIdle: () => void;
  setTransitioning: (value: boolean) => void;
  setThoughts: (thoughts: Thought[]) => void;
  markHydrated: () => void;
}

type SessionStore = SessionStoreState & SessionStoreActions;

const idleState: SessionStoreState = {
  state: 'IDLE',
  sessionId: null,
  createdAt: null,
  thoughts: [],
  stats: createEmptySessionStats(),
  isTransitioning: false,
  isHydrated: false,
};

export const useSessionStore = create<SessionStore>((set) => ({
  ...idleState,

  applyTransition: (nextState) =>
    set((current) => ({
      ...current,
      state: nextState,
      isTransitioning: false,
    })),

  startSession: (initialState: Exclude<SessionState, 'IDLE'> = 'BRAIN_DUMP') => {
    const session = createActiveSession(initialState);
    set({
      state: initialState,
      sessionId: session.id,
      createdAt: session.createdAt,
      thoughts: session.thoughts,
      stats: session.stats,
      isTransitioning: false,
    });
  },

  resetToIdle: () =>
    set({
      state: 'IDLE',
      sessionId: null,
      createdAt: null,
      thoughts: [],
      stats: createEmptySessionStats(),
      isTransitioning: false,
    }),

  setTransitioning: (value) => set({ isTransitioning: value }),

  setThoughts: (thoughts) =>
    set((current) => ({
      thoughts,
      stats: {
        ...current.stats,
        thoughtsCount: thoughts.length,
      },
    })),

  markHydrated: () => set({ isHydrated: true }),
}));

export const useSessionState = () => useSessionStore((store) => store.state);
export const useSessionThoughts = () => useSessionStore((store) => store.thoughts);
export const useSessionStats = () => useSessionStore((store) => store.stats);
export const useIsSessionActive = () => useSessionStore((store) => store.state !== 'IDLE');
export const useSessionHydrated = () => useSessionStore((store) => store.isHydrated);

export function getSessionSnapshot(): ActiveSession | null {
  const { state, sessionId, createdAt, thoughts, stats } = useSessionStore.getState();
  if (state === 'IDLE' || !sessionId || createdAt === null) {
    return null;
  }

  return {
    id: sessionId,
    state,
    createdAt,
    stats,
    thoughts,
  };
}

export function hydrateSessionStore(session: ActiveSession | undefined): void {
  const store = useSessionStore.getState();

  if (store.isHydrated) {
    return;
  }

  if (session && session.state !== 'IDLE') {
    useSessionStore.setState({
      state: session.state,
      sessionId: session.id,
      createdAt: session.createdAt,
      thoughts: session.thoughts,
      stats: session.stats,
      isTransitioning: false,
      isHydrated: true,
    });
    return;
  }

  store.markHydrated();
}

export function getSessionStoreState() {
  return useSessionStore.getState();
}

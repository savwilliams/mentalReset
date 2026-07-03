import type { SessionEvent, SessionState } from '@/types/session';
import { SESSION_EVENTS, SESSION_STATES } from '@/types/session';

export type TransitionTable = Record<SessionState, Partial<Record<SessionEvent, SessionState>>>;

export const TRANSITION_TABLE: TransitionTable = {
  IDLE: {
    START: 'BRAIN_DUMP',
  },
  BRAIN_DUMP: {
    CONTINUE: 'SORTING',
    ABANDON: 'IDLE',
  },
  SORTING: {
    CONTINUE: 'PRIORITIZATION',
    ABANDON: 'IDLE',
  },
  PRIORITIZATION: {
    CONTINUE: 'TIME_ESTIMATION',
    ABANDON: 'IDLE',
  },
  TIME_ESTIMATION: {
    CONTINUE: 'RELEASE',
    ABANDON: 'IDLE',
  },
  RELEASE: {
    CONTINUE: 'SUMMARY',
    ABANDON: 'IDLE',
  },
  SUMMARY: {
    FINISH: 'IDLE',
    ABANDON: 'IDLE',
  },
};

export function getValidEvents(state: SessionState): SessionEvent[] {
  return SESSION_EVENTS.filter((event) => TRANSITION_TABLE[state][event] !== undefined);
}

export function transition(
  state: SessionState,
  event: SessionEvent,
  options?: { throwOnInvalid?: boolean },
): SessionState {
  const nextState = TRANSITION_TABLE[state][event];
  const throwOnInvalid = options?.throwOnInvalid ?? import.meta.env.DEV;

  if (!nextState) {
    const message = `Invalid session transition: ${state} + ${event}`;
    if (throwOnInvalid) {
      throw new Error(message);
    }
    return state;
  }

  return nextState;
}

export function isActiveSessionState(state: SessionState): boolean {
  return state !== 'IDLE';
}

export function isValidTransition(state: SessionState, event: SessionEvent): boolean {
  return TRANSITION_TABLE[state][event] !== undefined;
}

export { SESSION_EVENTS, SESSION_STATES };

export const SESSION_STATES = [
  'IDLE',
  'BRAIN_DUMP',
  'SORTING',
  'PRIORITIZATION',
  'TIME_ESTIMATION',
  'RELEASE',
  'SUMMARY',
] as const;

export type SessionState = (typeof SESSION_STATES)[number];

export const SESSION_EVENTS = ['START', 'CONTINUE', 'FINISH', 'ABANDON'] as const;

export type SessionEvent = (typeof SESSION_EVENTS)[number];

export type ThoughtResolution = 'TASK' | 'RELEASE';

export type ThoughtPriority = 'TODAY' | 'SOON' | 'LATER' | 'CAN_DO_WITHOUT';

export interface Thought {
  id: string;
  text: string;
  resolvedAs?: ThoughtResolution;
  priority?: ThoughtPriority;
}

export interface SessionStats {
  thoughtsCount: number;
  tasksCreated: number;
  releasedCount: number;
  estimatedTimeTotal: number;
}

export interface ActiveSession {
  id: string;
  state: SessionState;
  createdAt: number;
  completedAt?: number;
  stats: SessionStats;
  thoughts: Thought[];
}

export interface SessionSummary {
  id: string;
  completedAt: number;
  tasksCreated: number;
  releasedCount: number;
  estimatedTimeTotal: number;
}

export function createEmptySessionStats(): SessionStats {
  return {
    thoughtsCount: 0,
    tasksCreated: 0,
    releasedCount: 0,
    estimatedTimeTotal: 0,
  };
}

export function createActiveSession(state: SessionState = 'BRAIN_DUMP'): ActiveSession {
  return {
    id: crypto.randomUUID(),
    state,
    createdAt: Date.now(),
    stats: createEmptySessionStats(),
    thoughts: [],
  };
}

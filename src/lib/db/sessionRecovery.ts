import { db } from '@/lib/db/database';
import {
  SESSION_STATES,
  buildSessionSummary,
  createEmptySessionStats,
  type ActiveSession,
  type SessionState,
  type SessionStats,
  type Thought,
  type ThoughtPriority,
  type ThoughtResolution,
  type ThoughtSource,
} from '@/types/session';

const VALID_STATES = new Set<string>(SESSION_STATES);
const VALID_RESOLUTIONS = new Set<string>(['TASK', 'RELEASE']);
const VALID_PRIORITIES = new Set<string>(['TODAY', 'SOON', 'LATER', 'CAN_DO_WITHOUT']);
const VALID_SOURCES = new Set<string>(['SAVE_FOR_LATER']);

export type SessionRecoveryOutcome =
  | { status: 'active'; session: ActiveSession }
  | { status: 'idle' }
  | { status: 'cleared_completed' }
  | { status: 'cleared_corrupt'; reason: string };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function parseStats(raw: unknown): SessionStats | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const stats = raw as Record<string, unknown>;
  if (
    !isFiniteNumber(stats.thoughtsCount) ||
    !isFiniteNumber(stats.tasksCreated) ||
    !isFiniteNumber(stats.releasedCount) ||
    !isFiniteNumber(stats.estimatedTimeTotal)
  ) {
    return null;
  }

  return {
    thoughtsCount: stats.thoughtsCount,
    tasksCreated: stats.tasksCreated,
    releasedCount: stats.releasedCount,
    estimatedTimeTotal: stats.estimatedTimeTotal,
  };
}

function parseThought(raw: unknown): Thought | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const thought = raw as Record<string, unknown>;
  if (!isNonEmptyString(thought.id) || typeof thought.text !== 'string') {
    return null;
  }

  const parsed: Thought = {
    id: thought.id,
    text: thought.text,
  };

  if (thought.resolvedAs !== undefined) {
    if (typeof thought.resolvedAs !== 'string' || !VALID_RESOLUTIONS.has(thought.resolvedAs)) {
      return null;
    }
    parsed.resolvedAs = thought.resolvedAs as ThoughtResolution;
  }

  if (thought.priority !== undefined) {
    if (typeof thought.priority !== 'string' || !VALID_PRIORITIES.has(thought.priority)) {
      return null;
    }
    parsed.priority = thought.priority as ThoughtPriority;
  }

  if (thought.source !== undefined) {
    if (typeof thought.source !== 'string' || !VALID_SOURCES.has(thought.source)) {
      return null;
    }
    parsed.source = thought.source as ThoughtSource;
  }

  if (thought.sourceTaskId !== undefined) {
    if (!isNonEmptyString(thought.sourceTaskId)) {
      return null;
    }
    parsed.sourceTaskId = thought.sourceTaskId;
  }

  return parsed;
}

/**
 * Validates a Dexie session blob. Returns null when the shape is corrupt.
 */
export function parseActiveSession(raw: unknown): ActiveSession | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const session = raw as Record<string, unknown>;

  if (!isNonEmptyString(session.id) || !isFiniteNumber(session.createdAt) || session.createdAt <= 0) {
    return null;
  }

  if (typeof session.state !== 'string' || !VALID_STATES.has(session.state)) {
    return null;
  }

  const stats = parseStats(session.stats) ?? createEmptySessionStats();

  if (!Array.isArray(session.thoughts)) {
    return null;
  }

  const thoughts: Thought[] = [];
  for (const item of session.thoughts) {
    const thought = parseThought(item);
    if (!thought) {
      return null;
    }
    thoughts.push(thought);
  }

  const parsed: ActiveSession = {
    id: session.id,
    state: session.state as SessionState,
    createdAt: session.createdAt,
    stats,
    thoughts,
  };

  if (session.completedAt !== undefined) {
    if (!isFiniteNumber(session.completedAt) || session.completedAt <= 0) {
      return null;
    }
    parsed.completedAt = session.completedAt;
  }

  return parsed;
}

async function clearActiveSessions(): Promise<void> {
  await db.sessions.clear();
}

async function ensureSummaryForCompletedSession(session: ActiveSession): Promise<void> {
  const existing = await db.sessionSummaries.get(session.id);
  if (existing) {
    return;
  }

  await db.sessionSummaries.put(buildSessionSummary(session));
}

/**
 * Hardened recovery: validate Dexie session rows, rehydrate only safe active
 * sessions, and clear completed or corrupt blobs without touching summaries.
 */
export async function recoverActiveSessionFromDb(): Promise<SessionRecoveryOutcome> {
  let rows: unknown[];

  try {
    rows = await db.sessions.toArray();
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Failed to read sessions table';
    console.error('[SessionRecovery] Corrupt session storage; resetting to IDLE.', error);
    try {
      await clearActiveSessions();
    } catch {
      // Best-effort clear; still return idle so the app can boot.
    }
    return { status: 'cleared_corrupt', reason };
  }

  if (rows.length === 0) {
    return { status: 'idle' };
  }

  // Prefer a non-IDLE candidate; fall back to the first row.
  const preferred =
    rows.find((row) => {
      const parsed = parseActiveSession(row);
      return parsed && parsed.state !== 'IDLE';
    }) ?? rows[0];

  const session = parseActiveSession(preferred);
  if (!session) {
    const reason = 'Active session blob failed validation';
    console.error('[SessionRecovery] Corrupt session blob; resetting to IDLE.', preferred);
    await clearActiveSessions();
    return { status: 'cleared_corrupt', reason };
  }

  const matchingSummary = await db.sessionSummaries.get(session.id);
  const isCompleted = session.completedAt !== undefined || matchingSummary !== undefined;

  if (isCompleted) {
    await ensureSummaryForCompletedSession(session);
    await clearActiveSessions();
    return { status: 'cleared_completed' };
  }

  if (session.state === 'IDLE') {
    await clearActiveSessions();
    return { status: 'idle' };
  }

  return { status: 'active', session };
}

export async function getRecoveredActiveSession(): Promise<ActiveSession | undefined> {
  const outcome = await recoverActiveSessionFromDb();
  return outcome.status === 'active' ? outcome.session : undefined;
}

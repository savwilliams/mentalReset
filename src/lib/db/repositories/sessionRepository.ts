import type { ActiveSession } from '@/types/session';

import { db } from '@/lib/db/database';

export async function getActiveSession(): Promise<ActiveSession | undefined> {
  const sessions = await db.sessions.toArray();
  return sessions.find((session) => session.state !== 'IDLE');
}

export async function saveActiveSession(session: ActiveSession): Promise<void> {
  await db.sessions.put(session);
}

export async function clearActiveSession(): Promise<void> {
  await db.sessions.clear();
}

export async function clearEphemeralSessionData(): Promise<void> {
  await db.sessions.clear();
}

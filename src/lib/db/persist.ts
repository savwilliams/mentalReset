import { db } from '@/lib/db/database';
import {
  clearEphemeralSessionData,
  getActiveSession,
  saveActiveSession,
} from '@/lib/db/repositories/sessionRepository';
import { saveSettings } from '@/lib/db/repositories/settingsRepository';
import { saveTasks } from '@/lib/db/repositories/taskRepository';
import { getSessionSnapshot } from '@/stores/sessionStore';
import { getSettingsSnapshot } from '@/stores/settingsStore';
import { getTaskSnapshot } from '@/stores/taskStore';
import {
  buildSessionSummary,
  type ActiveSession,
  type SessionSummary,
} from '@/types/session';

export { clearEphemeralSessionData, saveActiveSession } from '@/lib/db/repositories/sessionRepository';

export async function persistSessionSnapshot(): Promise<void> {
  const snapshot = getSessionSnapshot();
  if (!snapshot) {
    await clearEphemeralSessionData();
    return;
  }

  await saveActiveSession(snapshot);
}

/** Atomically persist SessionSummary and clear the active session row. */
export async function completeSession(session: ActiveSession): Promise<SessionSummary> {
  const summary = buildSessionSummary(session);

  await db.transaction('rw', db.sessionSummaries, db.sessions, async () => {
    await db.sessionSummaries.put(summary);
    await db.sessions.clear();
  });

  return summary;
}

export async function persistTaskSnapshot(): Promise<void> {
  await saveTasks(getTaskSnapshot());
}

export async function persistSettingsSnapshot(): Promise<void> {
  const snapshot = getSettingsSnapshot();
  if (snapshot) {
    await saveSettings(snapshot);
  }
}

export async function rehydrateActiveSessionFromDb() {
  return getActiveSession();
}

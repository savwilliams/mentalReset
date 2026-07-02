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

export { clearEphemeralSessionData, saveActiveSession } from '@/lib/db/repositories/sessionRepository';

export async function persistSessionSnapshot(): Promise<void> {
  const snapshot = getSessionSnapshot();
  if (!snapshot) {
    await clearEphemeralSessionData();
    return;
  }

  await saveActiveSession(snapshot);
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

import { IndexedDBUnavailableError, isIndexedDBAvailable, openDatabase } from '@/lib/db/database';
import { getRecoveredActiveSession } from '@/lib/db/sessionRecovery';
import { getSettings } from '@/lib/db/repositories/settingsRepository';
import { getAllTasks } from '@/lib/db/repositories/taskRepository';
import { hydrateSessionStore } from '@/stores/sessionStore';
import { hydrateSettingsStore } from '@/stores/settingsStore';
import { hydrateTaskStore } from '@/stores/taskStore';
import { initSyncStore } from '@/stores/syncStore';

export { IndexedDBUnavailableError } from '@/lib/db/database';

let initPromise: Promise<void> | null = null;

export function resetDataLayerForTests(): void {
  initPromise = null;
}

export async function initDataLayer(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    if (!isIndexedDBAvailable()) {
      throw new IndexedDBUnavailableError();
    }

    await openDatabase();
    initSyncStore();

    // Recover before other hydrations so corrupt/completed sessions are cleared first.
    const activeSession = await getRecoveredActiveSession();
    const [tasks, settings] = await Promise.all([getAllTasks(), getSettings()]);

    hydrateSessionStore(activeSession);
    hydrateTaskStore(tasks);
    hydrateSettingsStore(settings);
  })();

  return initPromise;
}

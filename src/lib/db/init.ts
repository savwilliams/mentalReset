import { IndexedDBUnavailableError, isIndexedDBAvailable, openDatabase } from '@/lib/db/database';
import {
  resetPersistMiddlewareForTests,
  startPersistMiddleware,
} from '@/lib/db/middleware/persistControllers';
import { getActiveSession } from '@/lib/db/repositories/sessionRepository';
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
  resetPersistMiddlewareForTests();
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

    const [activeSession, tasks, settings] = await Promise.all([
      getActiveSession(),
      getAllTasks(),
      getSettings(),
    ]);

    hydrateSessionStore(activeSession);
    hydrateTaskStore(tasks);
    hydrateSettingsStore(settings);
    startPersistMiddleware();
  })();

  return initPromise;
}

export {
  DB_NAME,
  DB_VERSION,
  IndexedDBUnavailableError,
  db,
  isIndexedDBAvailable,
  openDatabase,
} from '@/lib/db/database';
export { initDataLayer } from '@/lib/db/init';
export {
  persistSessionSnapshot,
  persistTaskSnapshot,
  persistSettingsSnapshot,
  clearEphemeralSessionData,
  saveActiveSession,
} from '@/lib/db/persist';
export {
  getRecoveredActiveSession,
  parseActiveSession,
  recoverActiveSessionFromDb,
} from '@/lib/db/sessionRecovery';
export {
  clearActiveSession,
  getActiveSession,
} from '@/lib/db/repositories/sessionRepository';
export { getAllTasks, saveTask, saveTasks } from '@/lib/db/repositories/taskRepository';
export { getSettings, saveSettings } from '@/lib/db/repositories/settingsRepository';
export {
  clearSessionSummaries,
  getAllSessionSummaries,
  saveSessionSummary,
} from '@/lib/db/repositories/sessionSummaryRepository';

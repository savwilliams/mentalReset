export { pickLastWriteWins, isLocalNewerOrEqual, shouldOverwriteRemote } from '@/lib/sync/conflict';
export {
  taskToFirestore,
  taskFromFirestore,
  summaryToFirestore,
  summaryFromFirestore,
  settingsToFirestore,
  settingsFromFirestore,
  assertNoThoughts,
} from '@/lib/sync/firestoreMappers';
export {
  enqueueTaskSync,
  enqueueSummarySync,
  enqueueSettingsSync,
  flushSyncQueue,
  initSyncEngine,
  getPendingSyncJobs,
  getPendingSyncCount,
  resetSyncEngineForTests,
  setSyncWriterForTests,
} from '@/lib/sync/syncEngine';
export type { SyncJob, SyncEntityType, SyncWriter } from '@/lib/sync/syncEngine';
export { createFirestoreWriter } from '@/lib/sync/firestoreWriter';

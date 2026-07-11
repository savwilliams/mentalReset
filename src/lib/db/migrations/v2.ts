/**
 * Dexie schema v2 — adds `createdAt` index on tasks for chronological queries.
 * Index-only upgrade; row data is preserved as-is (AC-7).
 */
export const V2_STORES = {
  tasks: 'id, category, completed, updatedAt, createdAt',
  sessions: 'id, state, createdAt',
  sessionSummaries: 'id, completedAt',
  settings: 'id, updatedAt',
} as const;

export const V1_STORES = {
  tasks: 'id, category, completed, updatedAt',
  sessions: 'id, state, createdAt',
  sessionSummaries: 'id, completedAt',
  settings: 'id, updatedAt',
} as const;

export const SCHEMA_VERSION_V2 = 2;

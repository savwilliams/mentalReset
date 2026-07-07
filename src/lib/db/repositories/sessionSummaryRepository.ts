import type { SessionSummary } from '@/types/session';

import { db } from '@/lib/db/database';

export async function getAllSessionSummaries(): Promise<SessionSummary[]> {
  return db.sessionSummaries.orderBy('completedAt').reverse().toArray();
}

export async function saveSessionSummary(summary: SessionSummary): Promise<void> {
  await db.sessionSummaries.put(summary);
}

export async function clearSessionSummaries(): Promise<void> {
  await db.sessionSummaries.clear();
}

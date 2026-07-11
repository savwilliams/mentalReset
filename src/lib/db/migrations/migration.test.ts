import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';

import { DB_NAME, MentalResetDatabase } from '@/lib/db/database';
import { SCHEMA_VERSION_V2, V1_STORES, V2_STORES } from '@/lib/db/migrations/v2';
import type { Task } from '@/types/task';

const TASK_V1: Task = {
  id: 'task-migrate-1',
  text: 'Survive schema upgrade',
  category: 'TODAY',
  completed: false,
  estimatedMinutes: 20,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_100,
  source: 'SESSION',
};

describe('Dexie schema migration v1 → v2', () => {
  afterEach(async () => {
    await Dexie.delete(DB_NAME);
  });

  it('upgrades without data loss (AC-7)', async () => {
    const v1 = new Dexie(DB_NAME);
    v1.version(1).stores({ ...V1_STORES });
    await v1.open();
    await v1.table('tasks').put(TASK_V1);
    await v1.table('settings').put({
      id: 'local',
      notificationsEnabled: false,
      theme: 'system',
      updatedAt: 42,
    });
    v1.close();

    const v2 = new MentalResetDatabase();
    await v2.open();

    expect(v2.verno).toBe(SCHEMA_VERSION_V2);

    const task = await v2.tasks.get(TASK_V1.id);
    expect(task).toEqual(TASK_V1);

    const settings = await v2.settings.get('local');
    expect(settings).toMatchObject({
      id: 'local',
      notificationsEnabled: false,
      theme: 'system',
      updatedAt: 42,
    });

    // New createdAt index is queryable after upgrade.
    const byCreatedAt = await v2.tasks.where('createdAt').equals(TASK_V1.createdAt).toArray();
    expect(byCreatedAt).toHaveLength(1);
    expect(byCreatedAt[0]?.id).toBe(TASK_V1.id);

    expect(V2_STORES.tasks).toContain('createdAt');
    v2.close();
  });
});

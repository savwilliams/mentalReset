import { describe, expect, it } from 'vitest';

import {
  assertNoThoughts,
  settingsFromFirestore,
  settingsToFirestore,
  summaryFromFirestore,
  summaryToFirestore,
  taskFromFirestore,
  taskToFirestore,
} from '@/lib/sync/firestoreMappers';
import type { SessionSummary } from '@/types/session';
import type { UserSettings } from '@/types/settings';
import type { Task } from '@/types/task';

describe('firestoreMappers', () => {
  const task: Task = {
    id: 'task-1',
    text: 'Write tests',
    category: 'TODAY',
    completed: false,
    estimatedMinutes: 25,
    createdAt: 1,
    updatedAt: 2,
    source: 'SESSION',
  };

  const summary: SessionSummary = {
    id: 'session-1',
    completedAt: 10,
    tasksCreated: 3,
    releasedCount: 2,
    estimatedTimeTotal: 45,
  };

  const settings: UserSettings = {
    id: 'local',
    notificationsEnabled: false,
    theme: 'system',
    updatedAt: 99,
  };

  it('round-trips tasks without thought fields', () => {
    const cloud = taskToFirestore(task);
    expect(cloud).not.toHaveProperty('thoughts');
    expect(taskFromFirestore(cloud as unknown as Record<string, unknown>)).toEqual(task);
  });

  it('round-trips session summaries (stats only)', () => {
    const cloud = summaryToFirestore(summary);
    expect(cloud).not.toHaveProperty('thoughts');
    expect(cloud).not.toHaveProperty('state');
    expect(summaryFromFirestore(cloud as unknown as Record<string, unknown>)).toEqual(summary);
  });

  it('round-trips settings and keeps a local settings id', () => {
    const cloud = settingsToFirestore(settings);
    expect(cloud).not.toHaveProperty('id');
    expect(cloud).not.toHaveProperty('thoughts');
    expect(settingsFromFirestore(cloud as unknown as Record<string, unknown>)).toEqual(settings);
  });

  it('rejects invalid cloud payloads', () => {
    expect(taskFromFirestore({ id: 'x', text: '', category: 'NOPE' })).toBeNull();
    expect(summaryFromFirestore({ completedAt: 1 })).toBeNull();
  });

  it('never allows thoughts in sync payloads (AC-5)', () => {
    expect(() => assertNoThoughts({ id: '1', thoughts: [{ id: 't' }] })).toThrow(
      /Thoughts must never be synced/,
    );
    expect(() => assertNoThoughts({ id: '1', text: 'ok' })).not.toThrow();
  });
});

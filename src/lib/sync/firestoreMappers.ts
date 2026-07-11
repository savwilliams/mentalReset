import type { SessionSummary } from '@/types/session';
import type { UserSettings, ThemePreference } from '@/types/settings';
import type { Task, TaskCategory, TaskSource } from '@/types/task';

/** Cloud payload for a task (no thoughts — tasks never carry session thoughts). */
export interface FirestoreTaskDoc {
  id: string;
  text: string;
  category: TaskCategory;
  completed: boolean;
  estimatedMinutes?: number;
  createdAt: number;
  updatedAt: number;
  source?: TaskSource;
}

export interface FirestoreSummaryDoc {
  id: string;
  completedAt: number;
  tasksCreated: number;
  releasedCount: number;
  estimatedTimeTotal: number;
}

export interface FirestoreSettingsDoc {
  notificationsEnabled: boolean;
  theme?: ThemePreference;
  updatedAt: number;
}

const TASK_CATEGORIES = new Set<string>(['TODAY', 'SOON', 'LATER']);
const TASK_SOURCES = new Set<string>(['SESSION', 'SAVE_FOR_LATER']);
const THEMES = new Set<string>(['system', 'light', 'dark']);

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function taskToFirestore(task: Task): FirestoreTaskDoc {
  const doc: FirestoreTaskDoc = {
    id: task.id,
    text: task.text,
    category: task.category,
    completed: task.completed,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };

  if (task.estimatedMinutes !== undefined) {
    doc.estimatedMinutes = task.estimatedMinutes;
  }
  if (task.source !== undefined) {
    doc.source = task.source;
  }

  return doc;
}

export function taskFromFirestore(data: Record<string, unknown>): Task | null {
  const id = asString(data.id);
  const text = asString(data.text);
  const category = asString(data.category);

  if (!id || !text || !TASK_CATEGORIES.has(category)) {
    return null;
  }

  const task: Task = {
    id,
    text,
    category: category as TaskCategory,
    completed: Boolean(data.completed),
    createdAt: asNumber(data.createdAt),
    updatedAt: asNumber(data.updatedAt),
  };

  if (typeof data.estimatedMinutes === 'number') {
    task.estimatedMinutes = data.estimatedMinutes;
  }

  if (typeof data.source === 'string' && TASK_SOURCES.has(data.source)) {
    task.source = data.source as TaskSource;
  }

  return task;
}

export function summaryToFirestore(summary: SessionSummary): FirestoreSummaryDoc {
  return {
    id: summary.id,
    completedAt: summary.completedAt,
    tasksCreated: summary.tasksCreated,
    releasedCount: summary.releasedCount,
    estimatedTimeTotal: summary.estimatedTimeTotal,
  };
}

export function summaryFromFirestore(data: Record<string, unknown>): SessionSummary | null {
  const id = asString(data.id);
  if (!id) {
    return null;
  }

  return {
    id,
    completedAt: asNumber(data.completedAt),
    tasksCreated: asNumber(data.tasksCreated),
    releasedCount: asNumber(data.releasedCount),
    estimatedTimeTotal: asNumber(data.estimatedTimeTotal),
  };
}

export function settingsToFirestore(settings: UserSettings): FirestoreSettingsDoc {
  const doc: FirestoreSettingsDoc = {
    notificationsEnabled: settings.notificationsEnabled,
    updatedAt: settings.updatedAt,
  };

  if (settings.theme !== undefined) {
    doc.theme = settings.theme;
  }

  return doc;
}

export function settingsFromFirestore(
  data: Record<string, unknown>,
  localId = 'local',
): UserSettings | null {
  if (typeof data.notificationsEnabled !== 'boolean' && data.updatedAt == null) {
    return null;
  }

  const settings: UserSettings = {
    id: localId,
    notificationsEnabled: Boolean(data.notificationsEnabled),
    updatedAt: asNumber(data.updatedAt, Date.now()),
  };

  if (typeof data.theme === 'string' && THEMES.has(data.theme)) {
    settings.theme = data.theme as ThemePreference;
  }

  return settings;
}

/** Guards against accidentally syncing thought-shaped payloads. */
export function assertNoThoughts(payload: Record<string, unknown>): void {
  if ('thoughts' in payload) {
    throw new Error('Thoughts must never be synced to Firestore');
  }
}

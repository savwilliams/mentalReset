import type { Task } from '@/types/task';

import { db } from '@/lib/db/database';
import { enqueueTaskSync } from '@/lib/sync/syncEngine';

export async function getAllTasks(): Promise<Task[]> {
  return db.tasks.orderBy('updatedAt').reverse().toArray();
}

export async function saveTask(task: Task): Promise<void> {
  await db.tasks.put(task);
  enqueueTaskSync(task.id);
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await db.tasks.bulkPut(tasks);
  for (const task of tasks) {
    enqueueTaskSync(task.id);
  }
}

export async function clearTasks(): Promise<void> {
  await db.tasks.clear();
}

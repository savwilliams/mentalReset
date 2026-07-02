import type { Task } from '@/types/task';

import { db } from '@/lib/db/database';

export async function getAllTasks(): Promise<Task[]> {
  return db.tasks.orderBy('updatedAt').reverse().toArray();
}

export async function saveTask(task: Task): Promise<void> {
  await db.tasks.put(task);
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await db.tasks.bulkPut(tasks);
}

export async function clearTasks(): Promise<void> {
  await db.tasks.clear();
}

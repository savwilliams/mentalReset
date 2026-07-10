import { useCallback } from 'react';

import { MAX_ESTIMATED_MINUTES } from '@/features/session/constants';
import { useSessionActions } from '@/lib/sessionMachine';
import { useTasks, useTaskStore } from '@/stores/taskStore';
import type { Task } from '@/types/task';

export function isEstimableTask(task: Task): boolean {
  return task.category === 'TODAY' || task.category === 'SOON';
}

export function isTaskEstimated(task: Task): boolean {
  return typeof task.estimatedMinutes === 'number' && task.estimatedMinutes > 0;
}

export function getEstimableTasks(tasks: Task[]): Task[] {
  return tasks.filter(isEstimableTask);
}

export function hasEstimableTasks(tasks: Task[]): boolean {
  return tasks.some(isEstimableTask);
}

export function areAllEstimableTasksEstimated(tasks: Task[]): boolean {
  return getEstimableTasks(tasks).every(isTaskEstimated);
}

export function sumEstimatedMinutes(tasks: Task[]): number {
  return getEstimableTasks(tasks).reduce(
    (total, task) => total + (task.estimatedMinutes ?? 0),
    0,
  );
}

export function parseCustomEstimateMinutes(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const value = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(value) || value < 1 || value > MAX_ESTIMATED_MINUTES) {
    return null;
  }

  return value;
}

export function applyEstimateToTask(
  tasks: Task[],
  taskId: string,
  estimatedMinutes: number,
  now = Date.now(),
): Task[] {
  return tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          estimatedMinutes,
          updatedAt: now,
        }
      : task,
  );
}

export function useTimeEstimationQueue() {
  const tasks = useTasks();
  const { updateEstimatedTimeTotal } = useSessionActions();

  const estimable = getEstimableTasks(tasks);
  const unestimated = estimable.filter((task) => !isTaskEstimated(task));
  const currentTask = unestimated[0] ?? null;
  const estimatedCount = estimable.length - unestimated.length;
  const canContinue = areAllEstimableTasksEstimated(tasks);

  const assignEstimate = useCallback(
    (taskId: string, estimatedMinutes: number) => {
      if (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 1) {
        return;
      }
      if (estimatedMinutes > MAX_ESTIMATED_MINUTES) {
        return;
      }

      const currentTasks = useTaskStore.getState().tasks;
      const task = currentTasks.find((item) => item.id === taskId);
      if (!task || !isEstimableTask(task) || isTaskEstimated(task)) {
        return;
      }

      const nextTasks = applyEstimateToTask(currentTasks, taskId, estimatedMinutes);
      useTaskStore.getState().replaceTasks(nextTasks);
      updateEstimatedTimeTotal(sumEstimatedMinutes(nextTasks));
    },
    [updateEstimatedTimeTotal],
  );

  return {
    tasks,
    estimable,
    currentTask,
    estimatedCount,
    totalCount: estimable.length,
    assignEstimate,
    canContinue,
  };
}

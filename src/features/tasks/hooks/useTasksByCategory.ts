import { useMemo } from 'react';

import { useTasks } from '@/stores/taskStore';
import type { Task, TaskCategory } from '@/types/task';

export type TasksByCategory = Record<TaskCategory | 'completed', Task[]>;

export function groupTasksByCategory(tasks: Task[]): TasksByCategory {
  return {
    TODAY: tasks.filter((task) => !task.completed && task.category === 'TODAY'),
    SOON: tasks.filter((task) => !task.completed && task.category === 'SOON'),
    LATER: tasks.filter((task) => !task.completed && task.category === 'LATER'),
    completed: tasks.filter((task) => task.completed),
  };
}

export function useTasksByCategory(): TasksByCategory {
  const tasks = useTasks();
  return useMemo(() => groupTasksByCategory(tasks), [tasks]);
}

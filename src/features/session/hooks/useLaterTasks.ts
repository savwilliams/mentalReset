import { useMemo } from 'react';

import { useTasks } from '@/stores/taskStore';
import type { Task } from '@/types/task';

export function filterLaterTasks(tasks: Task[]): Task[] {
  return tasks.filter((task) => task.category === 'LATER' && !task.completed);
}

export function useLaterTasks(): Task[] {
  const tasks = useTasks();

  return useMemo(() => filterLaterTasks(tasks), [tasks]);
}

import { create } from 'zustand';

import type { Task } from '@/types/task';

interface TaskStoreState {
  tasks: Task[];
  isHydrated: boolean;
}

interface TaskStoreActions {
  setTasks: (tasks: Task[]) => void;
  markHydrated: () => void;
}

type TaskStore = TaskStoreState & TaskStoreActions;

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  isHydrated: false,

  setTasks: (tasks) => set({ tasks }),
  markHydrated: () => set({ isHydrated: true }),
}));

export const useTasks = () => useTaskStore((store) => store.tasks);
export const useTasksHydrated = () => useTaskStore((store) => store.isHydrated);

export function getTaskSnapshot(): Task[] {
  return useTaskStore.getState().tasks;
}

export function hydrateTaskStore(tasks: Task[]): void {
  const store = useTaskStore.getState();
  if (store.isHydrated) {
    return;
  }

  useTaskStore.setState({ tasks, isHydrated: true });
}

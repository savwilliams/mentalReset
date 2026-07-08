import { create } from 'zustand';

import { saveTasks } from '@/lib/db/repositories/taskRepository';
import type { Task, TaskCategory } from '@/types/task';

interface TaskStoreState {
  tasks: Task[];
  isHydrated: boolean;
}

interface TaskStoreActions {
  setTasks: (tasks: Task[]) => void;
  markHydrated: () => void;
  toggleTaskCompleted: (taskId: string) => void;
  moveTaskCategory: (taskId: string, category: TaskCategory) => void;
}

type TaskStore = TaskStoreState & TaskStoreActions;

function persistTasks(tasks: Task[]): void {
  void saveTasks(tasks);
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  isHydrated: false,

  setTasks: (tasks) => set({ tasks }),
  markHydrated: () => set({ isHydrated: true }),

  toggleTaskCompleted: (taskId) => {
    const now = Date.now();
    const tasks = get().tasks.map((task) =>
      task.id === taskId
        ? { ...task, completed: !task.completed, updatedAt: now }
        : task,
    );
    set({ tasks });
    persistTasks(tasks);
  },

  moveTaskCategory: (taskId, category) => {
    const now = Date.now();
    const tasks = get().tasks.map((task) => {
      if (task.id !== taskId) {
        return task;
      }

      return {
        ...task,
        category,
        updatedAt: now,
        ...(category === 'LATER' ? { estimatedMinutes: undefined } : {}),
      };
    });
    set({ tasks });
    persistTasks(tasks);
  },
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

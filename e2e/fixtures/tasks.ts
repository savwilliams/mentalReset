export type TaskCategory = 'TODAY' | 'SOON' | 'LATER';

export type SeedTask = {
  id: string;
  text: string;
  category: TaskCategory;
  completed: boolean;
  estimatedMinutes?: number;
  createdAt: number;
  updatedAt: number;
  source?: 'SESSION' | 'SAVE_FOR_LATER';
};

export type SeedTaskInput = {
  id?: string;
  text: string;
  category: TaskCategory;
  completed?: boolean;
  estimatedMinutes?: number;
  source?: SeedTask['source'];
};

export type SeedSessionSummary = {
  id: string;
  completedAt: number;
  tasksCreated: number;
  releasedCount: number;
  estimatedTimeTotal: number;
};

export function createSeedTask(input: SeedTaskInput): SeedTask {
  const now = Date.now();
  return {
    id: input.id ?? crypto.randomUUID(),
    text: input.text,
    category: input.category,
    completed: input.completed ?? false,
    estimatedMinutes: input.estimatedMinutes,
    createdAt: now,
    updatedAt: now,
    source: input.source,
  };
}

export const SEED_TASKS = {
  todayTask: () =>
    createSeedTask({
      id: 'task-today-1',
      text: 'Review project notes',
      category: 'TODAY',
      estimatedMinutes: 30,
    }),
  soonTask: () =>
    createSeedTask({
      id: 'task-soon-1',
      text: 'Organize desk',
      category: 'SOON',
      estimatedMinutes: 15,
    }),
  laterTask: () =>
    createSeedTask({
      id: 'task-later-1',
      text: 'Plan weekend trip',
      category: 'LATER',
      source: 'SAVE_FOR_LATER',
    }),
  moveableTask: () =>
    createSeedTask({
      id: 'task-move-1',
      text: 'Email team update',
      category: 'TODAY',
      estimatedMinutes: 10,
    }),
};

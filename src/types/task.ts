export const TASK_CATEGORIES = ['TODAY', 'SOON', 'LATER'] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export type TaskSource = 'SESSION' | 'SAVE_FOR_LATER';

export interface Task {
  id: string;
  text: string;
  category: TaskCategory;
  completed: boolean;
  estimatedMinutes?: number;
  createdAt: number;
  updatedAt: number;
  source?: TaskSource;
}

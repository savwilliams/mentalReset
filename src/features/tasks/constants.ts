import type { TaskCategory } from '@/types/task';

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  TODAY: 'Needs Attention Today',
  SOON: 'Important if Time Allows',
  LATER: 'Save for Later',
};

export const COMPLETED_SECTION_LABEL = 'Completed';

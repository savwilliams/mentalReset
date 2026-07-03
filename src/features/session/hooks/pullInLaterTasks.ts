import { filterLaterTasks } from '@/features/session/hooks/useLaterTasks';
import { getTaskSnapshot } from '@/stores/taskStore';
import type { Thought } from '@/types/session';

export function createThoughtsFromLaterTasks(selectedTaskIds: string[]): Thought[] {
  const selectedIds = new Set(selectedTaskIds);
  const laterTasks = filterLaterTasks(getTaskSnapshot()).filter((task) => selectedIds.has(task.id));

  return laterTasks.map((task) => ({
    id: crypto.randomUUID(),
    text: task.text,
    source: 'SAVE_FOR_LATER' as const,
    sourceTaskId: task.id,
  }));
}

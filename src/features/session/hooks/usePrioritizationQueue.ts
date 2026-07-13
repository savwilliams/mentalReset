import { useCallback } from 'react';

import { useSessionActions } from '@/lib/sessionMachine';
import { useSessionThoughts } from '@/stores/sessionStore';
import { useTaskStore } from '@/stores/taskStore';
import type { Thought, ThoughtPriority } from '@/types/session';
import type { Task, TaskCategory } from '@/types/task';

const TASK_PRIORITIES: ThoughtPriority[] = ['TODAY', 'SOON', 'LATER'];

export function isActionableThought(thought: Thought): boolean {
  return thought.resolvedAs === 'TASK';
}

export function isThoughtPrioritized(thought: Thought): boolean {
  return thought.priority !== undefined;
}

export function areAllActionableThoughtsPrioritized(thoughts: Thought[]): boolean {
  const actionable = thoughts.filter(isActionableThought);
  return actionable.every(isThoughtPrioritized);
}

function isTaskCategory(priority: ThoughtPriority): priority is TaskCategory {
  return TASK_PRIORITIES.includes(priority);
}

export function createTaskFromThought(thought: Thought, category: TaskCategory, now = Date.now()): Task {
  return {
    id: crypto.randomUUID(),
    text: thought.text,
    category,
    completed: false,
    createdAt: now,
    updatedAt: now,
    source: 'SESSION',
  };
}

export function promoteThoughtToTaskStore(
  thought: Thought,
  priority: ThoughtPriority,
  tasks: Task[],
  now = Date.now(),
): Task[] {
  if (priority === 'CAN_DO_WITHOUT') {
    if (thought.sourceTaskId) {
      return tasks.filter((task) => task.id !== thought.sourceTaskId);
    }
    return tasks;
  }

  if (!isTaskCategory(priority)) {
    return tasks;
  }

  if (thought.sourceTaskId) {
    const existing = tasks.find((task) => task.id === thought.sourceTaskId);
    if (existing) {
      return tasks.map((task) =>
        task.id === thought.sourceTaskId
          ? {
              ...task,
              category: priority,
              updatedAt: now,
              ...(priority === 'LATER' ? { estimatedMinutes: undefined } : {}),
            }
          : task,
      );
    }
  }

  return [...tasks, createTaskFromThought(thought, priority, now)];
}

export function usePrioritizationQueue() {
  const thoughts = useSessionThoughts();
  const { updateThoughts } = useSessionActions();

  const actionable = thoughts.filter(isActionableThought);
  const unprioritized = actionable.filter((thought) => !isThoughtPrioritized(thought));
  const currentThought = unprioritized[0] ?? null;
  const prioritizedCount = actionable.length - unprioritized.length;
  const canContinue = areAllActionableThoughtsPrioritized(thoughts);

  const assignPriority = useCallback(
    (id: string, priority: ThoughtPriority) => {
      const thought = thoughts.find((item) => item.id === id);
      if (!thought || !isActionableThought(thought) || isThoughtPrioritized(thought)) {
        return;
      }

      const nextThoughts = thoughts.map((item) =>
        item.id === id ? { ...item, priority } : item,
      );

      useTaskStore.getState().replaceTasks(
        promoteThoughtToTaskStore(thought, priority, useTaskStore.getState().tasks),
      );
      updateThoughts(nextThoughts);
    },
    [thoughts, updateThoughts],
  );

  return {
    thoughts,
    actionable,
    currentThought,
    prioritizedCount,
    totalCount: actionable.length,
    assignPriority,
    canContinue,
  };
}

import { Card, SecondaryButton } from '@/components/ui';
import { CATEGORY_LABELS } from '@/features/tasks/constants';
import { useTaskStore } from '@/stores/taskStore';
import type { Task, TaskCategory } from '@/types/task';

type TaskRowProps = {
  task: Task;
  showEstimatedTime?: boolean;
};

const MOVE_TARGETS: Record<TaskCategory, TaskCategory[]> = {
  TODAY: ['SOON', 'LATER'],
  SOON: ['TODAY', 'LATER'],
  LATER: ['TODAY', 'SOON'],
};

function formatEstimatedMinutes(minutes: number): string {
  return `${minutes} min`;
}

export function TaskRow({ task, showEstimatedTime = false }: TaskRowProps) {
  const toggleTaskCompleted = useTaskStore((store) => store.toggleTaskCompleted);
  const moveTaskCategory = useTaskStore((store) => store.moveTaskCategory);
  const checkboxId = `task-complete-${task.id}`;
  const moveTargets = task.completed ? [] : MOVE_TARGETS[task.category];

  return (
    <Card className="p-0" data-testid={`task-row-${task.id}`}>
      <div className="flex items-start gap-3 p-4">
        <input
          id={checkboxId}
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
          checked={task.completed}
          aria-label={
            task.completed ? `Mark ${task.text} incomplete` : `Mark ${task.text} complete`
          }
          onChange={() => toggleTaskCompleted(task.id)}
        />
        <div className="min-w-0 flex-1">
          <label
            htmlFor={checkboxId}
            className={`block cursor-pointer text-[var(--color-text-primary)] ${
              task.completed ? 'line-through opacity-70' : ''
            }`}
          >
            {task.text}
          </label>
          {showEstimatedTime && task.estimatedMinutes != null && !task.completed ? (
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {formatEstimatedMinutes(task.estimatedMinutes)}
            </p>
          ) : null}
          {moveTargets.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {moveTargets.map((category) => (
                <SecondaryButton
                  key={category}
                  type="button"
                  className="min-h-0 px-3 py-1.5 text-sm"
                  aria-label={`Move ${task.text} to ${CATEGORY_LABELS[category]}`}
                  onClick={() => moveTaskCategory(task.id, category)}
                >
                  {CATEGORY_LABELS[category]}
                </SecondaryButton>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

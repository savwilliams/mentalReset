import { TaskRow } from '@/features/tasks/components/TaskRow';
import type { Task } from '@/types/task';

type CategorySectionProps = {
  title: string;
  tasks: Task[];
  emptyMessage: string;
  showEstimatedTime?: boolean;
};

export function CategorySection({
  title,
  tasks,
  emptyMessage,
  showEstimatedTime = false,
}: CategorySectionProps) {
  return (
    <section aria-label={title} data-testid={`category-section-${title}`}>
      <h2 className="text-base font-medium text-[var(--color-text-primary)]">{title}</h2>
      {tasks.length === 0 ? (
        <p className="mt-2 text-[var(--color-text-secondary)]">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3" aria-label={title}>
          {tasks.map((task) => (
            <li key={task.id}>
              <TaskRow task={task} showEstimatedTime={showEstimatedTime} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

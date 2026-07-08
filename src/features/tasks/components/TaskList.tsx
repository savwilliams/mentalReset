import { CategorySection } from '@/features/tasks/components/CategorySection';
import {
  CATEGORY_LABELS,
  COMPLETED_SECTION_LABEL,
} from '@/features/tasks/constants';
import { useTasksByCategory } from '@/features/tasks/hooks/useTasksByCategory';

export function TaskList() {
  const grouped = useTasksByCategory();

  return (
    <div className="flex flex-col gap-[var(--spacing-section)]">
      <CategorySection
        title={CATEGORY_LABELS.TODAY}
        tasks={grouped.TODAY}
        emptyMessage="Nothing needs attention today."
        showEstimatedTime
      />
      <CategorySection
        title={CATEGORY_LABELS.SOON}
        tasks={grouped.SOON}
        emptyMessage="No flexible priorities right now."
        showEstimatedTime
      />
      <CategorySection
        title={CATEGORY_LABELS.LATER}
        tasks={grouped.LATER}
        emptyMessage="Save for Later is empty."
      />
      <CategorySection
        title={COMPLETED_SECTION_LABEL}
        tasks={grouped.completed}
        emptyMessage="Completed tasks will appear here."
      />
    </div>
  );
}

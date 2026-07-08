import { useNavigate } from 'react-router-dom';

import { Screen, SecondaryButton } from '@/components/ui';
import { TaskList } from '@/features/tasks/components/TaskList';
import { useTasksHydrated } from '@/stores/taskStore';

export function TodaysPlanScreen() {
  const navigate = useNavigate();
  const isHydrated = useTasksHydrated();

  return (
    <Screen
      title="Today's Plan"
      footer={
        <SecondaryButton type="button" onClick={() => navigate('/')}>
          Back to home
        </SecondaryButton>
      }
    >
      {isHydrated ? (
        <TaskList />
      ) : (
        <p className="text-[var(--color-text-secondary)]" aria-live="polite">
          Loading tasks…
        </p>
      )}
    </Screen>
  );
}

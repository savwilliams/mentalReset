import { useCallback, useState } from 'react';

import { Card, PrimaryCTA, Screen, SecondaryButton } from '@/components/ui';
import { useSessionGuard } from '@/features/shell';
import { useLaterTasks } from '@/features/session/hooks/useLaterTasks';
import { useSessionActions } from '@/lib/sessionMachine';

export function StartSessionScreen() {
  const laterTasks = useLaterTasks();
  const { requestAbandon } = useSessionGuard();
  const { completeStartReview, isTransitioning } = useSessionActions();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const toggleTask = useCallback((taskId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const handleContinue = useCallback(() => {
    void completeStartReview([...selectedIds]);
  }, [completeStartReview, selectedIds]);

  const handleSkip = useCallback(() => {
    void completeStartReview([]);
  }, [completeStartReview]);

  return (
    <Screen
      title="Mental Reset"
      footer={
        <div className="flex flex-col gap-3">
          <PrimaryCTA type="button" onClick={handleContinue} disabled={isTransitioning}>
            Continue
          </PrimaryCTA>
          <SecondaryButton type="button" onClick={handleSkip} disabled={isTransitioning}>
            Skip for now
          </SecondaryButton>
        </div>
      }
    >
      <p className="text-[var(--color-text-secondary)]">
        You have tasks saved for later. Select any you&apos;d like to bring into this session, or
        skip to start fresh.
      </p>

      <ul className="mt-[var(--spacing-section)] flex flex-col gap-3" aria-label="Save for Later tasks">
        {laterTasks.map((task) => {
          const checkboxId = `later-task-${task.id}`;

          return (
            <li key={task.id}>
              <Card className="p-0">
                <label
                  htmlFor={checkboxId}
                  className="flex cursor-pointer items-start gap-3 p-4"
                >
                  <input
                    id={checkboxId}
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
                    checked={selectedIds.has(task.id)}
                    onChange={() => toggleTask(task.id)}
                  />
                  <span className="text-[var(--color-text-primary)]">{task.text}</span>
                </label>
              </Card>
            </li>
          );
        })}
      </ul>

      <SecondaryButton
        type="button"
        className="mt-[var(--spacing-section)]"
        onClick={() => requestAbandon()}
        disabled={isTransitioning}
      >
        Leave session
      </SecondaryButton>
    </Screen>
  );
}

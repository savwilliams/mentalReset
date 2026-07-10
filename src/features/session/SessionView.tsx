import type { ComponentType } from 'react';

import { PrimaryCTA, Screen, SecondaryButton } from '@/components/ui';
import { useSessionGuard } from '@/features/shell';
import { BrainDumpScreen } from '@/features/session/screens/BrainDumpScreen';
import { SortingScreen } from '@/features/session/screens/SortingScreen';
import { StartSessionScreen } from '@/features/session/screens/StartSessionScreen';
import { useSessionActions } from '@/lib/sessionMachine';
import { useSessionState } from '@/stores/sessionStore';
import type { SessionState } from '@/types/session';

const SESSION_STEP_LABELS: Record<
  Exclude<SessionState, 'IDLE' | 'START_REVIEW' | 'BRAIN_DUMP' | 'SORTING'>,
  string
> = {
  PRIORITIZATION: 'Prioritization',
  TIME_ESTIMATION: 'Time Estimation',
  RELEASE: 'Release',
  SUMMARY: 'Summary',
};

type ActiveSessionState = Exclude<SessionState, 'IDLE'>;

function SessionStepPlaceholder({
  step,
}: {
  step: Exclude<ActiveSessionState, 'START_REVIEW' | 'BRAIN_DUMP' | 'SORTING'>;
}) {
  const { requestAbandon } = useSessionGuard();
  const { continue: continueSession, finish, validEvents, isTransitioning } = useSessionActions();

  const primaryAction = validEvents.includes('FINISH')
    ? { label: 'Finish', action: finish }
    : validEvents.includes('CONTINUE')
      ? { label: 'Continue', action: continueSession }
      : null;

  return (
    <Screen
      title="Mental Reset"
      footer={
        primaryAction ? (
          <PrimaryCTA
            type="button"
            onClick={() => {
              void primaryAction.action();
            }}
            disabled={isTransitioning}
          >
            {primaryAction.label}
          </PrimaryCTA>
        ) : undefined
      }
    >
      <p className="text-[var(--color-text-secondary)]">
        {SESSION_STEP_LABELS[step]} — full step UI arrives in feature 02.
      </p>
      {validEvents.includes('ABANDON') ? (
        <SecondaryButton
          type="button"
          className="mt-[var(--spacing-section)]"
          onClick={() => requestAbandon()}
        >
          Leave session
        </SecondaryButton>
      ) : null}
    </Screen>
  );
}

const SESSION_VIEWS: Record<ActiveSessionState, ComponentType> = {
  START_REVIEW: StartSessionScreen,
  BRAIN_DUMP: BrainDumpScreen,
  SORTING: SortingScreen,
  PRIORITIZATION: () => <SessionStepPlaceholder step="PRIORITIZATION" />,
  TIME_ESTIMATION: () => <SessionStepPlaceholder step="TIME_ESTIMATION" />,
  RELEASE: () => <SessionStepPlaceholder step="RELEASE" />,
  SUMMARY: () => <SessionStepPlaceholder step="SUMMARY" />,
};

export function resolveSessionView(state: SessionState): ComponentType | null {
  if (state === 'IDLE') {
    return null;
  }

  return SESSION_VIEWS[state];
}

export function SessionView() {
  const state = useSessionState();
  const View = resolveSessionView(state);

  if (!View) {
    return null;
  }

  return <View />;
}

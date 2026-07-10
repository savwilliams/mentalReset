import type { ComponentType } from 'react';

import { PrimaryCTA, Screen, SecondaryButton } from '@/components/ui';
import { BrainDumpScreen } from '@/features/session/screens/BrainDumpScreen';
import { PrioritizationScreen } from '@/features/session/screens/PrioritizationScreen';
import { ReleaseScreen } from '@/features/session/screens/ReleaseScreen';
import { SortingScreen } from '@/features/session/screens/SortingScreen';
import { StartSessionScreen } from '@/features/session/screens/StartSessionScreen';
import { TimeEstimationScreen } from '@/features/session/screens/TimeEstimationScreen';
import { useSessionGuard } from '@/features/shell';
import { useSessionActions } from '@/lib/sessionMachine';
import { useSessionState } from '@/stores/sessionStore';
import type { SessionState } from '@/types/session';

const SESSION_STEP_LABELS: Record<'SUMMARY', string> = {
  SUMMARY: 'Summary',
};

type ActiveSessionState = Exclude<SessionState, 'IDLE'>;

function SessionStepPlaceholder({
  step,
}: {
  step: Exclude<
    ActiveSessionState,
    | 'START_REVIEW'
    | 'BRAIN_DUMP'
    | 'SORTING'
    | 'PRIORITIZATION'
    | 'TIME_ESTIMATION'
    | 'RELEASE'
  >;
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
  PRIORITIZATION: PrioritizationScreen,
  TIME_ESTIMATION: TimeEstimationScreen,
  RELEASE: ReleaseScreen,
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

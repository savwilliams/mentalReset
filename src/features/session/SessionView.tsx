import type { ComponentType } from 'react';

import { BrainDumpScreen } from '@/features/session/screens/BrainDumpScreen';
import { PrioritizationScreen } from '@/features/session/screens/PrioritizationScreen';
import { ReleaseScreen } from '@/features/session/screens/ReleaseScreen';
import { SortingScreen } from '@/features/session/screens/SortingScreen';
import { StartSessionScreen } from '@/features/session/screens/StartSessionScreen';
import { SummaryScreen } from '@/features/session/screens/SummaryScreen';
import { TimeEstimationScreen } from '@/features/session/screens/TimeEstimationScreen';
import { useSessionState } from '@/stores/sessionStore';
import type { SessionState } from '@/types/session';

type ActiveSessionState = Exclude<SessionState, 'IDLE'>;

const SESSION_VIEWS: Record<ActiveSessionState, ComponentType> = {
  START_REVIEW: StartSessionScreen,
  BRAIN_DUMP: BrainDumpScreen,
  SORTING: SortingScreen,
  PRIORITIZATION: PrioritizationScreen,
  TIME_ESTIMATION: TimeEstimationScreen,
  RELEASE: ReleaseScreen,
  SUMMARY: SummaryScreen,
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

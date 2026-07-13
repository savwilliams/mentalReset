import type { ThoughtPriority } from '@/types/session';

export const PRIORITY_LABELS: Record<ThoughtPriority, string> = {
  TODAY: 'Needs Attention Today',
  SOON: 'Important if Time Allows',
  LATER: 'Save for Later',
  CAN_DO_WITHOUT: 'Can Do Without',
};

export const PRIORITY_OPTIONS: ThoughtPriority[] = [
  'TODAY',
  'SOON',
  'LATER',
  'CAN_DO_WITHOUT',
];

/** Preset durations (minutes) for TODAY / SOON time estimation. */
export const TIME_PRESETS = [5, 15, 30, 60] as const;

export type TimePresetMinutes = (typeof TIME_PRESETS)[number];

/** Maximum custom estimate in minutes (8 hours). */
export const MAX_ESTIMATED_MINUTES = 480;

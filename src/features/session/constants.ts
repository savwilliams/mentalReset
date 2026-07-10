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

import { describe, expect, it } from 'vitest';

import {
  formatEstimatedMinutes,
  formatReleasedCount,
  formatTaskCount,
} from '@/features/tasks/utils/formatSessionHistory';

describe('formatSessionHistory', () => {
  it('formats estimated minutes', () => {
    expect(formatEstimatedMinutes(0)).toBe('0 min');
    expect(formatEstimatedMinutes(25)).toBe('25 min');
    expect(formatEstimatedMinutes(60)).toBe('1h');
    expect(formatEstimatedMinutes(90)).toBe('1h 30m');
  });

  it('formats task and released counts with singular labels', () => {
    expect(formatTaskCount(1)).toBe('1 task created');
    expect(formatReleasedCount(1)).toBe('1 item released');
  });

  it('formats task and released counts with plural labels', () => {
    expect(formatTaskCount(3)).toBe('3 tasks created');
    expect(formatReleasedCount(2)).toBe('2 items released');
  });
});

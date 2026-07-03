import { describe, expect, it } from 'vitest';

import {
  SESSION_EVENTS,
  SESSION_STATES,
  getValidEvents,
  isValidTransition,
  transition,
} from '@/lib/sessionMachine/transitions';

describe('sessionMachine transitions', () => {
  it('defines valid events for each state', () => {
    expect(getValidEvents('IDLE')).toEqual(['START']);
    expect(getValidEvents('BRAIN_DUMP')).toEqual(['CONTINUE', 'ABANDON']);
    expect(getValidEvents('SORTING')).toEqual(['CONTINUE', 'ABANDON']);
    expect(getValidEvents('PRIORITIZATION')).toEqual(['CONTINUE', 'ABANDON']);
    expect(getValidEvents('TIME_ESTIMATION')).toEqual(['CONTINUE', 'ABANDON']);
    expect(getValidEvents('RELEASE')).toEqual(['CONTINUE', 'ABANDON']);
    expect(getValidEvents('SUMMARY')).toEqual(['FINISH', 'ABANDON']);
  });

  it('supports the full happy-path session flow', () => {
    let state = transition('IDLE', 'START');
    expect(state).toBe('BRAIN_DUMP');

    state = transition(state, 'CONTINUE');
    expect(state).toBe('SORTING');

    state = transition(state, 'CONTINUE');
    expect(state).toBe('PRIORITIZATION');

    state = transition(state, 'CONTINUE');
    expect(state).toBe('TIME_ESTIMATION');

    state = transition(state, 'CONTINUE');
    expect(state).toBe('RELEASE');

    state = transition(state, 'CONTINUE');
    expect(state).toBe('SUMMARY');

    state = transition(state, 'FINISH');
    expect(state).toBe('IDLE');
  });

  it('allows abandoning from any active session state', () => {
    const activeStates = SESSION_STATES.filter((state) => state !== 'IDLE');

    for (const state of activeStates) {
      expect(transition(state, 'ABANDON')).toBe('IDLE');
    }
  });

  it('rejects invalid transitions when throwOnInvalid is enabled', () => {
    expect(() => transition('IDLE', 'CONTINUE', { throwOnInvalid: true })).toThrow(
      /Invalid session transition/,
    );
    expect(() => transition('BRAIN_DUMP', 'START', { throwOnInvalid: true })).toThrow(
      /Invalid session transition/,
    );
    expect(() => transition('SUMMARY', 'CONTINUE', { throwOnInvalid: true })).toThrow(
      /Invalid session transition/,
    );
  });

  it('returns the current state for invalid transitions when throwOnInvalid is disabled', () => {
    expect(transition('IDLE', 'FINISH', { throwOnInvalid: false })).toBe('IDLE');
    expect(transition('RELEASE', 'START', { throwOnInvalid: false })).toBe('RELEASE');
  });

  it('marks only valid state/event pairs as valid', () => {
    for (const state of SESSION_STATES) {
      for (const event of SESSION_EVENTS) {
        expect(isValidTransition(state, event)).toBe(getValidEvents(state).includes(event));
      }
    }
  });
});

import { describe, expect, it } from 'vitest';

import {
  isLocalNewerOrEqual,
  pickLastWriteWins,
  shouldOverwriteRemote,
} from '@/lib/sync/conflict';

describe('conflict last-write-wins', () => {
  it('prefers the newer updatedAt', () => {
    const local = { id: 'a', updatedAt: 200, text: 'local' };
    const remote = { id: 'a', updatedAt: 100, text: 'remote' };

    expect(pickLastWriteWins(local, remote, (item) => item.updatedAt)).toEqual(local);
    expect(pickLastWriteWins(remote, local, (item) => item.updatedAt)).toEqual(local);
  });

  it('prefers local when timestamps are equal', () => {
    const local = { id: 'a', updatedAt: 100, text: 'local' };
    const remote = { id: 'a', updatedAt: 100, text: 'remote' };

    expect(pickLastWriteWins(local, remote, (item) => item.updatedAt)).toBe(local);
    expect(isLocalNewerOrEqual(100, 100)).toBe(true);
  });

  it('overwrites remote when remote is missing or older', () => {
    expect(shouldOverwriteRemote(100, undefined)).toBe(true);
    expect(shouldOverwriteRemote(100, null)).toBe(true);
    expect(shouldOverwriteRemote(100, 50)).toBe(true);
    expect(shouldOverwriteRemote(50, 100)).toBe(false);
  });
});

/**
 * Last-write-wins at the document level (MVP).
 * Equal timestamps prefer local — local is the runtime source of truth.
 */
export function isLocalNewerOrEqual(localUpdatedAt: number, remoteUpdatedAt: number): boolean {
  return localUpdatedAt >= remoteUpdatedAt;
}

export function pickLastWriteWins<T>(
  local: T,
  remote: T,
  getTimestamp: (item: T) => number,
): T {
  return isLocalNewerOrEqual(getTimestamp(local), getTimestamp(remote)) ? local : remote;
}

/** Whether a local write should overwrite the remote document. */
export function shouldOverwriteRemote(
  localUpdatedAt: number,
  remoteUpdatedAt: number | undefined | null,
): boolean {
  if (remoteUpdatedAt == null) {
    return true;
  }
  return isLocalNewerOrEqual(localUpdatedAt, remoteUpdatedAt);
}

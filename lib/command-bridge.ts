// bb runs plugin commands outside React, but the list they act on lives in
// the overlay's hooks. The overlay publishes what the commands need here on
// every render; each app window loads its own copy of the bundle, so one
// module-level slot per window is exactly right.

export interface CommandTarget {
  /** Thread ids in the block's display order. */
  threadIds: readonly string[];
  /** The thread in view, or null. */
  activeThreadId: string | null;
  open(threadId: string): void;
  toggleCollapsed(): void;
  canCollapse: boolean;
}

let target: CommandTarget | null = null;

export function setCommandTarget(next: CommandTarget | null): void {
  target = next;
}

export function hasNextThread(): boolean {
  return target !== null && target.threadIds.length > 0;
}

/**
 * The thread after the one in view, wrapping around; the first one when the
 * thread in view isn't in the list. Null for an empty list.
 */
export function pickNextThread(
  threadIds: readonly string[],
  activeThreadId: string | null,
): string | null {
  if (threadIds.length === 0) return null;
  const index = activeThreadId === null ? -1 : threadIds.indexOf(activeThreadId);
  return threadIds[(index + 1) % threadIds.length] ?? null;
}

export function openNextThread(): void {
  if (target === null) return;
  const next = pickNextThread(target.threadIds, target.activeThreadId);
  if (next !== null) target.open(next);
}

export function canToggleCollapsed(): boolean {
  return target !== null && target.canCollapse;
}

export function toggleCollapsed(): void {
  target?.toggleCollapsed();
}

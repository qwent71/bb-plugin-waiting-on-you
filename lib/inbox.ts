// Pure sorting of sidebar threads into inbox buckets. No React here, so the
// rules stay easy to read and test.
import type {
  PluginSidebarThread,
  PluginSidebarThreadIndicator,
} from "@get-bb/plugin-sdk/app";

/** The inbox buckets, in badge order. A thread lands in at most one. */
export const BUCKETS = ["decision", "failed", "working", "done"] as const;
export type Bucket = (typeof BUCKETS)[number];

export type InboxView = Record<Bucket, PluginSidebarThread[]>;

const WORKING_INDICATORS: ReadonlySet<PluginSidebarThreadIndicator> = new Set([
  "runtime",
  "workflow",
  "background-agent",
  "background-command",
  "plan-mode",
  "goal",
  "queued-waiting",
]);

const BUSY_STATUSES: ReadonlySet<string> = new Set([
  "starting",
  "active",
  "stopping",
]);

export function bucketOf(thread: PluginSidebarThread): Bucket | null {
  // A pending approval or question blocks the agent until the user answers,
  // so it outranks everything, even an unread failure.
  if (thread.hasPendingInteraction) return "decision";
  if (thread.indicator === "unread-error" || thread.queuedWork === "failed") {
    return "failed";
  }
  if (
    WORKING_INDICATORS.has(thread.indicator) ||
    BUSY_STATUSES.has(thread.status)
  ) {
    return "working";
  }
  if (thread.indicator === "unread-success") return "done";
  return null;
}

export function buildInbox(
  threads: readonly PluginSidebarThread[],
): InboxView {
  const view: InboxView = { decision: [], failed: [], working: [], done: [] };
  for (const thread of threads) {
    if (thread.isHidden || thread.isArchived) continue;
    const bucket = bucketOf(thread);
    if (bucket !== null) view[bucket].push(thread);
  }
  for (const bucket of BUCKETS) {
    view[bucket].sort((a, b) => b.latestAttentionAt - a.latestAttentionAt);
  }
  return view;
}

const relativeTime = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
  style: "short",
});

/** "5 min. ago", "yesterday" — short enough for a sidebar row. */
export function formatAgo(epochMs: number, now = Date.now()): string {
  // A clock a little ahead of this machine's must not read "in 1 min.".
  const seconds = Math.min(0, Math.round((epochMs - now) / 1000));
  const abs = -seconds;
  if (abs < 60) return "just now";
  if (abs < 3600) return relativeTime.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return relativeTime.format(Math.round(seconds / 3600), "hour");
  return relativeTime.format(Math.round(seconds / 86400), "day");
}

const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/** "5m", "3h", "2d" — the tightest form. */
function formatShort(epochMs: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - epochMs) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** "14:32" today, "21 Oct" on an earlier day. */
function formatClock(epochMs: number, now: number): string {
  const sameDay = new Date(epochMs).toDateString() === new Date(now).toDateString();
  return sameDay ? clock.format(epochMs) : day.format(epochMs);
}

export function formatTime(
  epochMs: number,
  now: number,
  format: "relative" | "short" | "clock",
): string {
  if (format === "short") return formatShort(epochMs, now);
  if (format === "clock") return formatClock(epochMs, now);
  return formatAgo(epochMs, now);
}

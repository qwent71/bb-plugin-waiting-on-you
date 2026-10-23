// Made-up threads for the settings preview. They only need the fields the
// block reads; the rest is filled with neutral values.
import type {
  PluginSidebarThread,
  PluginSidebarThreadIndicator,
} from "@get-bb/plugin-sdk/app";
import type { InboxView } from "@/lib/inbox";

export const SAMPLE_PROJECTS: ReadonlyMap<string, string> = new Map([
  ["sample-web", "web"],
  ["sample-api", "api"],
]);

const MINUTE = 60_000;

function sampleThread(
  id: string,
  title: string,
  projectId: string,
  indicator: PluginSidebarThreadIndicator,
  at: number,
): PluginSidebarThread {
  return {
    id,
    projectId,
    title,
    titleFallback: null,
    displayTitle: title,
    parentThreadId: null,
    lifecycleOwnerThreadId: null,
    sourceThreadId: null,
    sectionId: null,
    originKind: null,
    originPluginId: null,
    providerId: "sample",
    status: indicator === "runtime" ? "active" : "idle",
    runtimeStatus: indicator === "runtime" ? "active" : "idle",
    queuedWork: "none",
    hasPendingInteraction: indicator === "waiting-for-input",
    activity: {
      workflows: 0,
      backgroundAgents: 0,
      backgroundCommands: 0,
      planMode: 0,
      goals: 0,
    },
    indicator,
    indicatorLabel: null,
    isUnread: indicator === "unread-error" || indicator === "unread-success",
    isPinned: false,
    pinnedAt: null,
    pinSortKey: null,
    isArchived: false,
    archivedAt: null,
    href: "#",
    isHidden: false,
    environment: null,
    host: null,
    createdAt: at,
    updatedAt: at,
    lastReadAt: null,
    latestAttentionAt: at,
  };
}

export function sampleView(now: number): InboxView {
  return {
    decision: [
      sampleThread("s1", "Fix the login flow", "sample-web", "waiting-for-input", now - 5 * MINUTE),
      sampleThread("s2", "Review PR #12", "sample-api", "waiting-for-input", now - 20 * MINUTE),
    ],
    failed: [
      sampleThread("s3", "Database migration", "sample-api", "unread-error", now - 12 * MINUTE),
    ],
    working: [
      sampleThread("s4", "Router refactor", "sample-web", "runtime", now),
      sampleThread("s5", "Payment tests", "sample-api", "runtime", now),
    ],
    done: [
      sampleThread("s6", "Update the README", "sample-web", "unread-success", now - 40 * MINUTE),
    ],
  };
}

export function emptySampleView(now: number): InboxView {
  return { ...sampleView(now), decision: [], failed: [], done: [] };
}

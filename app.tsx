// bb-plugin-waiting-on-you — a "Needs you" block pinned above the sidebar thread list,
// whichever list is active, its settings page, and two keyboard commands.
//
// bb has no slot above the thread list, so an app overlay (which keeps the
// SDK's React context) portals the block into a host node placed right
// before the sidebar's scroll area. If bb changes that markup, the block
// simply doesn't show; nothing else breaks.
import "./app.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  definePluginApp,
  experimental_usePluginId as usePluginId,
  experimental_useSidebarThreads as useSidebarThreads,
  useBbContext,
  useBbNavigate,
} from "@get-bb/plugin-sdk/app";
import {
  InboxBlock,
  orderNeeds,
  projectNameMap,
} from "@/components/inbox-block";
import { SettingsPage } from "@/components/settings-page";
import { useInboxSettings, useNow, useQuestionTimes } from "@/hooks/use-inbox";
import {
  isMac,
  isModHeld,
  useCommandHints,
  useHeldKeys,
} from "@/hooks/use-keyboard-hints";
import {
  canToggleCollapsed,
  hasNextThread,
  openNextThread,
  pickNextThread,
  setCommandTarget,
  toggleCollapsed,
} from "@/lib/command-bridge";
import { buildInbox } from "@/lib/inbox";
import {
  COMMAND_IDS,
  formatKeys,
  jumpKeys,
  jumpNumber,
  NEXT_THREAD_SHORTCUT,
  sameKeys,
} from "@/lib/shortcuts";

/** The scroll area that holds the thread list inside the app sidebar. */
const SIDEBAR_LIST_SELECTOR =
  '[data-testid="app-sidebar-body"] > [data-sidebar="content"]';

/**
 * Keeps one host node right before the sidebar list and returns it. The
 * sidebar remounts (collapse, mobile drawer), so an observer re-places the
 * node whenever it goes missing.
 */
function useSidebarHost(): HTMLElement | null {
  const pluginId = usePluginId();
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const node = document.createElement("div");
    // bb scopes plugin CSS to [data-bb-plugin=<id>]. Outside that scope only
    // classes bb itself also uses would apply, so colors and dots vanish.
    node.setAttribute("data-bb-plugin", pluginId);
    node.className = "shrink-0";
    const place = () => {
      // Cheap check first: the observer fires on every DOM change.
      const next = node.nextElementSibling;
      if (
        node.isConnected &&
        next !== null &&
        next.matches(SIDEBAR_LIST_SELECTOR)
      ) {
        return;
      }
      const list = document.querySelector(SIDEBAR_LIST_SELECTOR);
      if (list === null) node.remove();
      else list.parentElement?.insertBefore(node, list);
    };
    place();
    setHost(node);
    const observer = new MutationObserver(place);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      node.remove();
    };
  }, [pluginId]);
  return host;
}

/** Folded or not, remembered per window like bb's own collapsed groups. */
function useCollapsed(pluginId: string) {
  const key = `bb-plugin-${pluginId}:collapsed`;
  const [collapsed, setCollapsed] = useState(
    () => window.localStorage.getItem(key) === "1",
  );
  const toggle = useCallback(() => {
    setCollapsed((previous) => {
      window.localStorage.setItem(key, previous ? "0" : "1");
      return !previous;
    });
  }, [key]);
  return [collapsed, toggle] as const;
}

/**
 * Always mounted (unlike the portal, which needs the sidebar), so the
 * keyboard commands keep working while the sidebar is hidden.
 */
function InboxOverlay() {
  const pluginId = usePluginId();
  const host = useSidebarHost();
  const { status, threads, projects } = useSidebarThreads();
  const { settings, isLoaded } = useInboxSettings();
  const { threadId: activeThreadId, projectId } = useBbContext();
  const navigate = useBbNavigate();
  const now = useNow();
  const [collapsed, toggleCollapsed] = useCollapsed(pluginId);
  const [showAll, setShowAll] = useState(false);
  const heldKeys = useHeldKeys();
  const modifierHeld = isModHeld(heldKeys);
  const commandHints = useCommandHints(pluginId, modifierHeld);
  const jumpCombo = jumpKeys(settings.jumpModifier, isMac());
  const jumpHeld = jumpCombo !== null && sameKeys(heldKeys, jumpCombo);

  const scopedThreads = useMemo(
    () =>
      settings.currentProjectOnly && projectId !== null
        ? threads.filter((thread) => thread.projectId === projectId)
        : threads,
    [threads, settings.currentProjectOnly, projectId],
  );
  const view = useMemo(() => buildInbox(scopedThreads), [scopedThreads]);
  const questionTimes = useQuestionTimes(view.decision);
  const projectNames = useMemo(() => projectNameMap(projects), [projects]);
  const threadIds = useMemo(
    () =>
      orderNeeds(settings, view, questionTimes).map(({ thread }) => thread.id),
    [settings, view, questionTimes],
  );

  // The rows on screen, in order: what the numbered jump keys can reach.
  const isCut = settings.maxItems > 0 && threadIds.length > settings.maxItems;
  const folded = settings.collapsible && collapsed && threadIds.length > 0;
  const visibleIds = useMemo(
    () =>
      folded
        ? []
        : isCut && !showAll
          ? threadIds.slice(0, settings.maxItems)
          : threadIds,
    [folded, isCut, showAll, threadIds, settings.maxItems],
  );
  // Once the list fits again, the next overflow starts cut, not expanded.
  useEffect(() => {
    if (!isCut) setShowAll(false);
  }, [isCut]);

  useEffect(() => {
    setCommandTarget({
      threadIds,
      activeThreadId,
      open: (threadId) => navigate.toThread(threadId),
      toggleCollapsed,
      canCollapse: settings.collapsible && threadIds.length > 0,
    });
  }, [threadIds, activeThreadId, navigate, toggleCollapsed, settings.collapsible]);
  useEffect(() => () => setCommandTarget(null), []);

  // Modifier + 1–9 opens that thread of the block. Captured before bb's own
  // handlers so the press doesn't also do something else.
  useEffect(() => {
    if (settings.jumpModifier === "off") return;
    const mac = isMac();
    const onKeyDown = (event: KeyboardEvent) => {
      // AltGr reports as Ctrl+Alt on Windows and types { [ ] on many
      // layouts; it is never a jump.
      if (event.getModifierState?.("AltGraph")) return;
      const number = jumpNumber(event, settings.jumpModifier, mac);
      if (number === null) return;
      // Inside a text field only a ⌘ combo is safe to take: ⌥, ⌃⌥ and
      // Windows Ctrl+Alt + digit all type characters on some layout.
      const combo = jumpKeys(settings.jumpModifier, mac);
      const typesText = combo === null || !combo.meta;
      const target = event.target as HTMLElement | null;
      if (typesText && target?.closest("input, textarea, [contenteditable]")) return;
      // Only rows on screen have a number, so only those can be opened.
      const threadId = visibleIds[number - 1];
      if (threadId === undefined) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      navigate.toThread(threadId);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [settings.jumpModifier, visibleIds, navigate]);

  const hintsOn = settings.keyHints && commandHints.enabled;
  const keyHints =
    hintsOn && jumpHeld && jumpCombo !== null
      ? {
          nextThreadId: null,
          nextThread: null,
          toggleList: null,
          jumpPrefix: formatKeys(jumpCombo, isMac()),
        }
      : hintsOn && modifierHeld
        ? {
            nextThreadId: pickNextThread(threadIds, activeThreadId),
            nextThread: commandHints.nextThread,
            toggleList: commandHints.toggleList,
            jumpPrefix: null,
          }
        : null;

  // Wait for settings too, so the block doesn't flash default styling.
  if (host === null || status !== "ready" || !isLoaded) return null;
  return createPortal(
    <InboxBlock
      settings={settings}
      view={view}
      questionTimes={questionTimes}
      projectNames={projectNames}
      activeThreadId={activeThreadId}
      now={now}
      collapsed={collapsed}
      onToggleCollapsed={toggleCollapsed}
      showAll={showAll}
      onToggleShowAll={() => setShowAll((value) => !value)}
      keyHints={keyHints}
    />,
    host,
  );
}

export default definePluginApp((app) => {
  app.slots.experimental_appOverlay({
    id: "needs-you-block",
    component: InboxOverlay,
  });
  app.slots.settingsSection({
    id: "settings",
    component: SettingsPage,
  });
  app.commands.register({
    id: COMMAND_IDS.nextThread,
    title: "Waiting On You: open the next thread that needs you",
    defaultShortcut: NEXT_THREAD_SHORTCUT,
    isAvailable: hasNextThread,
    run: openNextThread,
  });
  app.commands.register({
    id: COMMAND_IDS.toggleList,
    title: "Waiting On You: show or hide the list",
    isAvailable: canToggleCollapsed,
    run: toggleCollapsed,
  });
});

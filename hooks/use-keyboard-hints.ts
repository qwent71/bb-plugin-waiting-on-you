// Keyboard hints like bb's own: while a modifier is held, show the keys that
// act on the block. Bindings come from bb's keyboard settings, so a
// rebound key shows as rebound, and bb's "show keyboard hints" switch is
// respected.
import { useEffect, useRef, useState } from "react";
import { useSdk, type PluginCommandShortcut } from "@get-bb/plugin-sdk/app";
import {
  COMMAND_IDS,
  formatShortcut,
  keybindingCommand,
  NEXT_THREAD_SHORTCUT,
  NO_KEYS,
  sameKeys,
  type HeldKeys,
} from "@/lib/shortcuts";

export const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);

/** The modifier keys currently held down, kept current from key events. */
export function useHeldKeys(): HeldKeys {
  const [held, setHeld] = useState<HeldKeys>(NO_KEYS);
  useEffect(() => {
    const read = (event: KeyboardEvent | PointerEvent) => {
      const next = {
        meta: event.metaKey,
        control: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
      };
      setHeld((previous) => (sameKeys(previous, next) ? previous : next));
    };
    // A held key can be released while another window has focus.
    const release = () => setHeld(NO_KEYS);
    window.addEventListener("keydown", read, true);
    window.addEventListener("keyup", read, true);
    // A key released inside a webview or taken by macOS (⇧⌘4) never sends
    // keyup here; the next pointer event still carries the true state.
    window.addEventListener("pointermove", read, true);
    window.addEventListener("pointerdown", read, true);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", release);
    return () => {
      window.removeEventListener("keydown", read, true);
      window.removeEventListener("keyup", read, true);
      window.removeEventListener("pointermove", read, true);
      window.removeEventListener("pointerdown", read, true);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", release);
    };
  }, []);
  return held;
}

/** True while ⌘ (macOS) or Ctrl (elsewhere) is held, like bb's hints. */
export function isModHeld(keys: HeldKeys): boolean {
  return isMac() ? keys.meta : keys.control;
}

export interface CommandHints {
  /** bb's "show keyboard hints" setting. */
  enabled: boolean;
  /**
   * The bb command already bound to these modifiers plus a digit, if any,
   * so the settings page can warn before the two fight over a key.
   */
  takenBy: (keys: HeldKeys) => string | null;
  /** Labels such as "⌘⇧J"; null when the command has no key. */
  nextThread: string | null;
  toggleList: string | null;
}

interface KeybindingEntry {
  command: string;
  shortcut: PluginCommandShortcut | null;
  when?: { all?: readonly string[] };
}

/** Skips bindings bb scopes to another platform. */
function onThisPlatform(entry: KeybindingEntry): boolean {
  const all = entry.when?.all ?? [];
  const mac = isMac();
  if (all.includes("macPlatform") && !mac) return false;
  if ((all.includes("windowsPlatform") || all.includes("linuxPlatform")) && mac) {
    return false;
  }
  return true;
}

const REFRESH_MS = 15_000;

/** A bb shortcut's modifiers as held keys, resolving "mod" per platform. */
function toHeldKeys(shortcut: PluginCommandShortcut): HeldKeys {
  const mac = isMac();
  return {
    meta: shortcut.meta === true || (mac && shortcut.mod === true),
    control: shortcut.control === true || (!mac && shortcut.mod === true),
    alt: shortcut.alt === true,
    shift: shortcut.shift === true,
  };
}

/**
 * The current keys for this plugin's commands. Re-read at most every
 * 15 seconds while hints are wanted, so a rebind shows up without a reload.
 */
export function useCommandHints(pluginId: string, wanted: boolean): CommandHints {
  const sdk = useSdk();
  const [hints, setHints] = useState<CommandHints>({
    enabled: true,
    takenBy: () => null,
    nextThread: formatShortcut(NEXT_THREAD_SHORTCUT),
    toggleList: null,
  });
  const lastFetch = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    // Read once on mount so the first hint is right, then refresh on demand.
    const stale = Date.now() - lastFetch.current >= REFRESH_MS;
    if (lastFetch.current !== 0 && !(wanted && stale)) return;
    lastFetch.current = Date.now();
    sdk.system
      .config()
      .then((config) => {
        // Releasing the key must not drop the answer; only unmounting does.
        if (!mounted.current) return;
        const entries = (config.keybindings as readonly KeybindingEntry[]).filter(
          onThisPlatform,
        );
        const find = (commandId: string) =>
          entries.find(
            (entry) => entry.command === keybindingCommand(pluginId, commandId),
          );
        // When bb lists plugin bindings at all, a missing one is unbound;
        // otherwise fall back to the default we registered.
        const listsPlugins = entries.some((entry) =>
          entry.command.startsWith("plugin:"),
        );
        const label = (commandId: string, fallback: PluginCommandShortcut | null) => {
          const entry = find(commandId);
          if (entry !== undefined) {
            return entry.shortcut === null ? null : formatShortcut(entry.shortcut);
          }
          return listsPlugins || fallback === null ? null : formatShortcut(fallback);
        };
        const digitBindings = entries.filter(
          (entry): entry is KeybindingEntry & { shortcut: PluginCommandShortcut } =>
            entry.shortcut !== null && /^[1-9]$/.test(entry.shortcut.key) &&
            entry.command !== keybindingCommand(pluginId, COMMAND_IDS.nextThread),
        );
        const takenBy = (keys: HeldKeys) => {
          const hit = digitBindings.find((entry) =>
            sameKeys(toHeldKeys(entry.shortcut), keys),
          );
          return hit === undefined ? null : hit.command;
        };
        setHints({
          enabled: config.generalSettings.showKeyboardHints,
          takenBy,
          nextThread: label(COMMAND_IDS.nextThread, NEXT_THREAD_SHORTCUT),
          toggleList: label(COMMAND_IDS.toggleList, null),
        });
      })
      .catch(() => {
        // Keep the last known hints; a missed refresh is harmless.
      });
  }, [sdk, pluginId, wanted]);

  return hints;
}

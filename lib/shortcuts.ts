// The default binding for "open the next thread that needs you". bb owns the
// live binding: users rebind it in Settings → Keyboard, and a default that
// clashes with another command stays unbound.
import type { PluginCommandShortcut } from "@get-bb/plugin-sdk/app";
import type { JumpModifier } from "./settings.ts";

export const NEXT_THREAD_SHORTCUT: PluginCommandShortcut = {
  key: "j",
  mod: true,
  shift: true,
};

/** "⌘⇧J" on macOS, "Ctrl+Shift+J" elsewhere. */
export function formatShortcut(shortcut: PluginCommandShortcut): string {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  const key = shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key;
  if (mac) {
    return [
      shortcut.control ? "⌃" : "",
      shortcut.alt ? "⌥" : "",
      shortcut.shift ? "⇧" : "",
      shortcut.mod || shortcut.meta ? "⌘" : "",
      key,
    ].join("");
  }
  return [
    shortcut.mod || shortcut.control ? "Ctrl" : "",
    shortcut.meta ? "Win" : "",
    shortcut.alt ? "Alt" : "",
    shortcut.shift ? "Shift" : "",
    key,
  ]
    .filter((part) => part !== "")
    .join("+");
}

/** Command ids as bb's keyboard settings know them. */
export const COMMAND_IDS = {
  nextThread: "next-thread",
  toggleList: "toggle-list",
} as const;

export function keybindingCommand(pluginId: string, commandId: string): string {
  return `plugin:${pluginId}/${commandId}`;
}

/** Which modifier keys are down, as a keyboard event reports them. */
export interface HeldKeys {
  meta: boolean;
  control: boolean;
  alt: boolean;
  shift: boolean;
}

export const NO_KEYS: HeldKeys = { meta: false, control: false, alt: false, shift: false };

/** The exact modifiers a jump setting asks for on this platform. */
export function jumpKeys(modifier: JumpModifier, mac: boolean): HeldKeys | null {
  // "mod" is ⌘ on macOS and Ctrl elsewhere, like bb's own shortcuts.
  const mod = mac ? { meta: true } : { control: true };
  switch (modifier) {
    case "off":
      return null;
    case "mod-alt":
      return { ...NO_KEYS, ...mod, alt: true };
    case "mod-shift":
      return { ...NO_KEYS, ...mod, shift: true };
    case "control":
      return { ...NO_KEYS, control: true };
    case "control-alt":
      return { ...NO_KEYS, control: true, alt: true };
    case "alt":
      return { ...NO_KEYS, alt: true };
  }
}

export function sameKeys(a: HeldKeys, b: HeldKeys): boolean {
  return (
    a.meta === b.meta &&
    a.control === b.control &&
    a.alt === b.alt &&
    a.shift === b.shift
  );
}

/** "⌥⌘" on macOS, "Ctrl+Alt" elsewhere; "" for no modifier. */
export function formatKeys(keys: HeldKeys, mac: boolean): string {
  if (mac) {
    return [
      keys.control ? "⌃" : "",
      keys.alt ? "⌥" : "",
      keys.shift ? "⇧" : "",
      keys.meta ? "⌘" : "",
    ].join("");
  }
  return [
    keys.control ? "Ctrl" : "",
    keys.meta ? "Win" : "",
    keys.alt ? "Alt" : "",
    keys.shift ? "Shift" : "",
  ]
    .filter((part) => part !== "")
    .map((part) => `${part}+`)
    .join("");
}

/**
 * The number 1–9 a key press asks for under the jump setting, or null.
 * Reads the physical key, because ⌥ turns "1" into "¡" on macOS.
 */
export function jumpNumber(
  event: Pick<KeyboardEvent, "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">,
  modifier: JumpModifier,
  mac: boolean,
): number | null {
  const wanted = jumpKeys(modifier, mac);
  if (wanted === null) return null;
  const match = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
  if (match === null) return null;
  const held = {
    meta: event.metaKey,
    control: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
  };
  return sameKeys(held, wanted) ? Number(match[1]) : null;
}

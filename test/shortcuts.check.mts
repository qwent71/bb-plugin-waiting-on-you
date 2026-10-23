// Smoke check for jump-by-number keys: node test/shortcuts.check.mts
import assert from "node:assert/strict";
import { formatKeys, jumpKeys, jumpNumber } from "../lib/shortcuts.ts";

const press = (code: string, keys: { meta?: boolean; ctrl?: boolean; alt?: boolean; shift?: boolean }) => ({
  code,
  metaKey: keys.meta ?? false,
  ctrlKey: keys.ctrl ?? false,
  altKey: keys.alt ?? false,
  shiftKey: keys.shift ?? false,
});

// macOS: "mod" is ⌘.
assert.equal(jumpNumber(press("Digit3", { meta: true, alt: true }), "mod-alt", true), 3);
assert.equal(jumpNumber(press("Numpad7", { meta: true, alt: true }), "mod-alt", true), 7);
assert.equal(jumpNumber(press("Digit3", { meta: true }), "mod-alt", true), null, "⌘3 alone is bb's");
assert.equal(jumpNumber(press("Digit3", { meta: true, alt: true, shift: true }), "mod-alt", true), null, "extra keys don't match");
assert.equal(jumpNumber(press("Digit0", { meta: true, alt: true }), "mod-alt", true), null, "0 is not a row");
assert.equal(jumpNumber(press("KeyA", { meta: true, alt: true }), "mod-alt", true), null);
assert.equal(jumpNumber(press("Digit1", { ctrl: true }), "control", true), 1);
assert.equal(jumpNumber(press("Digit1", { meta: true, alt: true }), "off", true), null);
// Elsewhere: "mod" is Ctrl.
assert.equal(jumpNumber(press("Digit2", { ctrl: true, shift: true }), "mod-shift", false), 2);
assert.equal(jumpNumber(press("Digit2", { meta: true, shift: true }), "mod-shift", false), null);

assert.equal(formatKeys(jumpKeys("mod-alt", true)!, true), "⌥⌘");
assert.equal(formatKeys(jumpKeys("control-alt", true)!, true), "⌃⌥");
assert.equal(formatKeys(jumpKeys("mod-alt", false)!, false), "Ctrl+Alt+");
assert.equal(jumpKeys("off", true), null);
console.log("jump keys: ok");

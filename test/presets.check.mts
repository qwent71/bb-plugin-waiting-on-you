// Smoke check for presets and the "next thread" command: node test/presets.check.mts
import assert from "node:assert/strict";
import { matchPreset, PRESETS } from "../lib/presets.ts";
import { GROUP_FIELDS, GROUP_PRESETS, matchGroupPreset } from "../lib/group-presets.ts";
import {
  applyPatch,
  DEFAULT_SETTINGS,
  parseSettings,
  rowLayoutOf,
  rowLayoutPatch,
} from "../lib/settings.ts";
import {
  hasNextThread,
  openNextThread,
  pickNextThread,
  setCommandTarget,
} from "../lib/command-bridge.ts";

assert.equal(matchPreset(DEFAULT_SETTINGS)?.id, "default", "defaults are the Default preset");
for (const preset of PRESETS) {
  const applied = { ...DEFAULT_SETTINGS, ...preset.fields };
  assert.deepEqual(parseSettings(applied), applied, `${preset.id} uses only valid values`);
  assert.equal(matchPreset(applied)?.id, preset.id, `${preset.id} is recognised`);
  // Colors, texts, and behavior are not part of a preset.
  const custom = { ...applied, title: "Mine", currentProjectOnly: true };
  assert.equal(matchPreset(custom)?.id, preset.id, `${preset.id} ignores texts and behavior`);
}
assert.equal(matchPreset({ ...DEFAULT_SETTINGS, density: "compact" }), null, "a manual change is Custom");

// Row layout: presets pick one, and the switch maps both ways.
assert.equal(rowLayoutOf(DEFAULT_SETTINGS), "one-line");
for (const preset of PRESETS) {
  const layout = rowLayoutOf({ ...DEFAULT_SETTINGS, ...preset.fields });
  assert.equal(layout, preset.id === "detailed" ? "two-lines" : "one-line", `${preset.id} layout`);
}
const timeBelow = { ...DEFAULT_SETTINGS, timePlace: "below" as const };
assert.equal(rowLayoutOf(timeBelow), "two-lines", "time under the title is a second line");
assert.equal(rowLayoutOf({ ...DEFAULT_SETTINGS, titleWrap: "wrap" }), "custom", "wrapped titles are custom");
const flattened = { ...timeBelow, ...rowLayoutPatch("one-line", timeBelow) };
assert.equal(rowLayoutOf(flattened), "one-line");
assert.equal(flattened.timePlace, "end");
const stacked = { ...DEFAULT_SETTINGS, ...rowLayoutPatch("two-lines", DEFAULT_SETTINGS) };
assert.equal(rowLayoutOf(stacked), "two-lines");
const hidden = { ...DEFAULT_SETTINGS, projectPlace: "off" as const };
assert.equal({ ...hidden, ...rowLayoutPatch("two-lines", hidden) }.projectPlace, "off", "a hidden project stays hidden");

const opened: string[] = [];
const target = (activeThreadId: string | null, threadIds: string[]) => ({
  threadIds,
  activeThreadId,
  open: (id: string) => opened.push(id),
  toggleCollapsed() {},
  canCollapse: true,
});
setCommandTarget(null);
assert.equal(hasNextThread(), false);
setCommandTarget(target(null, ["a", "b", "c"]));
openNextThread();
setCommandTarget(target("a", ["a", "b", "c"]));
openNextThread();
setCommandTarget(target("c", ["a", "b", "c"]));
openNextThread();
setCommandTarget(target("x", ["a", "b"]));
openNextThread();
assert.deepEqual(opened, ["a", "b", "a", "a"], "first, next, wrap, outsider starts over");
setCommandTarget(target(null, []));
assert.equal(hasNextThread(), false);
assert.equal(pickNextThread([], null), null);
assert.equal(pickNextThread(["a", "b"], "b"), "a");
// Quick picks: each is valid, recognised, stays inside its group, and the
// defaults land on one pick in every group.
for (const [group, picks] of Object.entries(GROUP_PRESETS) as [keyof typeof GROUP_PRESETS, (typeof GROUP_PRESETS)["rows"]][]) {
  assert.notEqual(matchGroupPreset(group, DEFAULT_SETTINGS), null, `defaults match a ${group} pick`);
  const ids = new Set<string>();
  for (const pick of picks) {
    assert.ok(!ids.has(pick.id), `${group}/${pick.id} is unique`);
    ids.add(pick.id);
    const applied = applyPatch(DEFAULT_SETTINGS, pick.patch);
    assert.deepEqual(parseSettings(applied), applied, `${group}/${pick.id} uses only valid values`);
    assert.equal(matchGroupPreset(group, applied)?.id, pick.id, `${group}/${pick.id} is recognised`);
    if (group !== "colors") {
      const owned = new Set(GROUP_FIELDS[group]);
      for (const key of Object.keys(pick.patch)) {
        assert.ok(owned.has(key as never), `${group}/${pick.id} only sets its group's fields (${key})`);
      }
    } else {
      assert.deepEqual(Object.keys(pick.patch), ["categories"], `colors/${pick.id} only sets colors`);
    }
  }
}
assert.equal(
  matchGroupPreset("rows", { ...DEFAULT_SETTINGS, density: "compact" }),
  null,
  "a hand-tuned group is custom",
);
console.log("presets and shortcut: ok");

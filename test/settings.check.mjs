// Smoke check for the settings RPC against the built server bundle:
//   bb plugin build && node test/settings.check.mjs
import assert from "node:assert/strict";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin from "../dist/server.js";

const { bb, harness } = createFakePluginHost({ pluginId: "inbox" });
await plugin(bb);
const call = (method, input = null) => harness.behavior.callRpc(method, input);

const initial = await call("settings_get");
assert.equal(initial.title, "Needs you");
assert.equal(initial.rowMarker, "dot");
assert.equal(initial.categories.decision.color, "amber");

// Top-level patch keeps unrelated fields.
const updated = await call("settings_update", { rowMarker: "icon", showDone: true });
assert.equal(updated.rowMarker, "icon");
assert.equal(updated.showDone, true);
assert.equal(updated.title, "Needs you");
assert.deepEqual(await call("settings_get"), updated, "patch persists");

// Category patch touches one field of one category only.
const recolored = await call("settings_update", { categories: { failed: { color: "violet" } } });
assert.equal(recolored.categories.failed.color, "violet");
assert.equal(recolored.categories.failed.icon, "CircleX");
assert.equal(recolored.categories.decision.color, "amber");

await assert.rejects(call("settings_update", { maxHeight: 200 }), "out of range");
await assert.rejects(call("settings_update", { title: "   " }), "blank title");
await assert.rejects(call("settings_update", { categories: { done: { icon: "Nope" } } }), "unknown icon");
await assert.rejects(call("settings_update", { categories: { done: { color: "pink" } } }), "unknown color");
await assert.rejects(call("settings_update", { categories: { done: { label: "x".repeat(17) } } }), "long label");
assert.equal((await call("settings_get")).maxHeight, 40, "bad writes change nothing");

// A stale stored value falls back field by field.
await bb.storage.kv.set("settings", { rowMarker: "neon", title: "My block", categories: { done: { color: "pink", label: "ok" } } });
const healed = await call("settings_get");
assert.equal(healed.rowMarker, "dot");
assert.equal(healed.title, "My block");
assert.equal(healed.categories.done.color, "sky");
assert.equal(healed.categories.done.label, "ok");

// Settings saved by older versions.
await bb.storage.kv.set("settings", {
  headerCounts: false,
  showWorking: true,
  rowStyle: "tint",
  showTime: false,
  showProject: false,
});
const migrated = await call("settings_get");
assert.equal(migrated.countDecision, false);
assert.equal(migrated.countFailed, false);
assert.equal(migrated.countWorking, true);
assert.equal(migrated.rowMarker, "tint");
assert.equal(migrated.timeFormat, "off");
assert.equal(migrated.projectPlace, "off");
for (const old of ["headerCounts", "showWorking", "rowStyle", "showTime", "showProject", "showStatusGlyph"]) {
  assert.equal(old in migrated, false, `${old} is dropped`);
}
await bb.storage.kv.set("settings", { showStatusGlyph: true });
assert.equal((await call("settings_get")).rowMarker, "glyph", "glyph switch becomes the glyph marker");

// Untouched Russian defaults from before the English UI follow the new
// defaults; text the user typed survives.
await bb.storage.kv.set("settings", {
  calmText: "Нигде не нужны",
  categories: { decision: { label: "ответ", color: "rose" }, failed: { label: "сломалось" } },
});
const english = await call("settings_get");
assert.equal(english.calmText, "All clear");
assert.equal(english.categories.decision.label, "reply");
assert.equal(english.categories.decision.color, "rose");
assert.equal(english.categories.failed.label, "сломалось");

// Layout and alignment.
const laidOut = await call("settings_update", {
  tagPlace: "title",
  markerSide: "end",
  timePlace: "below",
  alignColumns: false,
  titleWrap: "wrap",
  counterPlace: "title",
  emptyAlign: "center",
});
assert.equal(laidOut.tagPlace, "title");
assert.equal(laidOut.emptyAlign, "center");
await assert.rejects(call("settings_update", { tagPlace: "middle" }), "unknown tag place");
await assert.rejects(call("settings_update", { emptyAlign: "right" }), "unknown alignment");
const defaults = await call("settings_reset");
assert.equal(defaults.alignColumns, true, "columns line up by default");
assert.equal(defaults.tagPlace, "end");

// Row limit and overflow.
assert.equal((await call("settings_update", { maxItems: 3, overflow: "hidden" })).maxItems, 3);
await assert.rejects(call("settings_update", { maxItems: 51 }), "limit too high");
await assert.rejects(call("settings_update", { maxItems: 2.5 }), "limit not whole");
await assert.rejects(call("settings_update", { overflow: "fade" }), "unknown overflow");

// The empty state's divider starts from the list's and then lives apart.
await bb.storage.kv.set("settings", { separator: false });
const split = await call("settings_get");
assert.equal(split.separator, false);
assert.equal(split.emptySeparator, false);
const apart = await call("settings_update", { emptySeparator: true });
assert.equal(apart.separator, false);
assert.equal(apart.emptySeparator, true);
assert.equal((await call("settings_get")).emptySeparator, true, "stays apart after reload");

// Import: an exported document round-trips; a partial object changes only
// what it lists; bad and unknown fields are skipped by path.
await call("settings_reset");
await call("settings_update", { rowMarker: "tag", categories: { failed: { color: "violet" } } });
const exported = JSON.parse((await harness.behavior.runCli(["export"])).stdout);
assert.equal(exported.format, "bb-plugin-inbox/settings");
assert.equal(exported.settings.rowMarker, "tag");
await call("settings_reset");
const restored = await call("settings_import", exported);
assert.equal(restored.settings.rowMarker, "tag");
assert.equal(restored.settings.categories.failed.color, "violet");
assert.deepEqual(restored.skipped, []);

const partial = await call("settings_import", {
  maxItems: 5,
  rowMarker: "neon",
  wat: 1,
  categories: { done: { color: "rose", icon: "Nope" }, ghost: {} },
});
assert.equal(partial.settings.maxItems, 5);
assert.equal(partial.settings.rowMarker, "tag", "invalid value leaves the setting alone");
assert.equal(partial.settings.categories.done.color, "rose");
assert.deepEqual(partial.applied.sort(), ["categories.done.color", "maxItems"]);
assert.deepEqual(
  partial.skipped.sort(),
  ["categories.done.icon", "categories.ghost", "rowMarker", "wat"],
);
const junk = await call("settings_import", [1, 2]);
assert.deepEqual(junk.applied, []);
assert.equal((await call("settings_get")).maxItems, 5, "junk changes nothing");

// The same from a terminal.
const cliImport = await harness.behavior.runCli(["import", "--json", '{"density":"compact","bogus":true}']);
assert.equal(cliImport.exitCode, 0);
assert.match(cliImport.stdout, /Imported 1 setting/);
assert.match(cliImport.stdout, /Skipped: bogus/);
assert.equal((await call("settings_get")).density, "compact");
const cliBad = await harness.behavior.runCli(["import", "--json", "{nope"]);
assert.notEqual(cliBad.exitCode, 0);
const cliReset = await harness.behavior.runCli(["reset"]);
assert.equal(cliReset.exitCode, 0);
assert.equal((await call("settings_get")).density, "normal");

// Two quick changes at once both stick: writes run one at a time.
await call("settings_reset");
await Promise.all([
  call("settings_update", { showDone: true }),
  call("settings_update", { density: "compact" }),
  call("settings_update", { categories: { failed: { color: "rose" } } }),
]);
const both = await call("settings_get");
assert.equal(both.showDone, true, "first change kept");
assert.equal(both.density, "compact", "second change kept");
assert.equal(both.categories.failed.color, "rose", "third change kept");

// A partial import changes only what it lists.
await call("settings_reset");
const onlyDivider = await call("settings_import", { separator: false });
assert.deepEqual(onlyDivider.applied, ["separator"]);
assert.equal(onlyDivider.settings.emptySeparator, true, "the empty divider is not touched");

const reset = await call("settings_reset");
assert.equal(reset.title, "Needs you");

await harness.lifecycle.dispose();
console.log("settings RPC: ok");

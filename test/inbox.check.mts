// Smoke check for the pure inbox rules: node test/inbox.check.mts
import assert from "node:assert/strict";
import { bucketOf, formatAgo, formatTime } from "../lib/inbox.ts";

const now = Date.UTC(2026, 9, 23, 12, 0);
const min = 60_000;
assert.equal(formatAgo(now - 20_000, now), "just now");
assert.equal(formatAgo(now + 5 * min, now), "just now", "clock skew never reads as future");
assert.equal(formatAgo(now - 5 * min, now), "5 min. ago");
assert.equal(formatAgo(now - 3 * 60 * min, now), "3 hr. ago");
assert.equal(formatAgo(now - 24 * 60 * min, now), "yesterday");
assert.equal(formatTime(now - 5 * min, now, "short"), "5m");
assert.equal(formatTime(now - 3 * 60 * min, now, "short"), "3h");
assert.equal(formatTime(now + 5 * min, now, "short"), "now");
assert.match(formatTime(now - 5 * min, now, "clock"), /^\d{2}:\d{2}$/);
assert.match(formatTime(now - 3 * 24 * 60 * min, now, "clock"), /Oct/);

const base = { hasPendingInteraction: false, indicator: "none", queuedWork: "none", status: "idle" };
const t = (o: object) => ({ ...base, ...o }) as never;
assert.equal(bucketOf(t({ hasPendingInteraction: true, indicator: "unread-error" })), "decision");
assert.equal(bucketOf(t({ indicator: "unread-error" })), "failed");
assert.equal(bucketOf(t({ queuedWork: "failed" })), "failed");
assert.equal(bucketOf(t({ status: "active", indicator: "runtime" })), "working");
assert.equal(bucketOf(t({ indicator: "unread-success" })), "done");
assert.equal(bucketOf(t({})), null);
console.log("inbox rules: ok");

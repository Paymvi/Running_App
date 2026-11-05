import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDuration,
  parseDistance,
  validateActivityForm,
  normalizeStoredActivity,
  computeSplitTotals,
  activityMph,
  buildJarGroups,
} from "../src/utils/activityModel.js";
import { run } from "./helpers.js";

const form = (over = {}) => ({
  id: null, title: "Morning", description: "", type: "run", intensity: "easy", feel: "medium",
  limiter: "", tags: [], date: "2026-10-01", time: "", mode: "timeMiles", miles: "3", duration: "3000",
  splits: [{ mph: "", distance: "" }], notes: "felt good; legs ok", status: "completed", ...over,
});

test("duration formats parse to minutes; invalid ones are rejected (F12)", () => {
  assert.equal(parseDuration("30:30"), 30.5);
  assert.equal(parseDuration("1:02:03"), 62.05);
  assert.equal(parseDuration("45.5"), 45.5);
  assert.equal(parseDuration(45), 45);
  for (const bad of ["5:60", "-3", "abc", "1:2", "Infinity", -1, NaN]) assert.equal(parseDuration(bad), null, String(bad));
  assert.equal(parseDuration(""), null);
  assert.equal(parseDistance("-1"), null);
  assert.equal(parseDistance("3.10"), 3.1);
});

test("valid form saves numeric totals and keeps text verbatim", () => {
  const { errors, activity } = validateActivityForm(form());
  assert.deepEqual(errors, {});
  assert.equal(activity.miles, 3);
  assert.equal(activity.duration, 30);
  assert.equal(activity.notes, "felt good; legs ok");
  assert.deepEqual(activity.splits, []);
});

test("invalid manual entries are rejected with field errors (F03)", () => {
  assert.ok(validateActivityForm(form({ miles: "", duration: "" })).errors.miles);
  assert.ok(validateActivityForm(form({ miles: "-2" })).errors.miles);
  assert.ok(validateActivityForm(form({ duration: "abc" })).errors.duration);
  assert.ok(validateActivityForm(form({ date: "" })).errors.date);
  assert.ok(validateActivityForm(form({ date: "2026-02-31" })).errors.date);
  assert.ok(validateActivityForm(form({ date: "0201-01-01" })).errors.date);
  assert.ok(validateActivityForm(form({ time: "25:00" })).errors.time);
  assert.ok(validateActivityForm(form({ type: "skydive" })).errors.type);
});

test("time-only workouts are valid", () => {
  const { activity } = validateActivityForm(form({ type: "workout", miles: "", duration: "4500" }));
  assert.equal(activity.miles, "");
  assert.equal(activity.duration, 45);
});

test("split totals: miles = sum(distance), minutes = sum(distance / mph * 60) (F02)", () => {
  const { activity } = validateActivityForm(
    form({ mode: "splits", miles: "99", duration: "99", splits: [{ mph: "6", distance: "1" }, { mph: "8", distance: "2" }, { mph: "", distance: "" }] })
  );
  assert.equal(activity.miles, 3);
  assert.equal(activity.duration, 25); // 10 + 15
  assert.deepEqual(activity.splits, [{ mph: 6, distance: 1 }, { mph: 8, distance: 2 }]);
});

test("invalid split rows are rejected", () => {
  assert.ok(validateActivityForm(form({ mode: "splits", splits: [{ mph: "0", distance: "1" }] })).errors.splits);
  assert.ok(validateActivityForm(form({ mode: "splits", splits: [{ mph: "6", distance: "" }] })).errors.splits);
  assert.ok(validateActivityForm(form({ mode: "splits", splits: [{ mph: "", distance: "" }] })).errors.splits);
  assert.deepEqual(computeSplitTotals([{ mph: "x", distance: "1" }]).invalidRows, [0]);
});

test("normalizing legacy records keeps originals and flags what it can't read", () => {
  const a = normalizeStoredActivity({ id: "a", date: "3/5/2026", duration: "30:30", miles: "3", type: "Run" });
  assert.equal(a.date, "2026-03-05");
  assert.equal(a.duration, 30.5);
  assert.equal(a.miles, 3);
  assert.equal(a.type, "run");
  assert.deepEqual(a.legacy, { date: "3/5/2026", duration: "30:30" });
  assert.equal(a.needsReview, undefined);

  const bad = normalizeStoredActivity({ id: "b", date: "2026-02-31", miles: "lots" });
  assert.equal(bad.date, "2026-02-31"); // untouched
  assert.equal(bad.miles, "lots"); // untouched
  assert.deepEqual(bad.needsReview, ["date", "miles"]);

  assert.equal(normalizeStoredActivity(null), null);
  assert.equal(normalizeStoredActivity("x"), null);
  assert.ok(normalizeStoredActivity({ date: "2026-01-01", miles: 1 }).id);
});

test("normalization is idempotent", () => {
  const once = normalizeStoredActivity({ id: "a", date: "3/5/2026", duration: "30:30", miles: "3" });
  assert.deepEqual(normalizeStoredActivity(once), once);
});

test("split-mode records saved without totals get them computed", () => {
  const a = normalizeStoredActivity({ id: "s", date: "2026-01-01", mode: "splits", miles: "", duration: "", splits: [{ mph: "6", distance: "1" }] });
  assert.equal(a.miles, 1);
  assert.equal(a.duration, 10);
});

test("speed is derived from distance and duration (F31)", () => {
  assert.equal(activityMph(run({ miles: 3, duration: 30 })), 6);
  assert.equal(activityMph(run({ miles: "", duration: 30 })), null);
});

test("jar counts at 0, 24, 25, 26, 49 and 50 easy runs (F19)", () => {
  const runs = (n) => Array.from({ length: n }, (_, i) => run({ id: `r${i}`, date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}` }));
  // A full jar moves to history at once, so the current jar is empty at 25 and 50.
  const cases = { 0: [0, 0], 24: [0, 24], 25: [1, 0], 26: [1, 1], 49: [1, 24], 50: [2, 0] };
  for (const [n, [completed, current]] of Object.entries(cases)) {
    const jars = buildJarGroups(runs(Number(n)));
    assert.equal(jars.completed.length, completed, `completed at ${n}`);
    assert.equal(jars.current.length, current, `current at ${n}`);
  }
  // Non-easy and non-run activities never fill jars.
  assert.equal(buildJarGroups([run({ intensity: "tempo" }), run({ type: "bike" })]).groups.length, 0);
});

test("jar balls use activity ids as stable keys, oldest first", () => {
  const jars = buildJarGroups([run({ id: "new", date: "2026-02-01" }), run({ id: "old", date: "2026-01-01" })]);
  assert.deepEqual(jars.current.map((b) => b.key), ["old", "new"]);
});

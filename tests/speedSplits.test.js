import test from "node:test";
import assert from "node:assert/strict";
import {
  activityAverages,
  activityMph,
  activityToForm,
  computeSplitTotals,
  formatDuration,
  normalizeStoredActivity,
  parseDistance,
  parseDuration,
  readDurationInput,
  splitRows,
  validateActivityForm,
} from "../src/utils/activityModel.js";
import { formatSplitsCell, rowsToActivities } from "../src/utils/importHelpers.js";

const form = (over = {}) => ({
  type: "run", intensity: "easy", feel: "medium", status: "completed", date: "2026-10-01", time: "",
  mode: "timeMiles", miles: "", duration: "", splits: [{ mph: "", distance: "" }], tags: [], notes: "", ...over,
});
const save = (over, opts) => {
  const { errors, activity } = validateActivityForm(form(over), opts);
  assert.deepEqual(errors, {});
  return activity;
};
const reopenAndSave = (stored, opts, change = (f) => f) =>
  save(change(activityToForm(normalizeStoredActivity(JSON.parse(JSON.stringify(stored))), opts.unit)), {
    ...opts,
    original: normalizeStoredActivity(JSON.parse(JSON.stringify(stored))),
  });

test("3 miles in 30:00 is 6 mph and 10:00 /mi", () => {
  const a = save({ miles: "3", duration: "3000" });
  assert.equal(activityMph(a), 6);
  assert.deepEqual(activityAverages(a), { speed: "6.0 mph", pace: "10:00 /mi" });
});

test("10 miles in 1:15:00 is 8 mph and 7:30 /mi", () => {
  for (const typed of ["11500", "7500"]) {
    const a = save({ miles: "10", duration: typed });
    assert.equal(a.duration, 75);
    assert.equal(formatDuration(a.duration), "1:15:00");
    assert.deepEqual(activityAverages(a), { speed: "8.0 mph", pace: "7:30 /mi" });
  }
});

test("kilometers show km/h and per-km pace from the same stored miles", () => {
  const a = { miles: 10, duration: 75 };
  assert.deepEqual(activityAverages(a, "km"), { speed: "12.9 km/h", pace: "4:40 /km" });
  const typedKm = save({ miles: "10", duration: "5000" }, { unit: "km" });
  assert.deepEqual(activityAverages(typedKm, "km"), { speed: "12.0 km/h", pace: "5:00 /km" });
  assert.deepEqual(activityAverages(typedKm, "mi"), { speed: "7.5 mph", pace: "8:03 /mi" });
});

test("no averages without both a real distance and a real time", () => {
  for (const a of [{}, { miles: 3 }, { duration: 30 }, { miles: 0, duration: 30 }, { miles: 3, duration: 0 }, { miles: "abc", duration: 30 }, { miles: 3, duration: "bad" }]) {
    assert.equal(activityAverages(a), null, JSON.stringify(a));
  }
});

test("numbers too large to represent are invalid, not Infinity", () => {
  const huge = "9".repeat(400);
  assert.equal(parseDistance(huge), null);
  assert.equal(parseDuration(huge), null);
  assert.equal(parseDuration(`${huge}:00`), null);
  assert.ok(validateActivityForm(form({ miles: huge, duration: "3000" })).errors.miles);
  assert.ok(validateActivityForm(form({ mode: "splits", splits: [{ mph: "6", distance: huge }] })).errors.splits);
  assert.ok(readDurationInput(huge, { duration: 700 }).error); // long records get extra digits, not unlimited ones
});

test("split rows separate each split's time from cumulative elapsed time", () => {
  const rows = splitRows([{ mph: 6, distance: 1 }, { mph: 8, distance: 2 }, { mph: 6, distance: 0.5 }]);
  assert.deepEqual(rows.map((r) => formatDuration(r.minutes)), ["10:00", "15:00", "05:00"]);
  assert.deepEqual(rows.map((r) => formatDuration(r.elapsed)), ["10:00", "25:00", "30:00"]);
  // A final partial split keeps its own distance; its pace is not distorted by being short.
  assert.equal(activityAverages({ miles: rows[2].distance, duration: rows[2].minutes }).pace, "10:00 /mi");
});

test("split rows line up with the form: blank and invalid rows are null, never NaN", () => {
  const rows = splitRows([{ mph: "", distance: "" }, { mph: "6", distance: "1" }, { mph: "0", distance: "1" }, { mph: "x", distance: "1" }, null]);
  assert.deepEqual(rows.map(Boolean), [false, true, false, false, false]);
  assert.deepEqual(splitRows(undefined), []);
  assert.deepEqual(splitRows(null), []);
});

test("the last elapsed time always equals the saved activity time", () => {
  for (let i = 1; i <= 400; i += 1) {
    const splits = [{ mph: 6 + i / 100, distance: 1 }, { mph: 7.3, distance: 1.37 }];
    const a = save({ mode: "splits", splits });
    assert.equal(formatDuration(splitRows(a.splits).at(-1).elapsed), formatDuration(a.duration), String(i));
  }
});

test("split errors name the row the user sees, skipping nothing", () => {
  const { errors } = validateActivityForm(form({ mode: "splits", splits: [{ mph: "", distance: "" }, { mph: "6", distance: "" }] }));
  assert.match(errors.splits, /^Split 2:/);
});

test("blank split rows are dropped on save", () => {
  const a = save({ mode: "splits", splits: [{ mph: "", distance: "" }, { mph: "6", distance: "1" }, { mph: "", distance: "" }] });
  assert.deepEqual(a.splits, [{ mph: 6, distance: 1 }]);
});

test("editing and reopening a split activity recalculates and persists, in either unit", () => {
  const first = save({ mode: "splits", splits: [{ mph: "6", distance: "1" }, { mph: "8", distance: "2" }] });
  assert.equal(first.miles, 3);
  assert.equal(first.duration, 25);

  // Untouched: stored values come back exactly.
  assert.deepEqual(reopenAndSave(first, { unit: "km" }).splits, first.splits);

  // Change one, remove one.
  const edited = reopenAndSave(first, { unit: "mi" }, (f) => ({ ...f, splits: [{ ...f.splits[1], mph: "6" }] }));
  assert.deepEqual(edited.splits, [{ mph: 6, distance: 2 }]);
  assert.equal(edited.miles, 2);
  assert.equal(edited.duration, 20);
  assert.equal(activityToForm(edited).duration, "2000");
});

test("km splits round-trip through stored miles", () => {
  const a = save({ mode: "splits", splits: [{ mph: "10", distance: "5" }] }, { unit: "km" });
  assert.equal(formatDuration(a.duration), "30:00");
  assert.deepEqual(activityToForm(a, "km").splits, [{ mph: "10", distance: "5" }]);
  assert.deepEqual(activityAverages(a, "km"), { speed: "10.0 km/h", pace: "6:00 /km" });
});

test("editing a time entry recalculates speed and survives a reopen", () => {
  const first = save({ miles: "10", duration: "11500" });
  const edited = reopenAndSave(first, { unit: "mi" }, (f) => ({ ...f, duration: "10000" }));
  assert.equal(activityMph(edited), 10);
  assert.equal(activityToForm(edited).duration, "10000");
  assert.equal(activityToForm(edited).miles, "10");
});

test("switching a split activity to Distance + Time keeps totals and clears splits", () => {
  const first = save({ mode: "splits", splits: [{ mph: "6", distance: "1" }] });
  const a = reopenAndSave(first, { unit: "mi" }, (f) => ({ ...f, mode: "timeMiles" }));
  assert.equal(a.mode, "timeMiles");
  assert.equal(a.miles, 1);
  assert.equal(a.duration, 10);
  assert.deepEqual(a.splits, []);
});

test("distance-only entries save with no time and no averages", () => {
  const a = save({ miles: "3" });
  assert.equal(a.miles, 3);
  assert.equal(a.duration, "");
  assert.equal(activityAverages(a), null);
  assert.equal(activityToForm(a).duration, "");
});

test("incomplete or invalid time blocks the save with a clear message", () => {
  assert.ok(validateActivityForm(form({ miles: "3", duration: "145" })).errors.duration);
  assert.ok(validateActivityForm(form({ miles: "3", duration: "2599" })).errors.duration);
  assert.ok(validateActivityForm(form({ miles: "abc", duration: "3000" })).errors.miles);
  assert.ok(validateActivityForm(form()).errors.miles); // nothing entered, not Strength
});

test("Strength needs no distance, time or splits, on either tab", () => {
  for (const mode of ["timeMiles", "splits"]) {
    const a = save({ type: "strength", mode });
    assert.equal(a.mode, "timeMiles");
    assert.equal(a.miles, "");
    assert.equal(a.duration, "");
    assert.deepEqual(a.splits, []);
  }
  // A half-typed split is still a mistake worth flagging.
  assert.ok(validateActivityForm(form({ type: "strength", mode: "splits", splits: [{ mph: "6", distance: "" }] })).errors.splits);
});

test("older records with missing fields stay safe to read", () => {
  const old = normalizeStoredActivity({ id: "o", date: "2026-01-01", miles: "3" });
  assert.equal(activityAverages(old), null);
  assert.deepEqual(splitRows(old.splits), []);
  assert.deepEqual(activityToForm(old).splits, [{ mph: "", distance: "" }]);

  const legacySplits = normalizeStoredActivity({ id: "s", date: "2026-01-01", mode: "splits", miles: "", duration: "", splits: [{ mph: "6", distance: "1" }] });
  assert.equal(legacySplits.duration, 10);
  assert.equal(formatDuration(splitRows(legacySplits.splits)[0].elapsed), "10:00");
});

test("an imported split row fills in whichever total is missing", () => {
  const { accepted } = rowsToActivities([{ date: "2026-03-01", type: "run", mode: "splits", miles: "1", splits: "6@1" }], { today: "2026-11-01" });
  assert.equal(accepted[0].duration, 10);
  assert.equal(formatSplitsCell(accepted[0].splits), "6@1");
  assert.deepEqual(computeSplitTotals(accepted[0].splits).invalidRows, []);
});

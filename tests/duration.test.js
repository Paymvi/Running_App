import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activityMph,
  activityToForm,
  editMaskedDuration,
  formatDuration,
  maskDuration,
  normalizeStoredActivity,
  parseDuration,
  readDurationInput,
  validateActivityForm,
} from "../src/utils/activityModel.js";
import { weeklyRunTotals } from "../src/utils/stats.js";
import { buildExportRows, rowsToActivities } from "../src/utils/importHelpers.js";
import { run } from "./helpers.js";

const shown = (typed) => formatDuration(readDurationInput(typed).minutes);
const edit = (a, over = {}) => validateActivityForm({ ...activityToForm(a), ...over }, { original: a, today: "2026-11-01" });

test("MMSS and HMMSS digits read and format as specified, leading zeros included", () => {
  assert.equal(shown("0145"), "01:45");
  assert.equal(shown("2530"), "25:30");
  assert.equal(shown("13045"), "1:30:45");
  assert.equal(shown("0005"), "00:05");
  assert.equal(shown("00130"), "01:30"); // zero hours is still under an hour
  assert.equal(readDurationInput("0145").minutes, 1.75);
  assert.equal(readDurationInput("13045").minutes, 90.75);
});

test("the display crosses the hour boundary at exactly 60 minutes", () => {
  assert.equal(shown("5959"), "59:59");
  assert.equal(shown("6000"), "1:00:00"); // MMSS allows up to 99 minutes
  assert.equal(shown("10000"), "1:00:00");
  assert.equal(shown("9959"), "1:39:59");
  assert.equal(formatDuration(59.999), "1:00:00"); // rounds once, never 59:60
});

test("invalid and incomplete input is rejected with a specific message", () => {
  for (const bad of ["1", "145", "123456", "1:45"]) assert.match(readDurationInput(bad).error, /4 digits/, bad);
  for (const bad of ["1.75", "25.30", "abc", "-145", "12:3:45"]) assert.match(readDurationInput(bad).error, /digits only/, bad);
  for (const bad of ["0160", "2599", "13060"]) assert.match(readDurationInput(bad).error, /Seconds/, bad);
  assert.match(readDurationInput("16045").error, /Minutes/);
  assert.equal(readDurationInput("9959").error, undefined); // 99 minutes is fine without hours
});

test("a formatted value reads back; blank stays blank", () => {
  assert.equal(shown("25:30"), "25:30");
  assert.equal(shown("1:30:45"), "1:30:45");
  assert.deepEqual(readDurationInput(""), { minutes: null });
  assert.deepEqual(readDurationInput("   "), { minutes: null });
});

test("the colon is there from the first digit", () => {
  const steps = ["", "2", "25", "253", "2530", "13045", "101230"].map(maskDuration);
  assert.deepEqual(steps, ["", "2:", "25:", "25:3", "25:30", "1:30:45", "10:12:30"]);
  assert.equal(maskDuration("?"), "?");
});

test("typing into the mask keeps digits in order and the caret after what was typed", () => {
  assert.deepEqual(editMaskedDuration("", "2", 1), { digits: "2", caret: 2 });
  assert.deepEqual(editMaskedDuration("2", "25:", 2), { digits: "25", caret: 3 });
  assert.deepEqual(editMaskedDuration("25", "25:3", 4), { digits: "253", caret: 4 });
  assert.deepEqual(editMaskedDuration("2530", "25:301", 6), { digits: "25301", caret: 7 }); // becomes 2:53:01
  assert.deepEqual(editMaskedDuration("2530", "295:30", 2), { digits: "29530", caret: 3 }); // mid-value: 2:95:30
  assert.deepEqual(editMaskedDuration("2530", "", 0), { digits: "", caret: 0 }); // select all, delete
  assert.deepEqual(editMaskedDuration("2530", "0145", 4), { digits: "0145", caret: 5 }); // paste over everything
});

test("deleting across the colon removes a digit, never gets stuck on it", () => {
  assert.deepEqual(editMaskedDuration("25", "25", 2), { digits: "2", caret: 2 }); // Backspace on "25:"
  assert.deepEqual(editMaskedDuration("2", "2", 1), { digits: "", caret: 0 }); // Backspace on "2:"
  assert.deepEqual(editMaskedDuration("2530", "2530", 2), { digits: "230", caret: 1 }); // Backspace after the colon
  assert.deepEqual(editMaskedDuration("2530", "2530", 2, true), { digits: "250", caret: 2 }); // Delete before the colon
});

test("anything but numbers is refused and the caret stays put", () => {
  assert.deepEqual(editMaskedDuration("2530", "25a:30", 3), { digits: "2530", caret: 2 });
  assert.deepEqual(editMaskedDuration("2530", "25:30.", 6), { digits: "2530", caret: 5 });
  assert.deepEqual(editMaskedDuration("", "1.75", 4), { digits: "", caret: 0 }); // pasted decimal minutes
  assert.equal(editMaskedDuration("", "25:30", 5).digits, "2530"); // a pasted time is fine
});

test("an unreadable stored value can still be cleared", () => {
  assert.equal(editMaskedDuration("?", "", 0).digits, "");
  assert.equal(editMaskedDuration("abc", "ab", 2).digits, "");
});

test("stored numbers are decimal minutes, never MMSS", () => {
  assert.equal(formatDuration(parseDuration(1.75)), "01:45");
  assert.equal(formatDuration(parseDuration(25.5)), "25:30");
  assert.equal(formatDuration(parseDuration(90.75)), "1:30:45");
  assert.equal(formatDuration(parseDuration("2530")), "42:10:00"); // 2530 minutes, not 25:30
  assert.equal(formatDuration(normalizeStoredActivity({ id: "a", date: "2026-01-01", duration: "90.75" }).duration), "1:30:45");
  assert.equal(formatDuration(normalizeStoredActivity({ id: "a", date: "2026-01-01", duration: "1:30:45" }).duration), "1:30:45");
});

test("two-decimal minute storage keeps every whole second", () => {
  for (let s = 0; s <= 100 * 3600; s++) {
    const stored = Math.round((s / 60) * 100) / 100;
    assert.equal(Math.round(stored * 60), s);
  }
});

test("a typed time saves as numeric minutes and pace maths use it", () => {
  const { activity } = validateActivityForm(
    { type: "run", intensity: "easy", feel: "medium", status: "completed", date: "2026-10-01", time: "", mode: "timeMiles", miles: "3", duration: "2530", splits: [] },
    { today: "2026-11-01" }
  );
  assert.equal(activity.duration, 25.5);
  assert.equal(activityMph(activity), 3 / (25.5 / 60));
});

test("opening an older record shows its digits, and saving it unchanged keeps the exact value", () => {
  for (const [duration, digits] of [[1.75, "0145"], [25.5, "2530"], [90.75, "13045"], [25.37, "2522"], [60, "10000"]]) {
    const a = run({ duration });
    assert.equal(activityToForm(a).duration, digits);
    assert.equal(edit(a).activity.duration, duration);
  }
  assert.equal(edit(run({ duration: 25.5 }), { duration: "2531" }).activity.duration, 25.52);
});

test("durations past the typed range survive: shown in full, kept on save, editable with more digits", () => {
  const long = run({ duration: 612.5 });
  assert.equal(formatDuration(long.duration), "10:12:30");
  assert.equal(activityToForm(long).duration, "101230");
  assert.equal(edit(long).activity.duration, 612.5);
  assert.equal(edit(long, { title: "renamed" }).activity.duration, 612.5);
  assert.equal(edit(long, { duration: "110000" }).activity.duration, 660);
  assert.equal(edit(run({ duration: 6000 })).activity.duration, 6000); // 100 hours
  assert.ok(edit(run({ duration: 30 }), { duration: "110000" }).errors.duration); // only those records
});

test("optional duration rules are unchanged", () => {
  const blank = run({ type: "strength", miles: "", duration: "" });
  assert.equal(activityToForm(blank).duration, "");
  assert.equal(edit(blank).activity.duration, "");
  assert.equal(edit(run({ duration: "" })).activity.duration, "");
  assert.ok(edit(run({ miles: "", duration: "" })).errors.miles);
});

test("a stored duration that can't be read is shown, not guessed, and needs fixing", () => {
  const a = normalizeStoredActivity({ id: "q", date: "2026-01-01", miles: 3, duration: "?" });
  assert.deepEqual(a.needsReview, ["duration"]);
  assert.equal(activityToForm(a).duration, "?");
  assert.ok(edit(a).errors.duration);
  assert.equal(edit(a, { duration: "" }).activity.duration, "");
});

test("weekly totals keep seconds and add whole seconds", () => {
  const weeks = weeklyRunTotals(
    [run({ date: "2026-10-26", duration: 1.02 }), run({ date: "2026-10-27", duration: 1.02 }), run({ date: "2026-10-28", duration: 25.5 })],
    new Date(2026, 9, 29)
  );
  assert.equal(formatDuration(weeks.at(-1).minutes), "27:32"); // 01:01 + 01:01 + 25:30
});

test("exports stay decimal minutes and re-import unchanged", () => {
  const rows = buildExportRows([run({ id: "x", date: "2026-03-01", duration: 90.75 })]);
  assert.equal(rows[0].duration, 90.75);
  assert.equal(rowsToActivities(rows).accepted[0].duration, 90.75);
});

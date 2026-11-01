import { test } from "node:test";
import assert from "node:assert/strict";
import Papa from "papaparse";
import { activitiesToCSV, csvResultsToActivities, rowsToActivities, buildExportRows } from "../src/utils/importHelpers.js";
import { initActivityStore, mergeImported, getActivityState } from "../src/utils/activityStore.js";
import { fakeStorage, run } from "./helpers.js";

const parseCSV = (text) => Papa.parse(text, { header: true, skipEmptyLines: true });

const original = [
  run({ id: "id-1", title: "=SUM(A1)", notes: "easy; felt good\nsecond line", description: "@home", tags: ["hills", "race"], date: "2026-03-05", time: "06:30", miles: 3.1, duration: 25.5, elevationGainFt: 120 }),
  run({ id: "id-2", mode: "splits", splits: [{ mph: 6, distance: 1 }, { mph: 8, distance: 2 }], miles: 3, duration: 25, date: "2026-03-04", intensity: "intervals", source: "strava", sourceId: "987" }),
  run({ id: "id-3", type: "workout", miles: "", duration: 40, date: "2026-03-03", notes: "-5 reps" }),
];

test("CSV export -> import round trip preserves identity, fields and text (F06, F07, F11)", () => {
  const { accepted, rejected } = csvResultsToActivities(parseCSV(activitiesToCSV(original)));
  assert.deepEqual(rejected, []);
  assert.equal(accepted.length, 3);

  const [a, b, c] = accepted;
  assert.equal(a.id, "id-1");
  assert.equal(a.title, "=SUM(A1)");
  assert.equal(a.notes, "easy; felt good\nsecond line");
  assert.equal(a.description, "@home");
  assert.deepEqual(a.tags, ["hills", "race"]);
  assert.equal(a.date, "2026-03-05");
  assert.equal(a.time, "06:30");
  assert.equal(a.miles, 3.1);
  assert.equal(a.duration, 25.5);
  assert.equal(a.elevationGainFt, 120);

  assert.equal(b.mode, "splits");
  assert.deepEqual(b.splits, [{ mph: 6, distance: 1 }, { mph: 8, distance: 2 }]);
  assert.equal(b.intensity, "intervals");
  assert.equal(b.source, "strava");
  assert.equal(b.sourceId, "987");

  assert.equal(c.type, "workout");
  assert.equal(c.miles, "");
  assert.equal(c.notes, "-5 reps");

  // Second round trip is identical.
  const again = csvResultsToActivities(parseCSV(activitiesToCSV(accepted))).accepted;
  assert.deepEqual(again, accepted);
});

test("CSV export neutralizes spreadsheet formulas in text cells (F30)", () => {
  const csv = activitiesToCSV(original);
  assert.ok(csv.includes(`"'=SUM(A1)"`));
  assert.ok(csv.includes(`"'@home"`));
  assert.ok(!csv.includes(`"=SUM(A1)"`));
});

test("exports already-stored slash dates correctly", () => {
  assert.equal(buildExportRows([run({ date: "3/5/2026" })])[0].date, "3/5/2026");
});

test("bad rows are rejected with reasons; good rows still import (F10)", () => {
  const rows = [
    { date: "2026-02-31", miles: "3" },
    { date: "3/5/2026", miles: "abc" },
    { date: "2026-03-05", type: "skydive", miles: "1" },
    { date: "2026-03-05" },
    { date: "2026-03-05", miles: "3", duration: "30:30", type: "RUN", intensity: "Easy", notes: 42 },
  ];
  const { accepted, rejected } = rowsToActivities(rows);
  assert.deepEqual(rejected.map((r) => r.row), [2, 3, 4, 5]);
  assert.match(rejected[0].errors[0], /invalid date/);
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].type, "run");
  assert.equal(accepted[0].intensity, "easy");
  assert.equal(accepted[0].duration, 30.5);
  assert.equal(accepted[0].notes, "42"); // numeric Excel cell coerced, not crashed
});

test("files without a date column are refused", () => {
  assert.throws(() => csvResultsToActivities(parseCSV("title,miles\nx,3")), /date/);
});

test("unknown columns are reported; prototype keys are ignored", () => {
  const { warnings, accepted } = csvResultsToActivities(parseCSV("date,miles,__proto__,colour\n2026-01-01,3,x,red"));
  assert.match(warnings[0], /colour/);
  assert.equal(accepted.length, 1);
  assert.equal({}.polluted, undefined);
});

test("importing the same export twice adds nothing the second time (F08)", () => {
  initActivityStore({ storage: fakeStorage() });
  const { accepted } = csvResultsToActivities(parseCSV(activitiesToCSV(original)));
  assert.equal(mergeImported(accepted).added, 3);
  const second = mergeImported(csvResultsToActivities(parseCSV(activitiesToCSV(original))).accepted);
  assert.equal(second.added, 0);
  assert.equal(second.duplicates, 3);
  assert.equal(getActivityState().activities.length, 3);
});

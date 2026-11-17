import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyStarsRows, initialRunEntry, parseStarsBackup, resolveRunEntry, starsRowToActivity } from "../src/utils/starsImport.js";
import { getActivityState, initActivityStore, mergeImported } from "../src/utils/activityStore.js";
import { activityMph } from "../src/utils/activityModel.js";
import { fakeStorage, run } from "./helpers.js";

// Same shape Stars writes from Settings -> Export backup (src/domain/model.ts, schema 1).
const backup = {
  version: 1,
  startedOn: "2026-03-01",
  goals: [{ from: "2026-02-23", workoutsPerWeek: 4, runsPerWeek: 3, stepsPerDay: 7000 }],
  runs: [
    { id: "r1", date: "2026-03-08", distanceMi: 3.1, notes: "easy loop" },
    { id: "r2", date: "2026-03-09" },
    { id: "r3", date: "2026-03-10", distanceMi: 5 },
  ],
  workouts: [{ id: "w1", date: "2026-03-08", type: "Push", notes: "bench 3x5" }],
  hygiene: { "2026-03-08": ["brush"] },
  steps: { "2026-03-08": 4200 },
};
const text = JSON.stringify(backup);
const today = "2026-11-17";
const byId = (rows, id) => rows.find((r) => r.sourceId === id);

test("parses a Stars backup into runs and lifts, keeping dates, types and notes", () => {
  const rows = parseStarsBackup(text);
  assert.equal(rows.length, 4);
  assert.deepEqual(
    { ...byId(rows, "r1") },
    { key: "run:r1", kind: "run", sourceId: "r1", date: "2026-03-08", label: "Run", notes: "easy loop", distanceMi: 3.1, problem: null }
  );
  const lift = byId(rows, "w1");
  assert.equal(lift.kind, "strength");
  assert.equal(lift.label, "Push");
  assert.equal(lift.notes, "bench 3x5");
  assert.equal(byId(rows, "r2").distanceMi, null);
});

test("malformed files are refused with a reason; bad entries are shown, not dropped", () => {
  assert.throws(() => parseStarsBackup("{not json"), /valid JSON/);
  assert.throws(() => parseStarsBackup("[]"), /isn't a Stars backup/);
  assert.throws(() => parseStarsBackup(JSON.stringify({ activities: [] })), /isn't a Stars backup/);
  assert.throws(() => parseStarsBackup(JSON.stringify({ ...backup, version: 2 })), /version 2/);
  assert.throws(() => parseStarsBackup("x".repeat(6 * 1024 * 1024)), /5 MB/);

  const rows = parseStarsBackup(
    JSON.stringify({
      ...backup,
      runs: [{ id: "a", date: "2026-02-31" }, { date: "2026-03-01" }, { id: "c", date: "2026-03-01", distanceMi: -1 }, null],
      workouts: [{ id: "d", date: "2026-03-01" }],
    })
  );
  const problems = rows.map((r) => r.problem);
  assert.equal(problems.filter(Boolean).length, 5);
  assert.ok(problems.some((p) => /Invalid date "2026-02-31"/.test(p)));
  assert.ok(problems.some((p) => /Missing its Stars id/.test(p)));
  assert.ok(problems.some((p) => /Invalid distance -1/.test(p)));
  assert.ok(problems.some((p) => /workout type/.test(p)));
  assert.ok(classifyStarsRows(rows, []).every((r) => r.status === "invalid"));
});

test("any two of distance, time and speed give the third; blank is not zero", () => {
  let r = resolveRunEntry({ distance: "3", duration: "2400" }); // 3 mi in 24:00
  assert.equal(r.derived, "speed");
  assert.equal(r.speed, 7.5);

  r = resolveRunEntry({ distance: "3", speed: "6" });
  assert.equal(r.derived, "duration");
  assert.equal(r.minutes, 30);

  r = resolveRunEntry({ duration: "3000", speed: "6" }); // 30:00 at 6 mph
  assert.equal(r.derived, "distance");
  assert.equal(r.distance, 3);

  r = resolveRunEntry({ distance: "3", duration: "2400", speed: "7.5" });
  assert.deepEqual(r.errors, {});
  r = resolveRunEntry({ distance: "3", duration: "2400", speed: "8" });
  assert.match(r.errors.speed, /don't agree: 3 mi in 24:00 is 7.5 mph/);

  assert.match(resolveRunEntry({ distance: "0" }).errors.distance, /can't be 0/);
  assert.match(resolveRunEntry({ duration: "0000" }).errors.duration, /can't be 00:00/);
  assert.match(resolveRunEntry({ speed: "6" }).errors.speed, /Speed alone/);
  assert.match(resolveRunEntry({}).errors.distance, /needs a distance or a time/);
  assert.match(resolveRunEntry({ duration: "2575" }).errors.duration, /Seconds/);
  assert.match(resolveRunEntry({ distance: "abc" }).errors.distance, /number/);

  // Distance alone (no time) is a valid run; nothing is invented.
  r = resolveRunEntry({ distance: "3.1" });
  assert.deepEqual(r.errors, {});
  assert.equal(r.minutes, null);
  assert.equal(r.speed, null);
});

test("a run with only a date is completed in the preview and saved as one coherent record", () => {
  const row = byId(parseStarsBackup(text), "r2");
  assert.deepEqual(starsRowToActivity(row, initialRunEntry(row), { today }).errors, ["Missing: Velo needs a distance or a time for a run."]);

  const { activity } = starsRowToActivity(row, { distance: "4", duration: "", speed: "8" }, { today });
  assert.equal(activity.type, "run");
  assert.equal(activity.date, "2026-03-09");
  assert.equal(activity.miles, 4);
  assert.equal(activity.duration, 30);
  assert.equal(activityMph(activity), 8);
  assert.equal(activity.status, "completed");
  assert.equal(activity.intensity, "unknown");
  assert.equal(activity.source, "stars");
  assert.equal(activity.sourceId, "r2");
  assert.deepEqual(activity.splits, []);
  assert.ok(activity.id);
});

test("Stars distance alone imports with blank time; lifts import as Strength", () => {
  const rows = parseStarsBackup(text);
  const r1 = byId(rows, "r1");
  const { activity } = starsRowToActivity(r1, initialRunEntry(r1), { today });
  assert.equal(activity.miles, 3.1);
  assert.equal(activity.duration, "");
  assert.equal(activity.notes, "easy loop");

  const lift = starsRowToActivity(byId(rows, "w1"), undefined, { today }).activity;
  assert.equal(lift.type, "strength");
  assert.equal(lift.title, "Push");
  assert.equal(lift.miles, "");
  assert.equal(lift.duration, "");
  assert.equal(lift.notes, "bench 3x5");
});

test("kilometre users type km and km/h; Velo still stores miles", () => {
  const row = byId(parseStarsBackup(text), "r3"); // 5 mi
  const entry = initialRunEntry(row, "km");
  assert.equal(entry.distance, "8.047");
  const { activity } = starsRowToActivity(row, { ...entry, duration: "4000" }, { unit: "km", today });
  assert.ok(Math.abs(activity.miles - 5) < 0.001);
  assert.equal(activity.duration, 40);
});

test("future-dated entries can't be imported as completed", () => {
  const row = { ...byId(parseStarsBackup(text), "w1"), date: "2027-01-01" };
  assert.match(starsRowToActivity(row, undefined, { today }).errors[0], /future/);
});

test("duplicates: same Stars id is already imported; same date and type is a possible duplicate", () => {
  const rows = parseStarsBackup(text);
  const current = [
    run({ date: "2026-03-08", miles: 3.12, source: "stars", sourceId: "nope" }), // r1 look-alike
    run({ date: "2026-03-10", miles: 8 }), // r3 is 5 mi: different run
    run({ type: "strength", date: "2026-03-11", source: "stars", sourceId: "w1" }),
  ];
  const c = classifyStarsRows(rows, current);
  assert.equal(byId(c, "r1").status, "duplicate");
  assert.match(byId(c, "r1").reason, /Possible duplicate/);
  assert.equal(byId(c, "r2").status, "new");
  assert.equal(byId(c, "r3").status, "new");
  assert.equal(byId(c, "w1").status, "imported");
});

test("importing the same file twice adds nothing the second time; a failed save changes nothing", () => {
  const storage = fakeStorage();
  initActivityStore({ storage, now: Date.parse("2026-11-17") });
  const existing = run({ id: "keep", date: "2026-01-01" });
  assert.equal(mergeImported([existing]).ok, true);

  const pick = (rows) =>
    rows
      .filter((r) => r.status === "new")
      .map((r) => starsRowToActivity(r, r.kind === "run" ? { ...initialRunEntry(r), duration: "3000" } : undefined, { today }).activity);

  // Only some selected: r2 is left out.
  const first = pick(classifyStarsRows(parseStarsBackup(text), getActivityState().activities)).filter((a) => a.sourceId !== "r2");
  const res = mergeImported(first);
  assert.equal(res.ok, true);
  assert.equal(res.added, 3);
  assert.equal(getActivityState().activities.length, 4);

  const again = classifyStarsRows(parseStarsBackup(text), getActivityState().activities);
  assert.deepEqual(again.filter((r) => r.status === "imported").map((r) => r.sourceId).sort(), ["r1", "r3", "w1"]);
  assert.equal(byId(again, "r2").status, "new");
  // Even if the same records are submitted again, the store skips their Stars ids.
  assert.equal(mergeImported(first.map((a) => ({ ...a, id: crypto.randomUUID() }))).added, 0);

  const before = JSON.stringify(storage.dump());
  storage.failWrites = true;
  const failed = mergeImported(pick(again));
  assert.equal(failed.ok, false);
  assert.ok(failed.error);
  assert.equal(JSON.stringify(storage.dump()), before);
  assert.equal(getActivityState().activities.length, 4);
  assert.ok(getActivityState().activities.some((a) => a.id === "keep"));
});

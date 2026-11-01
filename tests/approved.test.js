// Regression tests for the decisions approved after the first repair pass.
process.env.TZ = "America/New_York";

import { test } from "node:test";
import assert from "node:assert/strict";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  validateActivityForm,
  activityToForm,
  activityPaceParts,
  weightedPace,
  buildJarGroups,
  isCountable,
} from "../src/utils/activityModel.js";
import { detectPRs } from "../src/utils/prDetection.js";
import { easyShare, monthlySnapshot, weeklyRunTotals, runTotals } from "../src/utils/stats.js";
import { generateCoachAlerts } from "../src/utils/coachAlert.js";
import { migrateActivitiesV2, runMigrations } from "../src/utils/migrations.js";
import { putPhotosVerified } from "../src/utils/media.js";
import { backupsToPrune } from "../src/utils/backups.js";
import { toDisplay, fromDisplay, formatDistance } from "../src/utils/units.js";
import {
  KEYS,
  buildBackupFile,
  parseBackupFile,
  restoreBackup,
  resetAllData,
  snapshotAll,
} from "../src/utils/storage.js";
import {
  initActivityStore,
  getActivityState,
  saveActivity,
  saveActivityWithPhoto,
  deleteActivity,
  deleteAllActivities,
  restoreFromTrash,
  purgeTrash,
  purgeExpiredTrash,
  previewImport,
  mergeImported,
  TRASH_DAYS,
} from "../src/utils/activityStore.js";
import {
  activitiesToCSV,
  csvResultsToActivities,
  escapeFormula,
  unescapeFormula,
  activitiesToWorkbook,
  workbookToRows,
  rowsToActivities,
} from "../src/utils/importHelpers.js";
import { fakeStorage, fakeMedia, run } from "./helpers.js";

const form = (over = {}) => ({
  id: null, title: "", description: "", type: "run", intensity: "easy", feel: "medium", status: "completed",
  limiter: "", tags: [], date: "2026-10-01", time: "", mode: "timeMiles", miles: "3", duration: "30",
  splits: [{ mph: "", distance: "" }], notes: "", ...over,
});
const today = "2026-11-01";
const opts = { today };

// ---------------------------------------------------------------- validity
test("distance-only runs are valid and have no pace (not zero pace)", () => {
  const { errors, activity } = validateActivityForm(form({ duration: "" }), opts);
  assert.deepEqual(errors, {});
  assert.equal(activity.duration, "");
  assert.equal(activityPaceParts(activity), null);
});

test("strength may omit distance and time; other types may not", () => {
  assert.deepEqual(validateActivityForm(form({ type: "strength", miles: "", duration: "" }), opts).errors, {});
  for (const type of ["run", "bike", "swim", "hike", "workout"]) {
    assert.ok(validateActivityForm(form({ type, miles: "", duration: "" }), opts).errors.miles, type);
  }
  assert.deepEqual(validateActivityForm(form({ type: "hike", miles: "5", duration: "" }), opts).errors, {});
});

test("status is required; completed cannot be in the future, planned can", () => {
  assert.ok(validateActivityForm(form({ status: "" }), opts).errors.status);
  assert.ok(validateActivityForm(form({ date: "2026-11-02" }), opts).errors.status);
  assert.deepEqual(validateActivityForm(form({ date: "2026-11-01" }), opts).errors, {});
  const { errors, activity } = validateActivityForm(form({ date: "2026-12-01", status: "planned" }), opts);
  assert.deepEqual(errors, {});
  assert.equal(activity.status, "planned");
});

// ---------------------------------------------------------------- units
test("kilometers are converted at the form boundary; stored distance is miles", () => {
  const { activity } = validateActivityForm(form({ miles: "5" }), { ...opts, unit: "km" });
  assert.ok(Math.abs(activity.miles - 3.106856) < 1e-6);
  assert.equal(activityToForm(activity, "km").miles, "5");
  assert.equal(activityToForm(activity, "mi").miles, "3.107");
  assert.equal(formatDistance(3.106856, "km"), "5 km");
  assert.ok(Math.abs(fromDisplay(toDisplay(7.3, "km"), "km") - 7.3) < 1e-12);
});

test("editing without touching distance keeps the exact stored value in either unit", () => {
  const original = run({ miles: 3.10686 });
  for (const unit of ["mi", "km"]) {
    const f = { ...activityToForm(original, unit), title: "renamed" };
    const { activity } = validateActivityForm(f, { ...opts, unit, original });
    assert.equal(activity.miles, 3.10686, unit);
  }
});

test("km splits store mph and miles", () => {
  const { activity } = validateActivityForm(
    form({ mode: "splits", splits: [{ mph: "10", distance: "5" }] }),
    { ...opts, unit: "km" }
  );
  assert.ok(Math.abs(activity.splits[0].mph - 6.213712) < 1e-6);
  assert.ok(Math.abs(activity.duration - 30) < 0.01); // 5 km at 10 km/h
});

// ---------------------------------------------------------------- planned vs completed
test("planned and unconfirmed activities never count as training", () => {
  const list = [
    run({ id: "done", date: "2026-10-28", miles: 5, duration: 50 }),
    run({ id: "plan", date: "2026-10-29", miles: 3.11, duration: 20, status: "planned" }),
    run({ id: "unsure", date: "2026-10-30", miles: 10, duration: 60, needsReview: ["status"] }),
  ];
  assert.deepEqual(list.filter(isCountable).map((a) => a.id), ["done"]);
  assert.equal(buildJarGroups(list).current.length, 1);
  assert.equal(detectPRs(list).fiveK.id, null);
  assert.equal(runTotals(list, new Date(2026, 10, 1)).totalMiles, 5);
  const week = weeklyRunTotals(list, new Date(2026, 10, 1)).at(-1);
  assert.equal(week.miles, 5);
});

test("migration flags future-dated records without a status; past ones stay completed", () => {
  const { activities, unconfirmed } = migrateActivitiesV2(
    [run({ id: "past", date: "2026-10-31" }), run({ id: "today", date: "2026-11-01" }), run({ id: "future", date: "2026-11-05" }), run({ id: "planned", date: "2026-11-05", status: "planned" })],
    "2026-11-01"
  );
  assert.deepEqual(unconfirmed, ["future"]);
  assert.deepEqual(activities.find((a) => a.id === "future").needsReview, ["status"]);
  assert.equal(activities.find((a) => a.id === "past").needsReview, undefined);
  // Passing the date does not change anything by itself.
  assert.equal(isCountable(activities.find((a) => a.id === "future")), false);
});

// ---------------------------------------------------------------- PRs
const mi = (meters) => meters / 1609.344;

test("PR: at least the exact event distance, at most 3% over", () => {
  const list = [
    run({ id: "short5k", miles: 3.1, duration: 18 }), // 4989 m: shorter than 5 km
    run({ id: "exact5k", miles: mi(5000), duration: 22 }),
    run({ id: "over3", miles: mi(5150), duration: 21 }), // exactly +3%
    run({ id: "over35", miles: mi(5175), duration: 19 }), // +3.5%
    run({ id: "mile", miles: 1, duration: 7 }),
    run({ id: "tenk", miles: mi(10000), duration: 50 }),
  ];
  const prs = detectPRs(list);
  assert.equal(prs.fiveK.id, "over3");
  assert.equal(prs.mile.id, "mile");
  assert.equal(prs.tenK.id, "tenk");
});

test("PR: ties keep the earliest; race tag doesn't bypass distance; review/planned/missing time excluded", () => {
  const list = [
    run({ id: "later", date: "2026-05-02", miles: 1, duration: 7 }),
    run({ id: "earlier", date: "2026-05-01", miles: 1, duration: 7 }),
    run({ id: "race", date: "2026-05-03", miles: 0.9, duration: 5, tags: ["race"] }),
    run({ id: "review", date: "2026-05-04", miles: 1, duration: 6, needsReview: ["duration"] }),
    run({ id: "plan", date: "2026-05-05", miles: 1, duration: 5, status: "planned" }),
    run({ id: "notime", date: "2026-05-06", miles: 1, duration: "" }),
    run({ id: "long", date: "2026-05-07", miles: 3, duration: 15 }), // no inferred fast mile inside
  ];
  assert.equal(detectPRs(list).mile.id, "earlier");
});

test("PR prefers Strava's exact meters over rounded miles", () => {
  // 4999 m rounds to 3.11 mi, but it is shorter than 5 km.
  assert.equal(detectPRs([run({ miles: 3.11, distanceMeters: 4999, duration: 20 })]).fiveK.id, null);
  assert.ok(detectPRs([run({ id: "ok", miles: 3.11, distanceMeters: 5000, duration: 20 })]).fiveK.id);
});

// ---------------------------------------------------------------- statistics
test("weighted pace leaves activities without both inputs out of both sides", () => {
  const p = weightedPace([run({ miles: 2, duration: 20 }), run({ miles: 4, duration: 32 }), run({ miles: 5, duration: "" }), run({ miles: "", duration: 30 })]);
  assert.equal(p.minutesPerMile, 52 / 6);
});

test("easy % is by run miles with a known effort; unknown effort is separate", () => {
  const s = easyShare([run({ intensity: "easy", miles: 3 }), run({ intensity: "tempo", miles: 1 }), run({ intensity: "unknown", miles: 6 })]);
  assert.deepEqual(s, { easyMiles: 3, knownMiles: 4, unknownMiles: 6, pct: 75 });
  assert.equal(easyShare([run({ intensity: "unknown" })]).pct, null);
});

test("monthly snapshot: same days of last month for the current month, whole months otherwise, zero months shown", () => {
  const list = [
    run({ date: "2026-01-10", miles: 4 }),
    run({ date: "2026-03-05", miles: 2 }),
    run({ date: "2026-03-20", miles: 5 }), // after Mar 5: excluded from the April comparison? no: Apr compares Mar 1-5
    run({ date: "2026-04-03", miles: 3 }),
  ];
  const months = monthlySnapshot(list, new Date(2026, 3, 5)); // Apr 5
  assert.deepEqual(months.map((m) => m.label), ["Apr 2026", "Mar 2026", "Feb 2026", "Jan 2026"]);
  const [apr, mar, feb, jan] = months;
  assert.equal(apr.partial, true);
  assert.equal(apr.mileageDelta, 3 - 2); // Mar 1–5 only
  assert.match(apr.comparedWith, /Mar 1–5/);
  assert.equal(mar.mileageDelta, 7 - 0); // whole March vs whole (empty) February
  assert.equal(feb.miles, 0);
  assert.equal(jan.mileageDelta, null);

  // Month-length clamp: Mar 31 compares with Feb 1–28.
  const end = monthlySnapshot([run({ date: "2026-02-28", miles: 1 }), run({ date: "2026-03-31", miles: 1 })], new Date(2026, 2, 31));
  assert.match(end[0].comparedWith, /Feb 1–28/);
  assert.equal(end[0].mileageDelta, 0);
});

test("weekly totals are Monday–Sunday with zero weeks included", () => {
  const weeks = weeklyRunTotals([run({ date: "2026-10-12", miles: 2 }), run({ date: "2026-10-18", miles: 1 })], new Date(2026, 10, 1));
  assert.deepEqual(weeks.map((w) => [w.weekStart.getDate(), w.miles]), [[12, 3], [19, 0], [26, 0]]);
});

// ---------------------------------------------------------------- coaching
const keys = (alerts) => alerts.map((a) => a.key);
const at = (y, m, d) => ({ today: new Date(y, m - 1, d) });

test("coaching is as of today: last-run alerts expire, long run overdue keeps ageing", () => {
  const list = [run({ date: "2026-10-01", intensity: "tempo" }), run({ date: "2026-09-10", intensity: "long" })];
  assert.ok(keys(generateCoachAlerts(list, 6, at(2026, 10, 2))).includes("b2-next-move"));
  const later = keys(generateCoachAlerts(list, 6, at(2026, 10, 30)));
  assert.ok(!later.includes("b2-next-move"));
  assert.ok(later.includes("b1-long-overdue"));
});

test("mileage spike compares the same days of last week", () => {
  // Today is Wednesday Oct 14. Last week: 4 mi Mon–Wed, 10 mi on Saturday (not comparable yet).
  const list = [
    run({ date: "2026-10-05", miles: 4 }),
    run({ date: "2026-10-10", miles: 10 }),
    run({ date: "2026-10-12", miles: 3 }),
    run({ date: "2026-10-14", miles: 3 }),
  ];
  const alerts = generateCoachAlerts(list, 6, at(2026, 10, 14));
  const spike = alerts.find((a) => a.key === "y2-mileage-spike");
  assert.ok(spike, keys(alerts).join());
  assert.match(spike.title, /\+50%/);
});

test("pace-creep baseline excludes the run being judged", () => {
  // Ten 7.5 mph easy runs would hide creep if the latest run were in its own baseline.
  const base = Array.from({ length: 4 }, (_, i) => run({ date: `2026-10-0${i + 1}`, miles: 3, duration: 30, feel: "easy" }));
  const latest = run({ date: "2026-10-06", miles: 3.5, duration: 30, feel: "medium" });
  assert.ok(keys(generateCoachAlerts([latest, ...base], 6, at(2026, 10, 6))).includes("r3-easy-pace-creep"));
});

test("unknown effort is neither easy nor hard and is called out; planned runs are ignored", () => {
  const list = [
    run({ date: "2026-10-12", intensity: "unknown" }),
    run({ date: "2026-10-13", intensity: "unknown" }),
    run({ date: "2026-10-14", intensity: "unknown" }),
    run({ date: "2026-10-15", intensity: "tempo", status: "planned" }),
  ];
  const k = keys(generateCoachAlerts(list, 6, at(2026, 10, 14)));
  assert.ok(k.includes("b3-unknown-effort"));
  assert.ok(!k.includes("y6-easy-too-low") && !k.includes("g1-discipline") && !k.includes("b2-next-move"));
  // Distance-only runs: pace analyses are skipped rather than crashing.
  assert.ok(generateCoachAlerts([run({ duration: "", date: "2026-10-14" })], 6, at(2026, 10, 14)).length);
});

// ---------------------------------------------------------------- jars
test("jar: every valid completed easy run counts, including distance-only; edits/deletes/backdating recalc", () => {
  const list = Array.from({ length: 24 }, (_, i) => run({ id: `r${i}`, date: `2026-02-${String(i + 1).padStart(2, "0")}` }));
  list.push(run({ id: "distOnly", date: "2026-03-01", duration: "" }));
  let jars = buildJarGroups(list);
  assert.equal(jars.completed.length, 1);
  assert.equal(jars.current.length, 0); // moved to history immediately

  // A backdated easy run lands in the first jar and pushes the latest into a new jar.
  jars = buildJarGroups([...list, run({ id: "back", date: "2026-01-01" })]);
  assert.equal(jars.completed[0][0].id, "back");
  assert.deepEqual(jars.current.map((b) => b.id), ["distOnly"]);

  // Editing a run to tempo (or deleting it) takes its ball away.
  jars = buildJarGroups(list.map((a) => (a.id === "r0" ? { ...a, intensity: "tempo" } : a)));
  assert.equal(jars.completed.length, 0);
  assert.equal(jars.current.length, 24);

  // Unknown effort and planned runs earn nothing.
  assert.equal(buildJarGroups([run({ intensity: "unknown" }), run({ status: "planned" })]).groups.length, 0);
});

// ---------------------------------------------------------------- media & backups
test("photo copy is verified; corrupted read-back fails the migration without writing", async () => {
  const media = fakeMedia();
  media.corrupt = true;
  await assert.rejects(putPhotosVerified([{ id: "p", dataUrl: "data:image/jpeg;base64,QQ==" }], media));

  const raw = JSON.stringify([run({ id: "a", photo: "data:image/jpeg;base64,QQ==" })]);
  const storage = fakeStorage({ activities: raw, velo_schema_version: "1" });
  const result = await runMigrations({ storage, media, saveBackup: async () => {}, today });
  assert.equal(result.status, "media-failed");
  assert.equal(storage.getItem(KEYS.activities), raw);
  assert.equal(storage.getItem(KEYS.schema), "1");
});

test("a v1 store with photos upgrades to v2 and the backup holds the inline photo", async () => {
  const photo = "data:image/jpeg;base64,QUJD";
  const raw = JSON.stringify([run({ id: "a", photo }), run({ id: "b" })]);
  const storage = fakeStorage({ activities: raw, velo_schema_version: "1" });
  const media = fakeMedia();
  const backups = [];
  const result = await runMigrations({ storage, media, saveBackup: async (b) => backups.push(b), today });
  assert.equal(result.status, "migrated");
  assert.ok(backups[0].entries.activities.includes(photo));
  const stored = JSON.parse(storage.getItem(KEYS.activities));
  assert.equal(stored[0].photoId, "legacy-a");
  assert.ok(!storage.getItem(KEYS.activities).includes("base64"));
  assert.equal(media.map.get("legacy-a"), photo);
  // Running again is a no-op.
  assert.equal((await runMigrations({ storage, media, saveBackup: async () => {}, today })).status, "current");
});

test("complete backup spans localStorage and photos, and restores both", async () => {
  const photo = "data:image/jpeg;base64,UEhPVE8=";
  const source = fakeStorage({
    activities: JSON.stringify([run({ id: "a", photoId: "p1" })]),
    activities_trash: JSON.stringify([{ deletedAt: "2026-10-30T00:00:00Z", activity: run({ id: "t", photoId: "p2" }) }]),
    homeNoteCards: "[]",
    velo_units: "km",
    velo_coach_alerts: "0",
    strava_access_token: "secret",
  });
  const sourceMedia = fakeMedia({ p1: photo, p2: photo });
  const { entries, media } = await snapshotAll(source, sourceMedia);
  const text = buildBackupFile(entries, "2026-11-01T00:00:00Z", media);
  assert.ok(!text.includes("secret"));

  const parsed = parseBackupFile(text);
  assert.equal(parsed.error, undefined);
  const target = fakeStorage({ activities: "[]", profileName: "Other" });
  const targetMedia = fakeMedia();
  await restoreBackup(parsed, target, targetMedia);
  assert.equal(target.getItem("velo_units"), "km");
  assert.equal(target.getItem("profileName"), null);
  assert.equal(JSON.parse(target.getItem(KEYS.trash))[0].activity.id, "t");
  assert.equal(targetMedia.map.get("p1"), photo);
  assert.equal(targetMedia.map.get("p2"), photo);

  // If photos can't be stored, records are not touched.
  const failing = fakeMedia();
  failing.failPut = true;
  const untouched = fakeStorage({ activities: "[]" });
  await assert.rejects(restoreBackup(parsed, untouched, failing));
  assert.equal(untouched.getItem(KEYS.activities), "[]");

  assert.ok(parseBackupFile(JSON.stringify({ format: "velo-backup", version: 2, keys: {}, media: { x: "javascript:1" } })).error);
  assert.equal(parseBackupFile(JSON.stringify({ format: "velo-backup", version: 1, keys: { activities: "[]" } })).error, undefined);
});

test("automatic backup retention keeps every upgrade backup plus the 10 newest others", () => {
  const list = [
    { id: 1, reason: "before schema v1 upgrade" },
    ...Array.from({ length: 12 }, (_, i) => ({ id: i + 2, reason: "before Delete All" })),
    { id: 20, reason: "before schema v2 upgrade" },
  ];
  assert.deepEqual(backupsToPrune(list).sort((a, b) => a - b), [2, 3]);
});

test("reset removes every Velo key and photo, and nothing else", async () => {
  const storage = fakeStorage({ activities: "[]", activities_trash: "[]", homeNoteCards: "[]", profileName: "Me", velo_units: "km", activities_corrupt_1: "x", other_site_key: "keep" });
  const media = fakeMedia({ p: "data:image/jpeg;base64,QQ==" });
  await resetAllData(storage, media);
  assert.deepEqual(storage.dump(), { other_site_key: "keep" });
  assert.equal(media.map.size, 0);
});

// ---------------------------------------------------------------- trash, undo, stale edits
test("delete moves to trash; undo restores; purge removes the record and its photo", async () => {
  const media = fakeMedia({ p1: "data:image/jpeg;base64,QQ==" });
  const storage = fakeStorage();
  initActivityStore({ storage, media });
  saveActivity(run({ id: "a", photoId: "p1" }));
  saveActivity(run({ id: "b" }));

  assert.equal(deleteActivity("a").ok, true);
  assert.deepEqual(getActivityState().activities.map((x) => x.id), ["b"]);
  assert.equal(getActivityState().trash[0].activity.id, "a");
  assert.equal(JSON.parse(storage.getItem(KEYS.trash)).length, 1);

  assert.equal(restoreFromTrash(["a"]).restored, 1);
  assert.equal(getActivityState().trash.length, 0);
  assert.equal(getActivityState().activities.length, 2);

  assert.equal(deleteAllActivities().count, 2);
  assert.equal(getActivityState().activities.length, 0);
  assert.equal((await purgeTrash(["a"])).purged, 1);
  assert.equal(media.map.has("p1"), false);
  assert.deepEqual(getActivityState().trash.map((t) => t.activity.id), ["b"]);
});

test(`trash items older than ${TRASH_DAYS} days are purged on load`, async () => {
  const old = new Date(Date.UTC(2026, 8, 1)).toISOString();
  const recent = new Date(Date.UTC(2026, 9, 25)).toISOString();
  const storage = fakeStorage({
    activities: "[]",
    activities_trash: JSON.stringify([{ deletedAt: old, activity: run({ id: "old" }) }, { deletedAt: recent, activity: run({ id: "new" }) }]),
  });
  initActivityStore({ storage, media: fakeMedia(), now: Date.UTC(2026, 10, 1) });
  await purgeExpiredTrash(Date.UTC(2026, 10, 1));
  assert.deepEqual(getActivityState().trash.map((t) => t.activity.id), ["new"]);
});

test("a failed trash write changes nothing", () => {
  const storage = fakeStorage();
  initActivityStore({ storage, media: fakeMedia() });
  saveActivity(run({ id: "a" }));
  storage.failWrites = true;
  const result = deleteActivity("a");
  assert.equal(result.ok, false);
  assert.equal(getActivityState().activities.length, 1);
  assert.equal(storage.getItem(KEYS.trash), null);
});

test("stale edits are refused instead of overwriting newer changes", () => {
  const storage = fakeStorage();
  initActivityStore({ storage, media: fakeMedia() });
  saveActivity(run({ id: "a", title: "v1" }));
  const opened = getActivityState().activities[0];

  // Changed elsewhere after the editor opened.
  saveActivity({ ...opened, title: "v2" });
  const stale = saveActivity({ ...opened, title: "mine" }, { expected: opened });
  assert.equal(stale.ok, false);
  assert.equal(stale.conflict, true);
  assert.equal(getActivityState().activities[0].title, "v2");

  // Another tab wrote directly to storage: refused and reloaded.
  storage.setItem(KEYS.activities, JSON.stringify([run({ id: "a", title: "other tab" })]));
  const result = saveActivity(run({ id: "z" }));
  assert.equal(result.ok, false);
  assert.equal(getActivityState().activities[0].title, "other tab");
  assert.equal(saveActivity(run({ id: "z" })).ok, true); // retry after reload works
});

test("a new photo is stored before the record and the replaced one removed after", async () => {
  const media = fakeMedia({ old: "data:image/jpeg;base64,T0xE" });
  initActivityStore({ storage: fakeStorage(), media });
  saveActivity(run({ id: "a", photoId: "old" }));
  const opened = getActivityState().activities[0];
  const result = await saveActivityWithPhoto({ ...opened }, { photo: "data:image/jpeg;base64,TkVX", expected: opened });
  assert.equal(result.ok, true);
  const saved = getActivityState().activities[0];
  assert.notEqual(saved.photoId, "old");
  assert.equal(media.map.get(saved.photoId), "data:image/jpeg;base64,TkVX");
  assert.equal(media.map.has("old"), false);

  // Photo store full: nothing changes.
  media.failPut = true;
  const failed = await saveActivityWithPhoto({ ...saved }, { photo: "data:image/jpeg;base64,eA==", expected: saved });
  assert.equal(failed.ok, false);
  assert.equal(getActivityState().activities[0].photoId, saved.photoId);
});

// ---------------------------------------------------------------- spreadsheets
test("CSV escaping round-trips any leading apostrophes and formula characters", () => {
  for (const s of ["=1+1", "'=1+1", "''@x", "'hello", "-5 reps", "+", "'", "", "plain", "\tTab", "it's"]) {
    assert.equal(unescapeFormula(escapeFormula(s)), s, JSON.stringify(s));
    assert.ok(!/^[=+\-@\t\r]/.test(escapeFormula(s)), `still formula-like: ${s}`);
  }
});

const newFields = [
  run({ id: "h", type: "hike", miles: 6.2, duration: "", intensity: "unknown", notes: "'=quoted", title: "'apostrophe" }),
  run({ id: "s", type: "strength", miles: "", duration: "", intensity: "unknown", title: "Legs" }),
  run({ id: "p", date: "2026-12-01", status: "planned", miles: 3, duration: 30 }),
  run({ id: "m", movingMinutes: 25, elapsedMinutes: 26.5, source: "strava", sourceId: "9" }),
  run({ id: "u", date: "2026-12-02", needsReview: ["status"] }),
];

test("CSV round trip keeps hike, strength, planned, unknown effort, moving/elapsed and unconfirmed status", () => {
  const { accepted, rejected } = csvResultsToActivities(Papa.parse(activitiesToCSV(newFields), { header: true, skipEmptyLines: true }));
  assert.deepEqual(rejected, []);
  const byId = Object.fromEntries(accepted.map((a) => [a.id, a]));
  assert.equal(byId.h.type, "hike");
  assert.equal(byId.h.notes, "'=quoted");
  assert.equal(byId.h.title, "'apostrophe");
  assert.equal(byId.s.type, "strength");
  assert.equal(byId.p.status, "planned");
  assert.equal(byId.h.intensity, "unknown");
  assert.equal(byId.m.movingMinutes, 25);
  assert.equal(byId.m.elapsedMinutes, 26.5);
  assert.deepEqual(byId.u.needsReview, ["status"]); // still not guessed
});

test("Excel (SheetJS 0.20.3) round trip matches the CSV path", () => {
  const bytes = activitiesToWorkbook(XLSX, newFields);
  const { rows, sheetName } = workbookToRows(XLSX, bytes);
  assert.equal(sheetName, "Activities");
  const fromExcel = rowsToActivities(rows);
  const fromCsv = csvResultsToActivities(Papa.parse(activitiesToCSV(newFields), { header: true, skipEmptyLines: true }));
  assert.deepEqual(fromExcel.rejected, []);
  const strip = (list) => list.map(({ id, type, status, intensity, miles, duration, notes, title, movingMinutes }) => ({ id, type, status, intensity, miles, duration, notes, title, movingMinutes }));
  assert.deepEqual(strip(fromExcel.accepted), strip(fromCsv.accepted));
  assert.equal(XLSX.version, "0.20.3");
});

test("rows without ids that match existing activities are flagged, not merged", () => {
  initActivityStore({ storage: fakeStorage(), media: fakeMedia() });
  saveActivity(run({ id: "existing", date: "2026-10-01", miles: 3, duration: 30 }));
  const { accepted, idlessIds } = rowsToActivities([
    { date: "2026-10-01", miles: "3", duration: "30", type: "run" },
    { date: "2026-10-02", miles: "3", duration: "30", type: "run" },
  ]);
  const { added, possible } = previewImport(accepted, idlessIds);
  assert.equal(added.length, 2);
  assert.equal(possible.length, 1);
  assert.equal(mergeImported(accepted, new Set(possible.map((a) => a.id))).added, 1);
  assert.equal(getActivityState().activities.length, 2);
});

test("blank intensity imports as unknown; future rows without status are flagged", () => {
  const { accepted, rejected } = rowsToActivities(
    [{ date: "2026-10-01", miles: "3" }, { date: "2026-12-01", miles: "3" }, { date: "2026-12-01", miles: "3", status: "completed" }],
    { today: "2026-11-01" }
  );
  assert.equal(accepted[0].intensity, "unknown");
  assert.deepEqual(accepted[1].needsReview, ["status"]);
  assert.match(rejected[0].errors[0], /future/);
});

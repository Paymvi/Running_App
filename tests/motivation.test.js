import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MOTIVATION_KEY,
  addsNewActiveDay,
  buildActiveDays,
  buildSky,
  celebrationFor,
  findStar,
  getMotivationSettings,
  setMotivationSettings,
} from "../src/utils/motivation.js";
import { SHAPES } from "../src/utils/constellationShapes.js";
import { BACKUP_KEYS, buildBackupFile, parseBackupFile, resetAllData, restoreBackupEntries, snapshotStorage } from "../src/utils/storage.js";
import { fakeMedia, fakeStorage, run } from "./helpers.js";

// One completed activity per day, starting 2026-01-01.
const day = (n) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);
const days = (count, over = {}) => Array.from({ length: count }, (_, i) => run({ id: `d${i}`, date: day(i), ...over }));
const strength = (over = {}) => run({ type: "strength", intensity: "unknown", miles: "", duration: "", ...over });

test("shapes: every constellation has 12 stars and lines between real points", () => {
  for (const s of SHAPES) {
    assert.equal(s.points.length, 12, s.name);
    for (const [a, b] of s.lines) assert.ok(a >= 0 && a < 12 && b >= 0 && b < 12 && a !== b, `${s.name} ${a}-${b}`);
  }
  assert.equal(SHAPES[0].name, "Heron");
});

test("one star per calendar day, whatever the number or types of activities", () => {
  const list = [
    run({ id: "am", date: "2026-03-02", time: "07:00" }),
    run({ id: "pm", type: "bike", date: "2026-03-02", time: "18:00" }),
    strength({ id: "lift", date: "2026-03-02", time: "" }),
    run({ id: "next", date: "2026-03-03" }),
  ];
  const result = buildActiveDays(list);
  assert.deepEqual(result.map((d) => d.date), ["2026-03-02", "2026-03-03"]);
  assert.deepEqual(result[0].activities.map((a) => a.id), ["lift", "am", "pm"]); // untimed first, then by time
  assert.equal(buildSky(list).current.stars.length, 2);
});

test("legacy M/D/YYYY dates join the same day as YYYY-MM-DD", () => {
  assert.equal(buildActiveDays([run({ date: "3/2/2026" }), run({ date: "2026-03-02" })]).length, 1);
});

test("strength with no distance or duration counts; any type counts", () => {
  const list = [strength({ date: "2026-03-01" }), run({ type: "swim", date: "2026-03-02" }), run({ type: "hike", intensity: "unknown", date: "2026-03-03" })];
  assert.equal(buildActiveDays(list).length, 3);
});

test("planned, unconfirmed and under-review activities never count", () => {
  const list = [
    run({ status: "planned", date: "2026-03-01" }),
    run({ needsReview: ["status"], date: "2026-03-02" }),
    run({ needsReview: ["miles"], date: "2026-03-03" }),
    run({ date: "2026-02-31" }), // not a real date
    strength({ status: "planned", date: "2026-03-04" }),
  ];
  assert.equal(buildActiveDays(list).length, 0);
  // A non-data review flag (e.g. a note field) doesn't block the day.
  assert.equal(buildActiveDays([run({ needsReview: ["feel"] })]).length, 1);
});

test("day colour: first type in Velo's order, so a run + strength day is a run star", () => {
  const [d] = buildActiveDays([strength({ id: "s", date: "2026-03-01" }), run({ id: "r", date: "2026-03-01", time: "20:00" })]);
  assert.equal(d.type, "run");
  assert.equal(buildActiveDays([strength({ date: "2026-03-01" }), run({ type: "swim", date: "2026-03-01" })])[0].type, "swim");
});

test("sky: 12 stars per constellation, 4 constellations per season sky", () => {
  let sky = buildSky([]);
  assert.equal(sky.current.shape.name, "Heron");
  assert.equal(sky.current.stars.length, 0);
  assert.equal(sky.skies.length, 0);

  sky = buildSky(days(8));
  assert.equal(sky.current.stars.length, 8);
  assert.equal(sky.completedConstellations, 0);

  sky = buildSky(days(12)); // Heron done; Kite starts empty, Heron dimmed beside it
  assert.equal(sky.completedConstellations, 1);
  assert.equal(sky.current.shape.name, "Kite");
  assert.equal(sky.current.stars.length, 0);
  assert.deepEqual(sky.currentSky.map((c) => c.shape.name), ["Heron"]);
  assert.equal(sky.skies.length, 1);
  assert.equal(sky.skies[0].complete, false);

  sky = buildSky(days(50)); // sky 1 complete; sky 2 has 2 stars of its first constellation
  assert.equal(sky.completedConstellations, 4);
  assert.equal(sky.completedSkies, 1);
  assert.equal(sky.skyIndex, 1);
  assert.equal(sky.current.shape.name, "Whale");
  assert.equal(sky.current.stars.length, 2);
  assert.deepEqual(sky.currentSky, []);
  assert.deepEqual(sky.skies[0].constellations.map((c) => c.shape.name), ["Heron", "Kite", "Teapot", "Fox"]);
  assert.equal(sky.skies[0].firstDate, day(0));
  assert.equal(sky.skies[0].lastDate, day(47));

  sky = buildSky(days(48)); // exactly one full sky: the new one isn't listed until it has a star
  assert.equal(sky.skies.length, 1);
  assert.equal(sky.current.stars.length, 0);
});

test("history recomputes: deletes, edits, backdating and rest never strand or duplicate stars", () => {
  const list = days(12);
  assert.equal(buildSky(list).completedConstellations, 1);

  // Deleting a day's only activity removes that star; the Heron is no longer complete.
  const deleted = list.filter((a) => a.id !== "d5");
  assert.equal(buildSky(deleted).current.stars.length, 11);

  // Editing it to Planned does the same; editing it back restores it.
  const planned = list.map((a) => (a.id === "d5" ? { ...a, status: "planned" } : a));
  assert.equal(buildSky(planned).completedConstellations, 0);
  assert.equal(buildSky(planned.map((a) => ({ ...a, status: "completed" }))).completedConstellations, 1);

  // A backdated activity becomes star 1 and shifts the rest along.
  const sky = buildSky([...list, strength({ id: "back", date: "2025-12-01" })]);
  assert.equal(sky.days[0].date, "2025-12-01");
  assert.equal(sky.current.stars.length, 1);
  assert.equal(sky.current.stars[0].date, day(11));

  // Importing many activities on already-counted days changes nothing.
  const dupes = list.map((a) => ({ ...a, id: `${a.id}-imported`, source: "strava", intensity: "unknown" }));
  assert.equal(buildSky([...list, ...dupes]).days.length, 12);

  // A long gap is just a gap: no star is removed for rest.
  const gap = [...days(3), run({ id: "later", date: "2026-09-01" })];
  assert.equal(buildSky(gap).current.stars.length, 4);
});

test("findStar locates the constellation and index of an activity's day", () => {
  const list = [...days(14), run({ id: "second", date: day(13), time: "19:00" })];
  const found = findStar(buildSky(list), "second");
  assert.equal(found.constellation.shape.name, "Kite");
  assert.equal(found.starIndex, 1);
  assert.equal(findStar(buildSky(list), "nope"), null);
});

test("celebration: only a new activity on an uncounted day, for the visible chosen module", () => {
  const existing = [run({ id: "a", date: "2026-03-01" })];
  const stars = { module: "constellations", hidden: false };
  const created = (id) => ({ created: true, id });

  assert.equal(celebrationFor(created("n"), strength({ date: "2026-03-02" }), existing, stars), "constellations");
  // Second activity the same day: no new star, no celebration.
  assert.equal(celebrationFor(created("n"), strength({ date: "2026-03-01" }), existing, stars), null);
  // Edits (not created), plans, hidden section: never.
  assert.equal(celebrationFor({ created: false, id: "a" }, run({ id: "a", date: "2026-03-05" }), existing, stars), null);
  assert.equal(celebrationFor(created("n"), run({ status: "planned", date: "2026-03-09" }), existing, stars), null);
  assert.equal(celebrationFor(created("n"), run({ date: "2026-03-02" }), existing, { ...stars, hidden: true }), null);
  // The list may already hold the saved record; it's excluded by id.
  assert.equal(addsNewActiveDay(run({ id: "n", date: "2026-03-02" }), [...existing, run({ id: "n", date: "2026-03-02" })]), true);

  // Jar keeps its rule: easy runs celebrate even on a day that already has activity; strength doesn't.
  const jar = { module: "jar", hidden: false };
  assert.equal(celebrationFor(created("n"), run({ date: "2026-03-01" }), existing, jar), "jar");
  assert.equal(celebrationFor(created("n"), strength({ date: "2026-03-02" }), existing, jar), null);
  assert.equal(celebrationFor(created("n"), run({ intensity: "tempo", date: "2026-03-02" }), existing, jar), null);
});

test("settings: defaults keep the jar; bad values fall back; failed writes report", () => {
  assert.deepEqual(getMotivationSettings(fakeStorage()), { module: "jar", hidden: false, animations: true, starColors: "type" });
  assert.deepEqual(
    getMotivationSettings(fakeStorage({ [MOTIVATION_KEY]: '{"module":"garden","hidden":"yes","animations":false,"starColors":"pink"}' })),
    { module: "jar", hidden: false, animations: false, starColors: "type" },
  );
  for (const raw of ["{broken", '"text"', "[1]", "null"]) {
    assert.equal(getMotivationSettings(fakeStorage({ [MOTIVATION_KEY]: raw })).module, "jar", raw);
  }

  const storage = fakeStorage();
  const chosen = { module: "constellations", hidden: false, animations: false, starColors: "white" };
  assert.equal(setMotivationSettings(chosen, storage), null);
  assert.deepEqual(getMotivationSettings(storage), chosen);

  storage.failWrites = true;
  assert.match(setMotivationSettings({ ...chosen, hidden: true }, storage), /storage is full/);
  assert.equal(getMotivationSettings(storage).hidden, false);
});

test("settings are in backup files, restored, cleared by restore of an older backup, and reset", async () => {
  assert.ok(BACKUP_KEYS.includes(MOTIVATION_KEY));
  const source = fakeStorage();
  setMotivationSettings({ module: "constellations", hidden: true, animations: true, starColors: "white" }, source);

  const parsed = parseBackupFile(buildBackupFile(snapshotStorage(source)));
  assert.equal(parsed.error, undefined);
  const target = fakeStorage();
  restoreBackupEntries(parsed.entries, target);
  assert.deepEqual(getMotivationSettings(target), getMotivationSettings(source));

  // A backup made before this setting existed restores the default (jar, shown).
  restoreBackupEntries(parseBackupFile(buildBackupFile({ activities: "[]" })).entries, target);
  assert.equal(target.getItem(MOTIVATION_KEY), null);
  assert.equal(getMotivationSettings(target).module, "jar");

  setMotivationSettings({ module: "constellations" }, target);
  await resetAllData(target, fakeMedia());
  assert.equal(target.getItem(MOTIVATION_KEY), null);
});

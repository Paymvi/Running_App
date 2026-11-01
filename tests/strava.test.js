import { test } from "node:test";
import assert from "node:assert/strict";
import { stravaActivityToVelo, mapStravaTypeToYourType } from "../src/utils/stravaHelpers.js";
import { collectStravaPages, mapStravaActivities } from "../src/utils/stravaClient.js";
import { partitionImport } from "../src/utils/activityStore.js";

const s = (over = {}) => ({
  id: 123, name: "Lunch Run", sport_type: "Run", start_date_local: "2026-03-05T12:34:56Z",
  distance: 5000, moving_time: 1500, elapsed_time: 1590, total_elevation_gain: 30, ...over,
});

test("Strava mapping keeps provider identity and precision (F26)", () => {
  const a = stravaActivityToVelo(s());
  assert.equal(a.source, "strava");
  assert.equal(a.sourceId, "123");
  assert.equal(a.date, "2026-03-05");
  assert.equal(a.time, "12:34");
  assert.equal(a.miles, 3.11);
  assert.equal(a.duration, 25); // runs use moving time, not rounded to whole minutes
  assert.equal(a.movingMinutes, 25);
  assert.equal(a.elapsedMinutes, 26.5);
  assert.equal(a.intensity, "unknown"); // never assumed easy
  assert.equal(a.elevationGainFt, 98);
});

test("unsupported sports are not counted as runs", () => {
  assert.equal(mapStravaTypeToYourType("Walk"), null);
  assert.equal(mapStravaTypeToYourType("Hike"), "hike");
  assert.equal(mapStravaTypeToYourType("TrailRun"), "run");
  assert.equal(mapStravaTypeToYourType("GravelRide"), "bike");
  assert.equal(mapStravaTypeToYourType("WeightTraining"), "strength");
  assert.equal(mapStravaTypeToYourType("Crossfit"), "workout");
  // Other sports keep elapsed time as their duration.
  assert.equal(stravaActivityToVelo(s({ sport_type: "Ride" })).duration, 26.5);
  const { activities, unsupported } = mapStravaActivities([s(), s({ id: 2, sport_type: "Walk" })]);
  assert.equal(activities.length, 1);
  assert.deepEqual(unsupported, { Walk: 1 });
});

test("re-importing Strava skips activities already imported", () => {
  const first = stravaActivityToVelo(s());
  const again = stravaActivityToVelo(s()); // new local id, same Strava id
  assert.deepEqual(partitionImport([again], [first]), { added: [], duplicates: 1 });
});

test("pagination continues past 200 and stops on a short page (F27)", async () => {
  const pages = { 1: 200, 2: 200, 3: 7 };
  const calls = [];
  const { raw, error } = await collectStravaPages(async (page) => {
    calls.push(page);
    return { ok: true, status: 200, data: { activities: Array.from({ length: pages[page] || 0 }, (_, i) => s({ id: page * 1000 + i })) } };
  });
  assert.equal(error, undefined);
  assert.equal(raw.length, 407);
  assert.deepEqual(calls, [1, 2, 3]);
});

test("rate limiting keeps what was fetched and reports a partial import", async () => {
  const { raw, error, partial } = await collectStravaPages(async (page) =>
    page === 1
      ? { ok: true, status: 200, data: { activities: Array.from({ length: 200 }, (_, i) => s({ id: i })) } }
      : { ok: false, status: 429, data: {} }
  );
  assert.equal(raw.length, 200);
  assert.equal(partial, true);
  assert.match(error, /rate limit/i);
});

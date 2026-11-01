import { test } from "node:test";
import assert from "node:assert/strict";
import {
  KEYS,
  readActivities,
  writeKeysAtomically,
  snapshotStorage,
  buildBackupFile,
  parseBackupFile,
  restoreBackupEntries,
} from "../src/utils/storage.js";
import {
  initActivityStore,
  getActivityState,
  saveActivity,
  deleteActivity,
  mergeImported,
  previewImport,
} from "../src/utils/activityStore.js";
import { fakeStorage, run } from "./helpers.js";

test("corrupt or wrong-shaped saved data is reported, not parsed (F04)", () => {
  assert.equal(readActivities(fakeStorage({ activities: "{not json" })).error, "corrupt");
  assert.equal(readActivities(fakeStorage({ activities: '{"a":1}' })).error, "corrupt");
  assert.equal(readActivities(fakeStorage({ activities: "null" })).error, "corrupt");
  assert.deepEqual(readActivities(fakeStorage()).activities, []);
});

test("store refuses to write over unreadable data, leaving it intact", () => {
  const storage = fakeStorage({ activities: "{broken" });
  initActivityStore({ storage });
  assert.equal(getActivityState().loadError, "corrupt");
  const result = saveActivity(run());
  assert.equal(result.ok, false);
  assert.equal(storage.getItem(KEYS.activities), "{broken");
});

test("failed writes report an error and leave state and storage unchanged", () => {
  const original = run({ id: "keep" });
  const storage = fakeStorage({ activities: JSON.stringify([original]) });
  initActivityStore({ storage });
  storage.failWrites = true;

  const result = saveActivity(run({ id: "new" }));
  assert.equal(result.ok, false);
  assert.match(result.error, /storage is full/i);
  assert.deepEqual(getActivityState().activities.map((a) => a.id), ["keep"]);
  assert.deepEqual(JSON.parse(storage.getItem(KEYS.activities)).map((a) => a.id), ["keep"]);
});

test("save creates once, then edits in place; null ids get a real id (F35)", () => {
  const storage = fakeStorage();
  initActivityStore({ storage });
  const created = saveActivity({ ...run(), id: null });
  assert.equal(created.ok, true);
  assert.equal(created.created, true);
  assert.ok(created.id);

  const edited = saveActivity({ ...run(), id: created.id, title: "Edited" });
  assert.equal(edited.created, false);
  const stored = JSON.parse(storage.getItem(KEYS.activities));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].title, "Edited");
});

test("activities are kept newest first by date then time", () => {
  initActivityStore({ storage: fakeStorage() });
  saveActivity(run({ id: "a", date: "2026-01-01" }));
  saveActivity(run({ id: "c", date: "2026-03-01", time: "06:00" }));
  saveActivity(run({ id: "d", date: "2026-03-01", time: "18:00" }));
  saveActivity(run({ id: "b", date: "2026-02-01" }));
  assert.deepEqual(getActivityState().activities.map((a) => a.id), ["d", "c", "b", "a"]);
});

test("imports skip duplicates by id and provider id (F08)", () => {
  initActivityStore({ storage: fakeStorage() });
  saveActivity(run({ id: "x" }));
  saveActivity(run({ id: "s1", source: "strava", sourceId: "123" }));

  const incoming = [run({ id: "x" }), run({ id: "fresh", source: "strava", sourceId: "123" }), run({ id: "new" }), run({ id: "new" })];
  assert.deepEqual(previewImport(incoming), { added: [incoming[2]], duplicates: 3, possible: [] });

  const result = mergeImported(incoming);
  assert.equal(result.added, 1);
  assert.equal(mergeImported(incoming).added, 0); // re-importing changes nothing
  assert.equal(getActivityState().activities.length, 3);
});

test("a slow import merges into current state and cannot resurrect deletions (F09)", async () => {
  initActivityStore({ storage: fakeStorage() });
  saveActivity(run({ id: "a" }));
  saveActivity(run({ id: "b" }));

  // Import starts (parsing is async)...
  const pending = new Promise((resolve) => setTimeout(() => resolve([run({ id: "imported" })]), 5));
  // ...meanwhile the user deletes "a" and adds "c".
  deleteActivity("a");
  saveActivity(run({ id: "c" }));

  mergeImported(await pending);
  assert.deepEqual(getActivityState().activities.map((x) => x.id).sort(), ["b", "c", "imported"]);
});

test("multi-key writes roll back when one write fails", () => {
  const storage = fakeStorage({ a: "1", b: "2" });
  const realSet = storage.setItem.bind(storage);
  storage.setItem = (k, v) => {
    if (k === "c") throw new Error("boom");
    realSet(k, v);
  };
  assert.throws(() => writeKeysAtomically({ a: "changed", b: null, c: "3" }, storage));
  assert.deepEqual(storage.dump(), { a: "1", b: "2" });
});

test("backup file round trip restores every key and never includes the Strava token (F06)", () => {
  const photo = "data:image/jpeg;base64,AAAA";
  const source = fakeStorage({
    activities: JSON.stringify([run({ id: "p", photo, mode: "splits", splits: [{ mph: 6, distance: 1 }] })]),
    homeNoteCards: JSON.stringify([{ id: 1, title: "Notes 1", text: "a; b\nc" }]),
    profileName: "Me",
    strava_access_token: "secret-token",
  });
  const snapshot = snapshotStorage(source);
  assert.equal(snapshot.strava_access_token, undefined);

  const text = buildBackupFile(snapshot);
  assert.ok(!text.includes("secret-token"));

  const { entries, error } = parseBackupFile(text);
  assert.equal(error, undefined);
  const target = fakeStorage({ profileTag: "old tag", activities: "[]" });
  restoreBackupEntries(entries, target);
  assert.equal(target.getItem("profileName"), "Me");
  assert.equal(target.getItem("profileTag"), null); // not in backup -> cleared
  assert.equal(JSON.parse(target.getItem("activities"))[0].photo, photo);
  assert.equal(JSON.parse(target.getItem("homeNoteCards"))[0].text, "a; b\nc");
});

test("backup files with unexpected content are rejected", () => {
  assert.ok(parseBackupFile("nope").error);
  assert.ok(parseBackupFile(JSON.stringify({ format: "other" })).error);
  assert.ok(parseBackupFile(JSON.stringify({ format: "velo-backup", version: 1, keys: { evil: "x" } })).error);
  assert.ok(parseBackupFile(JSON.stringify({ format: "velo-backup", version: 1, keys: { activities: "{}" } })).error);
});

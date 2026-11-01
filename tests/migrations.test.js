import { test } from "node:test";
import assert from "node:assert/strict";
import { runMigrations, SCHEMA_VERSION } from "../src/utils/migrations.js";
import { KEYS } from "../src/utils/storage.js";
import { fakeStorage, fakeMedia } from "./helpers.js";

const legacy = [
  { id: "a", date: "3/5/2026", duration: "30:30", miles: "3", photo: "data:image/png;base64,QQ==" },
  { id: "b", date: "2026-02-31", miles: "3" }, // impossible date -> needs review, untouched
  null, // not an activity -> set aside
  { id: "a", date: "2026-01-01", miles: 1 }, // duplicate id
];

test("migration backs up the original data before writing, then normalizes", async () => {
  const raw = JSON.stringify(legacy);
  const storage = fakeStorage({ activities: raw, profileName: "Me", strava_access_token: "t" });
  const backups = [];
  const media = fakeMedia();

  const result = await runMigrations({
    storage,
    media,
    today: "2026-11-01",
    saveBackup: async (b) => {
      // At backup time nothing has been written yet.
      assert.equal(storage.getItem(KEYS.activities), raw);
      backups.push(b);
    },
  });

  assert.equal(result.status, "migrated");
  assert.equal(backups.length, 1);
  assert.equal(backups[0].entries.activities, raw);
  assert.equal(backups[0].entries.strava_access_token, undefined);

  const stored = JSON.parse(storage.getItem(KEYS.activities));
  assert.equal(stored.length, 3);
  assert.equal(stored[0].date, "2026-03-05");
  assert.equal(stored[0].legacy.date, "3/5/2026");
  // The photo moved to the photo store, unchanged, and the record points at it.
  assert.equal(stored[0].photo, undefined);
  assert.equal(stored[0].photoId, "legacy-a");
  assert.equal(media.map.get("legacy-a"), legacy[0].photo);
  assert.equal(result.photosMoved, 1);
  assert.deepEqual(stored[1].needsReview, ["date"]);
  assert.equal(stored[1].date, "2026-02-31");
  assert.notEqual(stored[2].id, "a");
  assert.equal(stored[2].legacy.id, "a");

  assert.deepEqual(JSON.parse(storage.getItem(KEYS.quarantine)), [{ index: 2, value: null, reason: "not an activity object" }]);
  assert.equal(storage.getItem(KEYS.schema), String(SCHEMA_VERSION));
  assert.equal(result.quarantined, 1);
  assert.equal(result.needsReview.length, 1);
});

test("if the backup cannot be saved, nothing is written", async () => {
  const raw = JSON.stringify(legacy);
  const storage = fakeStorage({ activities: raw });
  const media = fakeMedia();
  const result = await runMigrations({ storage, media, saveBackup: async () => { throw new Error("no idb"); } });
  assert.equal(result.status, "backup-failed");
  assert.equal(storage.getItem(KEYS.activities), raw);
  assert.equal(storage.getItem(KEYS.schema), null);
  assert.equal(media.map.size, 0); // photos not copied either
});

test("a failed write leaves the original data", async () => {
  const raw = JSON.stringify(legacy);
  const storage = fakeStorage({ activities: raw });
  storage.failWrites = true;
  const result = await runMigrations({ storage, media: fakeMedia(), saveBackup: async () => {} });
  assert.equal(result.status, "write-failed");
  assert.equal(storage.getItem(KEYS.activities), raw);
});

test("unreadable data is never migrated", async () => {
  const storage = fakeStorage({ activities: "{oops" });
  let backedUp = false;
  const result = await runMigrations({ storage, saveBackup: async () => { backedUp = true; } });
  assert.equal(result.status, "blocked");
  assert.equal(backedUp, false);
  assert.equal(storage.getItem(KEYS.activities), "{oops");
});

test("current or empty storage is left alone", async () => {
  const fresh = fakeStorage();
  assert.equal((await runMigrations({ storage: fresh, saveBackup: async () => {} })).status, "fresh");
  assert.equal((await runMigrations({ storage: fresh, saveBackup: async () => { throw new Error(); } })).status, "current");
});

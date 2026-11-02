# Audit repair log

This log tracks repairs made against the [Velo program audit dated November 1, 2026](PROGRAM_AUDIT.md). The audit is the baseline. Its findings and wording are unchanged. The questions that are still open are in [PENDING_DECISIONS.md](PENDING_DECISIONS.md).

- **Repair dates:** November 1, 2026 (two passes, both today).
  - **Pass 1** fixed clear defects and left product choices open.
  - **Pass 2** implemented your approved decisions (Hiking, units, plans, PRs, coaching, jars, Strava, photos, trash, reset, the Excel parser, CI) and finished the remaining technical repairs.
- **Starting point:** commit `37a8a8b` (main). The three audit files you added (`PROGRAM_AUDIT.md`, `audit-dependency-results.json`, `audit-lint-results.json`, all untracked) were not modified in content. At your request the Markdown files were later moved into `docs/` (README stays at the root), and only their link targets were adjusted so they still resolve. The two JSON files stayed at the root, and the git index was not changed. `public/vite.svg` is deleted in the working tree only.
- **Nothing was committed, pushed, deployed or published. No hosting was provisioned, and no real Strava account was used.**

## Status key

| Status | Meaning |
| --- | --- |
| **Fixed** | Resolved in code and verified. Anything left is small and listed. |
| **Partially fixed** | Everything that could be done here is done. A material part depends on something external (hosting) or on a decision you haven't made, and the exact limit is stated. |

## Summary

| ID | Status | Short description |
| --- | --- | --- |
| F01 | Fixed | Non-running history crash |
| F02 | Fixed | Split totals (now also in km) |
| F03 | Fixed | Entry validation: per-type rules, strength, plans |
| F04 | Fixed | Storage failures, including profile settings |
| F05 | Fixed | Photos moved to IndexedDB with a verified migration |
| F06 | Fixed | Complete backup (records + photos) vs spreadsheet |
| F07 | Fixed | Slash dates breaking export |
| F08 | Fixed | Duplicate imports, plus possible-duplicate warning |
| F09 | Fixed | Async imports and stale writes |
| F10 | Fixed | Import row validation and reporting |
| F11 | Fixed | Import rewriting note text |
| F12 | Fixed | Duration formats |
| F13 | Fixed | One shared whole-activity PR rule |
| F14 | Fixed | Date shifting |
| F15 | Fixed | Impossible dates |
| F16 | Fixed | Week and percentage definitions |
| F17 | Fixed | `5:60` rounding |
| F18 | Fixed | Monthly comparisons |
| F19 | Fixed | Jar completion and rollover |
| F20 | Fixed | Jar celebration events |
| F21 | Fixed | Tokens out of URLs and browser storage |
| F22 | Fixed | OAuth state validation |
| F23 | Fixed | Server loading `server/.env` |
| F24 | Partially fixed | Deployment: needs a host (external prerequisite) |
| F25 | Fixed | Token expiry, refresh, scope, disconnect |
| F26 | Fixed | Strava conversion (moving time, unknown effort, Hiking) |
| F27 | Fixed | Strava 200-activity limit |
| F28 | Partially fixed | Server controls: persistent sessions and rate limiting wait on hosting |
| F29 | Fixed | Dependency advisories (SheetJS 0.20.3) |
| F30 | Fixed | CSV formula injection, now with exact text round trip |
| F31 | Fixed | Coach reading a missing `mph` field |
| F32 | Fixed | Intervals counted as hard |
| F33 | Fixed | Coach time windows (as of today, same-days comparisons) |
| F34 | Fixed | Alert count bound |
| F35 | Fixed | Single add/save path |
| F36 | Fixed | No page reload on save |
| F37 | Fixed | Dialogs: inert background, nested-safe focus handling |
| F38 | Fixed | Keyboard controls and a chart data table |
| F39 | Fixed | Weekly chart targets and scrolling |
| F40 | Fixed | Bounded heatmap and history ranges |
| F41 | Fixed | Wrong card expanded after filtering |
| F42 | Fixed | Bundle size and lazy loading |
| F43 | Fixed | Personal data in console logs |
| F44 | Fixed | Motion, sound and vibration preferences |
| F45 | Fixed | UI text and actions (name, flag, favicon, export format) |
| F46 | Fixed | Notes Replace/Append, exact export, pending saves |
| F47 | Fixed | Lint |
| F48 | Fixed | Tests and CI workflow |
| F49 | Fixed | Duplicated rules consolidated |
| F50 | Partially fixed | Trash, undo, reset, backups done; sync is undecided |
| F51 | Fixed | Setup and operating docs |

**Totals:** 48 fixed, 3 partially fixed, 0 deferred.

## Verification results

All of these were run on November 1, 2026, after the last code change.

| Check | Before (audit) | After pass 1 | After pass 2 (now) |
| --- | --- | --- | --- |
| `npm run build` | Passed; one 837 kB chunk, size warning | Passed; initial JS 312 kB | **Passed.** Initial JS 326.6 kB (106.8 kB gzip). Pages, papaparse (19 kB) and SheetJS (500 kB) load on demand. No warning. |
| `npm run lint` | 39 errors, 3 warnings | 0 / 0 | **0 errors, 0 warnings** |
| `npm test` | No tests | 61 pass | **96 tests in 9 files: 96 pass, 0 fail** |
| `npm audit` | 27 entries (1 critical, 15 high) | 7 (1 high: `xlsx`) | **6 moderate, 0 high, 0 critical.** All six are ESLint's `minimatch` chain (development tooling, not shipped). Saved in [audit-dependency-results-after-repair.json](../audit-dependency-results-after-repair.json). |
| Browser smoke (`tests/browser-smoke.js`) | Not performed | 31 / 31 | **54 of 54 checks pass** on two runs after the mobile layout fix (see [Mobile layout regression](#mobile-layout-regression-after-pass-2)), with no uncaught exceptions or console errors. Headless Chrome, `vite preview` of the production build, synthetic data, throwaway profile. |
| `npm ci` (clean install) | Not run | Not run | **Passed** (240 packages added). `package-lock.json` hash unchanged. Every check above was rerun on this install. |

What the browser smoke run covers:
- **Upgrade from the original format to v2:**
  - the automatic backup is saved first, with inline photos, and no token;
  - the photo moves to IndexedDB unchanged and is displayed from there;
  - the future-dated record is flagged "Planned or done?";
  - slash dates, splits and the impossible-date flag are handled as before.
- **Add dialog:**
  - the background (tab bar, floating button) is `inert`;
  - Tab and Shift+Tab stay inside the dialog for 40 presses;
  - a real 3000×2000 PNG is resized in the browser to a 1280×853 JPEG, which is saved to IndexedDB, not localStorage.
- **Pending note edits (F46):** the test types real keystrokes into a note and then leaves Home within the 400 ms save delay, in two ways:
  - by switching tabs, which unmounts Home;
  - by navigating the whole page, which fires `pagehide`.

  Each time it checks two things: the stored text was still the old value just before leaving, and afterwards it exactly matches the text shown in the box.

  To confirm the test detects the bug, saving on leave was temporarily disabled in `Home.jsx` and the build rerun. Both checks then failed and the typed text was lost. The file was then restored and its hash verified.
- **Saving and editing:** validation keeps your input, there's no reload on save, and the jar celebration shows on create but not on edit.
- **Trash:** delete moves the activity to Recently deleted, and Undo restores it.
- **Layout and settings:**
  - the Export format choice sits next to Export;
  - the km preference changes only the display;
  - the Strava dialog works with no server running.
- **Profile:** PRs are labelled "Whole-activity", there's no flag, and the title and icon are Velo.
- **Weekly chart:** the data table has rows and a caption.
- **Phone width:** at 320 px with mobile emulation, Home, Activity and Profile are no wider than the screen, and the "+" button and tab bar are on screen and clickable (not covered).
- **Bike-only history** renders.
- **Reset:**
  - stays disabled until RESET is typed;
  - removes data and photos;
  - keeps the backup it saved first.
- **Corrupt storage:** saving is refused and the data is left untouched.

**Clean install (`npm ci`):**
- **Earlier problem:** a leftover `vite preview` from the repair session (with its `esbuild.exe` child) locked a file in `node_modules`, so a clean install couldn't run.
- **Fix:** both processes were identified by their command lines, which pointed at the Velo folder and port 4173, and stopped. Other projects' `vite` servers were left running.
- **Result:** `npm ci` then succeeded with the lockfile unchanged, and every check in the table was rerun on that install.
- **Cleanup:** the preview server and headless browser used for the smoke runs were stopped afterwards.

**Not verified:**
- real phones, iOS Safari or Firefox;
- screen readers;
- live Strava authorization (Strava is mocked in tests);
- any deployed host;
- the GitHub Actions run, since nothing was pushed;
- **your real browser data**, which this session cannot access and did **not** back up.

## What remains on the three partially fixed findings

| ID | Done | What remains, exactly | Blocked by |
| --- | --- | --- | --- |
| **F24** Strava hardcoded to localhost | `VITE_API_URL` setting, a message when the server can't be reached, hosting steps documented | An always-on HTTPS host for `server/` on the **same site** as the frontend (needed for the `SameSite=Lax` cookie). `FRONTEND_URL` and `STRAVA_REDIRECT_URI` set to production URLs, the callback domain registered in Strava's app settings, and the frontend rebuilt with the production `VITE_API_URL`. | Hosting (external, not approved) |
| **F28** Server operational controls | Input validation, timeouts, status mapping, logs without sensitive data, `/health`, graceful shutdown, config check at start | A **persistent session store** (sessions are in memory, so a restart signs you out and only one process works) and **rate limiting** on `/auth` and `/api`. Both are needed before anyone other than you uses the server. | Choice of host (F24) |
| **F50** Recovery, sync and deletion | Trash with undo, reset with backup first, backups that include photos, retention, cross-tab sync, stale-write refusal | Sync between phone and laptop, accounts and offline use: data stays in one browser, and backup files are the only way to move it. | Your undecided product choice |

## Mobile layout regression (after pass 2)

**Symptom you reported:** on a phone the "+" (Add activity) button was sometimes off screen, the tab bar sometimes missing, and the app no longer fit without zooming out.

**Reference version:** `37a8a8b` (the commit before the repair commit `1e01d82`). It was built in a temporary worktree and measured side by side with the current build in headless Chrome with mobile emulation.

**Cause 1: the Activity toolbar became wider than the phone.**
- The repairs added a **Backup** button and an **Excel/CSV** dropdown to the Activity toolbar (`.controls-row`). That row is a flex row that never wrapped, so it grew to 443 px.
- A phone browser handles content wider than the screen by widening the whole layout viewport to fit it (443 px instead of 320–430). Fixed elements are positioned against that viewport, which is now wider and proportionally taller than the screen. So the "+" button and tab bar landed off the right and bottom edges, and zooming out was the only way to reach them.
- This happened only on Activity. Leaving it could look "sometimes" because the other pages fit.
- **Measured before the fix:** Activity was 443 px wide at 320, 360, 390, 412 and 430 px. The "+" button was outside the screen at 320–412 px, and the tab bar was outside at every one of those widths. Home and Profile fit, as they did in `37a8a8b`.
- **Fix:** `.controls-row` wraps (`flex-wrap: wrap`), with a 0 row gap because the buttons already have a bottom margin. On desktop the toolbar is still one row. The dropdown also got the buttons' bottom margin so it lines up with Export.

**Cause 2: several dialogs could be taller than the screen.**
- Calendar settings, Strava (which is taller since the repairs), coach help and Edit profile had no height cap. When the screen was too short, the centered dialog spilled past both edges. Its close (✕) button ended up above the top of the screen and Done/Got it below the bottom, and neither could be scrolled to.
- This showed at 360×480, 740×360 (landscape), and for coach help even at 320–430×740.
- **Fix:** these dialogs now use the same pattern Backup, Filters and Past jars already used: `max-height: 85dvh` (`85vh` as a fallback), with scrolling inside the dialog. `dvh` excludes the mobile browser toolbars. Backup and Filters are now in the same rule. `.backup-modal` was folded into it, since every Backup dialog is also a `.strava-modal`.

**Checked and found not to be causes:**
- viewport metadata, which is unchanged (`width=device-width, initial-scale=1.0`, with zoom not restricted);
- `.tabbar` and `.floating-btn` rules, which are unchanged;
- ancestor transforms;
- the removed duplicate `.modal-overlay` rule, which was identical to the one kept;
- dialog scroll lock and `inert`, which were cleared after every close in every case tested, with the scroll position kept;
- the new chart data table, which fits when opened.

**Changed files:**
- `src/App.css`: `.controls-row`, `.export-format`, and the dialog height rule that replaces `.backup-modal`;
- `src/components/CoachHelpModal.jsx`: the same height cap, since its styles are inline;
- `tests/browser-smoke.js`: new section 6c. It replaces the old width check, which looked only at Profile in a 420 px desktop-mode window and so never saw Activity.

**Verified (headless Chrome, mobile emulation, throwaway profile, synthetic data with 40 activities, long titles, long notes with an unbroken word and URL):**
- **Sizes:** 320, 360, 390, 412 and 430 px wide at 740 px tall, plus 360×480 (short), 740×360 (landscape) and 1280×800 (desktop). For each size:
  - Home, Activity and Profile, at the top and scrolled to the bottom;
  - the page is no wider than the screen;
  - the "+" button and tab bar are fully on screen and are the topmost element at their centre, so they're clickable. On Activity in `37a8a8b` the "+" button failed this check: part of the page covered it.
- **Units:** repeated in kilometers at 320, 360, 360×480, 740×360 and 1280×800.
- **Dialogs:** Add activity, edit activity, notes settings, calendar settings, Backup, Strava, Filters, coach help, Edit profile and Past jars, at 320×740, 360×480, 430×740, 740×360 and 1280×800, in miles and kilometers. Each one was opened from a scrolled page and then checked:
  - the dialog is within the screen width;
  - every button and field can be scrolled into view and clicked;
  - Escape closes it;
  - afterwards scrolling is unlocked, nothing is left `inert`, the scroll position is unchanged, and the "+" button and tab bar are back on screen.
- **Other states:**
  - the weekly chart's data table, opened, at 320×568 and 740×360;
  - empty history on all three pages at 320×568.
- **Comparison:** screenshots of `37a8a8b`, the build before the fix and the build after it, at matching sizes. Apart from the wrapped toolbar on narrow phones, the fixed build matches the earlier layout.
- **New smoke check:** to confirm section 6c detects the bug, the wrap fix was temporarily removed. The Activity check then failed (443/320, "+" and tab bar off screen). The file was restored and its hash verified.

**Not verified, so check on a real phone:**
- iOS Safari and Android Chrome, with their collapsing toolbars and the home-indicator safe area;
- pinch-zoom in and back out;
- rotating while a dialog is open;
- the on-screen keyboard covering fields in the Add activity dialog.

Emulation sets the viewport size, but it doesn't reproduce real browser toolbars or the on-screen keyboard.

---

## Data safety and migrations

### Schema v2 (this pass)

Runs once, on the first load of this version, in [src/utils/migrations.js](../src/utils/migrations.js). If you never opened the pass-1 version, v1 and v2 are applied together with **one** backup.

1. Read the stored activities. If they can't be parsed, nothing is written and the recovery banner appears.
2. Transform in memory:
   - each inline photo (`photo`, a data URL) becomes `photoId: "legacy-<activity id>"`;
   - records dated after the upgrade day that have no `status` get `needsReview: ["status"]`.
3. Validate: no records lost, no photos lost, and the output survives a JSON round trip.
4. Save an automatic backup to IndexedDB (`velo-backups`). It holds every Velo localStorage key **as it was**, with photos still inline, plus any photos already in the photo store.
   - **If this fails, stop.** Nothing is changed and a banner explains it.
5. Copy the photos to IndexedDB (`velo-media`), then **read every one back and compare it exactly**.
   - **If any copy is missing or different, stop.** The activities in localStorage are not touched.
6. Write the new activity list and schema number to localStorage in one rollback-on-failure step.
   - If this fails, the copied photos remain unreferenced. They are harmless, and the next attempt reuses the same ids.

**Not atomic across stores.** localStorage and IndexedDB can't be written in one transaction. The order (backup → photos → records) means any interruption leaves either the original data or unreferenced extra photos, never records pointing at missing photos.

**Nothing guessed or discarded:**
- Unreadable values stay as stored and are flagged.
- Non-objects are set aside in `activities_quarantine`.
- Future-dated legacy records aren't counted as completed or as planned until you choose.
- Legacy Strava imports keep their stored `easy` intensity and elapsed-time duration (see F26).

### Other multi-store operations

| Operation | Order | If it fails part-way |
| --- | --- | --- |
| Save with a new photo | Store photo → save record → delete replaced photo | Record unchanged; the new photo is deleted again (or left unreferenced) |
| Restore backup file | Automatic backup → store and verify photos → write all keys | Current records unchanged; extra photos unreferenced |
| Purge from trash | Remove records → delete their photos | Records gone; a photo may remain unreferenced (Reset removes it) |
| Reset | Automatic backup → disconnect Strava (best effort) → remove all Velo keys → clear photos | Keys removed but photos left: unreferenced, harmless |

### Retention

- **Recently deleted:** 30 days, then purged when the app loads. "Delete forever" and "Empty Recently deleted" purge at once.
- **Automatic backups:** every pre-upgrade backup is kept, plus the 10 newest others (Delete All, restore, reset). Older ones are pruned only *after* a new backup has been committed. Each backup includes the photos, which is why the count is capped.

---

## Findings

### F01: Non-running history crashes Activity · **Fixed**
- **Changed:** The coach analyzes only completed, dated runs and returns "Log your first run" when there are none.
- **Files:** [src/utils/coachAlert.js](../src/utils/coachAlert.js)
- **Verified:** `tests/coach.test.js` (bike, swim, workout, empty and null histories). Browser smoke: a bike-only history renders.

### F02: Split mode never computes totals · **Fixed**
- **Changed:**
  - Shared `computeSplitTotals`: miles = Σ distance, minutes = Σ (distance ÷ speed × 60).
  - Invalid rows are rejected, and saving always recomputes the totals.
  - The dialog shows a live total, and the migration fills in missing legacy totals.
  - Splits round-trip through spreadsheets.
  - **New:** with the km preference, splits are typed in km/h and km and stored as mph and miles. Splits you don't edit keep their exact stored values.
- **Files:** [src/utils/activityModel.js](../src/utils/activityModel.js), [src/components/AddActivityModal.jsx](../src/components/AddActivityModal.jsx), [src/utils/importHelpers.js](../src/utils/importHelpers.js)
- **Verified:**
  - `tests/activityModel.test.js`
  - `tests/approved.test.js` ("km splits store mph and miles")
  - `tests/importExport.test.js`
- **Left:** No pace-based split entry and no split reordering. Neither was requested.

### F03: Manual entry accepts invalid records · **Fixed**
- **Changed:** One validator ([activityModel.js](../src/utils/activityModel.js)) with your approved rules:
  - **Types:** run, bike, swim, **hike**, workout, **strength**.
  - **Every type except strength** needs a distance or a duration. Distance-only is valid, and its pace shows "-", not 0.
  - **Strength** may omit both. Because it's its own type, a run can never be saved empty.
  - **Status** is Completed or Planned and must be chosen. A **completed** activity can't be dated after today; a **planned** one can.
  - Intensity includes **Effort unknown**.
  - Errors show next to each field, focus moves to the first one, and your input is kept.
- **Files:** [src/utils/activityModel.js](../src/utils/activityModel.js), [src/components/AddActivityModal.jsx](../src/components/AddActivityModal.jsx)
- **Verified:**
  - `tests/approved.test.js`: distance-only runs, strength with nothing, empty runs rejected, status rules.
  - Browser smoke: a blank save is rejected and the input kept.

### F04: Storage failures and corrupt data unhandled · **Fixed**
- **Changed (pass 1):**
  - One activity store that writes before it updates the screen.
  - Corrupt-data detection with recovery.
  - An unavailable-storage banner.
  - Multi-key writes that roll back on failure.
  - Visible errors for notes saves.
- **Changed (pass 2):**
  - **Profile settings:**
    - The tag and weekly-scale selects change only when the value was saved; otherwise "Not saved: …" is shown.
    - A name that fails to save stays on screen with "Name not saved: …" in the Edit dialog and on Profile.
    - The units and sound/vibration toggles report failures the same way.
  - The coach-alert setting, now persisted, reports failure.
  - Photo-store (IndexedDB) failures are shown on save ("The photo couldn't be saved… Nothing was changed"), on display ("Photo couldn't be loaded"), and during upgrade (banner).
- **Files:** [src/pages/Profile.jsx](../src/pages/Profile.jsx), [src/components/profile/EditProfileModal.jsx](../src/components/profile/EditProfileModal.jsx), [src/pages/Activity.jsx](../src/pages/Activity.jsx), [src/utils/activityStore.js](../src/utils/activityStore.js), [src/hooks/usePhoto.js](../src/hooks/usePhoto.js), [src/components/StorageBanner.jsx](../src/components/StorageBanner.jsx)
- **Verified:**
  - `tests/storage.test.js` and `tests/approved.test.js` ("a failed trash write changes nothing", "photo store full: nothing changes", "if photos can't be stored, records are not touched").
  - Browser smoke: corrupt storage.
- **Left:** Calendar display settings (`calendar_settings_v1`) still fall back silently to in-memory values if storage refuses them. They are cosmetic and outside the listed settings.

### F05: Media can exhaust storage · **Fixed**
- **Changed:**
  - **Activity photos live in IndexedDB** (`velo-media`). Activities keep only a `photoId`, so saving an activity no longer rewrites any image data.
  - Uploads are images only, are resized to at most 1280 px JPEG, and originals are not kept.
  - **Existing photos** are moved by the verified, backed-up v2 migration described above.
  - Missing or undecodable photos show a visible message on the card and in the editor.
  - Photos are included in the backup file, automatic backups, restore and reset.
  - The avatar stays in localStorage. It is a single image resized to 512 px.
- **Files:** [src/utils/media.js](../src/utils/media.js), [src/utils/idb.js](../src/utils/idb.js), [src/utils/migrations.js](../src/utils/migrations.js), [src/utils/activityStore.js](../src/utils/activityStore.js), [src/hooks/usePhoto.js](../src/hooks/usePhoto.js), [src/components/AddActivityModal.jsx](../src/components/AddActivityModal.jsx), [src/components/ActivityCard.jsx](../src/components/ActivityCard.jsx), [src/utils/image.js](../src/utils/image.js)
- **Verified:**
  - `tests/migrations.test.js` and `tests/approved.test.js`: photo moved and verified; a corrupted read-back stops the migration with nothing written; photo replaced and old one removed; a full photo store changes nothing.
  - **Browser smoke:** real migration into IndexedDB, real 3000×2000 → 1280×853 JPEG resize, new photo saved to IndexedDB.
- **Left:** Browsers can still evict site data under storage pressure unless persistent storage is granted. Velo doesn't request it, so keep backup files.

### F06: Spreadsheet export is not a complete backup · **Fixed**
- **Changed:**
  - **Backup file v2** holds every Velo key (activities, Recently deleted, notes, profile, avatar, units, coach and calendar settings, feedback, set-aside data) **and every photo**. It never includes the Strava connection.
  - Version 1 files still restore, and the upgrade then moves their photos.
  - Restore validates the file, including that photos are image data URLs, saves an automatic backup, stores and verifies photos, then writes records.
- **Files:** [src/utils/storage.js](../src/utils/storage.js), [src/components/BackupModal.jsx](../src/components/BackupModal.jsx), [src/utils/backups.js](../src/utils/backups.js)
- **Verified:** `tests/approved.test.js` ("complete backup spans localStorage and photos, and restores both"; v1 still accepted; bad photo data rejected) and `tests/storage.test.js`.

### F07: Spreadsheet dates break on the next export · **Fixed**
- **Changed:** Dates are stored as `YYYY-MM-DD`. Export parses any accepted date, and unreadable legacy values are exported unchanged.
- **Verified:** `tests/dates.test.js` and `tests/importExport.test.js`.

### F08: Repeated imports duplicate records · **Fixed**
- **Changed:**
  - Rows whose ID or Strava ID already exists are skipped. The preview shows new, skipped and rejected counts.
  - **New:** rows with **no `id`** that match an existing activity on date, sport, distance (±0.01 mi) and duration (±0.1 min) are listed as **possible duplicates**. You choose to skip them or import them too, and nothing is merged automatically.
- **Files:** [src/utils/activityStore.js](../src/utils/activityStore.js), [src/utils/importHelpers.js](../src/utils/importHelpers.js), [src/pages/Activity.jsx](../src/pages/Activity.jsx)
- **Verified:** `tests/approved.test.js` ("rows without ids that match existing activities are flagged, not merged"), `tests/importExport.test.js`, `tests/strava.test.js`.

### F09: Async imports can overwrite intervening changes · **Fixed**
- **Changed:**
  - Imports merge against the current state at commit time.
  - **New:**
    - Before every write the store checks that the stored text is what this tab last saw. If another tab changed it, the write is refused and the list reloaded.
    - The editor refuses to save over an activity that changed or was deleted after you opened it.
- **Files:** [src/utils/activityStore.js](../src/utils/activityStore.js), [src/App.jsx](../src/App.jsx)
- **Verified:** `tests/approved.test.js` ("stale edits are refused instead of overwriting newer changes") and `tests/storage.test.js`.
- **Left (browser limit):** localStorage has no compare-and-swap, so two tabs writing in the same instant can still race, and the later write wins. There's also no cancel button for a running import.

### F10: Import doesn't validate or report bad rows · **Fixed**
- **Changed:**
  - Rows are validated, and invalid ones are listed with row number and reason. Valid rows import after you confirm.
  - Unknown columns are reported, files are capped at 5 MB, and the `Activities` sheet (else the first sheet) is read.
  - **New:**
    - A `status` column.
    - `movingMinutes` and `elapsedMinutes` columns.
    - Hike and strength types, and `unknown` intensity.
    - A **blank intensity now imports as `unknown`** instead of `easy`.
    - A blank status means completed, except for rows dated after today, which are flagged for review. A "completed" row dated in the future is rejected.
  - A worksheet picker wasn't added, since you said it isn't required.
- **Verified:** `tests/importExport.test.js` and `tests/approved.test.js`.

### F11: Import rewrites note content · **Fixed**
- **Verified:** `tests/importExport.test.js`. Semicolons and newlines survive a round trip.

### F12: Multiple duration formats give inconsistent statistics · **Fixed**
- **Verified:** `tests/activityModel.test.js`. One strict parser handles all three formats everywhere.

### F13: PR definitions disagree · **Fixed**
- **Changed:** One implementation ([prDetection.js](../src/utils/prDetection.js)) is used by the activity list badge and the Profile panel:
  - **Whole-activity** records. The activity must be at least the event distance and **no more than 3% longer**.
  - Event distances are exact: 1 mile = 1609.344 m, 5 km = 5000 m, 10 km = 10000 m. Strava's exact `distanceMeters` is used when present.
  - The full recorded duration is used, with no estimate of a faster segment.
  - On equal times, **the earliest** activity keeps the PR. A `race` tag doesn't bypass the distance rule.
  - Planned and unconfirmed activities don't qualify. Neither do activities with no duration or with date, distance, duration or split data awaiting review.
  - Labels read "Whole-activity times" and "🏆 PR · whole activity". The Profile speed uses the activity's own distance.
- **Verified:** `tests/approved.test.js` (exact boundaries, +3% vs +3.5%, ties, race tag, review, plans, missing time, meters preference).
- **Note on existing records:**
  - A run stored as **3.1 mi** (4988.97 m) is shorter than 5 km, so it **no longer counts** as a 5K PR. That is the intended result of the whole-activity rule.
  - Recorded distances were **not** changed by the repair or the upgrade, and must not be raised just to qualify.
  - Accepted ranges:
    - Mile: 1609.344–1657.624 m.
    - 5K: 5000–5150 m.
    - 10K: 10000–10300 m.
  - A 0.01 m allowance covers only conversion rounding. Correct a distance only if it differs from what was actually measured (see README, "PRs").

### F14: Dates shift between days and months · **Fixed**
- **Verified:** `tests/dates.test.js` and `tests/coach.test.js` under `TZ=America/New_York`.

### F15: Invalid calendar dates silently normalize · **Fixed**
- **Verified:** `tests/dates.test.js`. Browser smoke: an impossible date is flagged and left as stored.

### F16: Week and percentage definitions differ · **Fixed**
- **Changed:** One statistics module ([stats.js](../src/utils/stats.js)) shared by Home, Profile and coaching:
  - **Reporting weeks are Monday–Sunday everywhere**: Home and coaching. The calendar grid still starts on Sunday, as you allowed.
  - **Easy % = easy run distance ÷ run distance with a known effort.** Unknown-effort distance is left out of both sides and shown separately.
  - Only completed runs count.
- **Verified:** `tests/approved.test.js` (Monday weeks with zero weeks; easy % with unknown effort).

### F17: Pace and time rounding can show 60 seconds · **Fixed**
- **Verified:** `tests/dates.test.js`.

### F18: Monthly trends compare non-adjacent months · **Fixed**
- **Changed:**
  - **The current month** ("so far") is compared with **the same days of the previous month**, clamped to that month's length (March 31 vs February 1–28). **Earlier months** are compared whole.
  - **Every month** from your first completed run to now is shown, including months with zero runs.
  - **Average easy pace** = total easy-run time ÷ total easy-run distance. Runs missing either value are left out of both.
  - Labels show the unit, the denominator ("% easy (by mi)", "Effort unknown") and the comparison ("vs Mar 1–5").
- **Files:** [src/utils/stats.js](../src/utils/stats.js), [src/components/profile/MonthlySnapshot.jsx](../src/components/profile/MonthlySnapshot.jsx)
- **Verified:** `tests/approved.test.js` (same-days comparison, month-length clamp, zero months, weighted pace).

### F19: Jar completion undercounted · **Fixed**
- **Changed:**
  - **Every valid completed easy run** earns a ball, including distance-only runs.
  - **At 25 balls the jar moves to Past Jars immediately** and an empty jar is shown.
  - Jars are recalculated from the current records, so edits, deletions and backdated runs are reflected.
  - Planned runs and unknown-effort runs earn nothing.
- **Verified:** `tests/activityModel.test.js` (0, 24, 25, 26, 49, 50) and `tests/approved.test.js` (distance-only, backdated, edited-to-tempo, unknown, planned).

### F20: Jar celebration uses the wrong records · **Fixed**
- **Changed:** The celebration appears only when you **create** a completed easy run. Imports (spreadsheet or Strava) earn balls silently, and edits and plans never celebrate. A run that fills a jar shows "jar complete!".
- **Verified:** Browser smoke (create vs edit). The model rules are tested in `tests/approved.test.js`.

### F21: Bearer tokens in URLs and browser storage · **Fixed**
- **Changed (pass 1):**
  - Tokens are held only by the server, in a session.
  - The browser gets an httpOnly cookie, and redirects carry no tokens.
  - The old browser-held token is removed.
- **Verified:** `tests/server.test.js`. Browser smoke: the old token is removed.
- **Production limit:** covered by F24 (hosting). Sessions are in server memory, so restarting the server means reconnecting.

### F22: OAuth has no state validation · **Fixed**
- **Changed:** A single-use random `state` is bound to the browser by cookie and compared in constant time. The callback also accepts the narrower scope.
- **Verified:** `tests/server.test.js`.

### F23: Server command doesn't load `server/.env` · **Fixed**
- **Verified (pass 1):** the server started from the project root and from another directory, and exited cleanly on bad config. That code was unchanged in pass 2, and `tests/server.test.js` passes.

### F24: Strava hardcoded to localhost, no deployment wiring · **Partially fixed**
- **Done:**
  - `VITE_API_URL` configures the server address.
  - The dialog explains when the server can't be reached.
  - The steps and requirements for hosting are documented in the README and in Pending §1.
- **Remaining (external):** a host for `server/`, same-site HTTPS, a production callback domain registered with Strava, and the production `VITE_API_URL`. No hosting was provisioned, as instructed.

### F25: Token expiry, refresh, scope and disconnect missing · **Fixed**
- **Changed (pass 2):**
  - Velo now asks Strava only for **`activity:read`** (your public activities) instead of `activity:read_all`.
  - Disconnect revokes access, removes the server session and **keeps imported activities**.
- **Files:** [server/app.js](../server/app.js)
- **Verified:** `tests/server.test.js` (refresh, 401, disconnect, scope check).
- **Note:** private activities won't import. Change the one marked line in `server/app.js` if you want them.

### F26: Strava conversion changes meaning and precision · **Fixed**
- **Changed (pass 2):**
  - **Mapping:**
    - `Hike` → hike and `WeightTraining` → strength.
    - `Workout`, `Crossfit` and `HighIntensityIntervalTraining` → workout.
    - Unsupported sports such as Walk are still listed and skipped, never turned into runs.
  - **Effort:** imported as **`unknown`**. That means no jar credit, and coaching treats it as neither easy nor hard until you edit it.
  - **Time:** **runs use moving time** as the duration, so pace ignores stops; other sports keep elapsed time. Both `movingMinutes` and `elapsedMinutes` are stored, along with `distanceMeters`.
  - **Your edits are protected:** activities you already have, matched by Strava ID, are always skipped on re-import, so no imported field overwrites a local edit.
  - **Nothing is deleted** when an activity disappears from Strava.
  - **Imports are manual only;** nothing runs in the background. Full-history import stays available.
- **Legacy imports:** activities imported before this version keep their stored values: intensity `easy` (so their jar balls stay) and elapsed-time duration. Velo can't tell whether you edited them, so they were **not reclassified**. To treat one as unknown effort or moving time, edit it; its `movingMinutes` is shown in the backup and export when available.
- **Files:** [src/utils/stravaHelpers.js](../src/utils/stravaHelpers.js), [server/app.js](../server/app.js), [src/components/StravaModal.jsx](../src/components/StravaModal.jsx)
- **Verified:** `tests/strava.test.js` (moving vs elapsed, unknown effort, Hike, strength, unsupported).

### F27: Strava import stops at 200 · **Fixed**
- **Verified:** `tests/strava.test.js` and `tests/server.test.js`.

### F28: Server lacks operational controls · **Partially fixed**
- **Done:**
  - Input validation, upstream timeouts and status mapping.
  - Logs without sensitive data.
  - `/health`, graceful shutdown, and config validation at start.
- **Remaining (external, needed before others use it):** a persistent session store and rate limiting. They only make sense on a chosen host. Adding them now would be infrastructure you haven't approved. See Pending §1.

### F29: Dependency vulnerabilities · **Fixed**
- **Changed:**
  - **SheetJS (`xlsx`) 0.20.3.** The official SheetJS documentation and its CDN's `xlsx-latest` both point to 0.20.3 as the current release, and I checked the tarball's own `package.json`. It is past both advisories: prototype pollution was fixed in 0.19.3, and ReDoS in 0.20.2.
  - It is installed from `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` and **pinned exactly**: `package.json` names that tarball, and the lockfile records its sha512 integrity. Same API, so Velo's Excel import and export are unchanged.
  - Removed the now-unused `react-country-flag`.
- **Verified:**
  - `npm audit`: 0 high, 0 critical. With the 0.20.3 tree installed, it checks `xlsx` against both advisory ranges and reports nothing. It flagged `xlsx` only while `node_modules` was incomplete, because it couldn't read the version.
  - `tests/approved.test.js`: an Excel round trip with 0.20.3 matches the CSV path, and `XLSX.version === "0.20.3"`.
- **Left:** 6 moderate advisories in ESLint's `minimatch` chain, which are development-only and have no fix within ESLint 9. SheetJS isn't on the npm registry, so future updates must be checked by hand on `cdn.sheetjs.com`.

### F30: CSV exports can contain formulas · **Fixed**
- **Changed:**
  - Text cells that begin with `= + - @`, a tab or a carriage return are still neutralized with a leading `'`.
  - **New:** text that already begins with apostrophes before such a character gets one more, so import (which strips exactly one) returns **exactly the original text**. `'=quoted` and `'apostrophe` now round-trip.
  - Excel cells are written as plain text, never as formulas, so Excel import takes text exactly as stored.
- **Verified:** `tests/approved.test.js` (exact round trip of 11 tricky strings, none left formula-like; CSV and Excel round trips).

### F31: Coach reads an mph field the app never sets · **Fixed**
- **Verified:** `tests/coach.test.js`.

### F32: Intervals not classified as hard · **Fixed**
- **Verified:** `tests/coach.test.js`.

### F33: Coach time windows can be stale or inaccurate · **Fixed**
- **Changed:**
  - Analysis is **as of today**, using completed runs only (no planned ones), in Monday–Sunday weeks.
  - **This week so far is compared with the same days of last week**, for the mileage spike and the steady week.
  - **Pace baselines exclude the runs being judged.** "That wasn't easy" compares your latest easy run with the 10 easy runs before it. "Easy pace drift" compares the last 5 easy runs with the 10 before them.
  - Alerts about "your last run" apply only while that run is from the last 7 days. "Long run overdue" keeps ageing during a break.
  - Easy % uses known-effort run distance. When most of this week's runs have unknown effort, a note says so instead of guessing.
  - Runs without a time are skipped by pace checks.
  - Thresholds are unchanged, and coaching stays running-only.
- **Files:** [src/utils/coachAlert.js](../src/utils/coachAlert.js), [src/components/CoachHelpModal.jsx](../src/components/CoachHelpModal.jsx)
- **Verified:** `tests/coach.test.js` and `tests/approved.test.js` (as-of-today expiry, same-days spike, baseline exclusion, unknown effort, plans ignored, distance-only).

### F34: Alert count not robustly bounded · **Fixed**
- **Changed:** The count is clamped from 0 to 6. **New:** "Hidden" (0) is remembered across visits.

### F35: Two add controls and save paths · **Fixed**
- **Verified:** `tests/storage.test.js`. Browser smoke.

### F36: Saving reloads the page · **Fixed**
- **Changed:** No reload on save. The unsaved-change warning is kept; draft autosave was not required.

### F37: Dialog accessibility incomplete · **Fixed**
- **Changed:** `useDialog` now does all of this:
  - **makes everything outside the open dialog `inert`**, so it can't be focused, clicked or reached by a screen reader;
  - keeps a **dialog stack**, so only the innermost dialog handles Escape and Tab in nested cases, and each restores only what it changed;
  - sets initial focus, keeps Tab inside, closes on Escape, locks scroll, and returns focus to the opener.

  The add/edit dialog was wrapped so its backdrop stays clickable.
- **Files:** [src/hooks/useDialog.js](../src/hooks/useDialog.js), [src/components/AddActivityModal.jsx](../src/components/AddActivityModal.jsx)
- **Verified:** Browser smoke (tab bar and floating button inert, dialog not inert, 40 Tab presses and Shift+Tab stay inside, Escape, focus return).
- **Left:** No screen-reader session was run.

### F38: Pointer-only controls and missing labels · **Fixed**
- **Changed:**
  - **New:** the weekly mileage chart has a **"Show weekly data as a table"** alternative: a captioned table of every week's distance (in your unit) and time, newest first.
  - PR buttons have descriptive labels.
  - Pass-1 keyboard fixes are kept.
- **Verified:** Browser smoke (table present, with caption and rows).
- **Left:** Calendar tiles rely on react-calendar's own accessibility.

### F39: Weekly chart targets and forced scrolling · **Fixed**
- **Changed:** Behaviour kept as you asked. Labels now use your unit.

### F40: Heatmap and history ranges unbounded · **Fixed**
- **Changed:** Heatmap, calendar and stats receive completed activities only. **Hiking isn't scored** on the heatmap or counted as running on the calendar, since there's no agreed equivalence. Strength keeps the workout scoring it had when it was logged as a workout.

### F41: Filtering leaves the wrong activity expanded · **Fixed**
- **Changed:** **New** filter chips for Hike, Strength and Unknown effort. Distance and pace filters use your unit.

### F42: Every route loads the spreadsheet code · **Fixed**
- **Verified:** Build output. SheetJS 0.20.3 is still loaded only on import or export.

### F43: Debug logging includes personal data · **Fixed**

### F44: No motion or sound preference · **Fixed**
- **Changed:** Defaults are kept as you asked (sound and vibration on), with toggles. Reduced-motion is respected.

### F45: UI promises and actions don't match · **Fixed**
- **Changed:**
  - The page title is **Velo**, and a simple orange "V" icon (`public/velo.svg`) replaces the Vite favicon.
  - The hardcoded US flag was removed.
  - The **Excel/CSV choice sits next to Export**, removed from the filter dialog.
  - The Strava dialog text matches the new behaviour.
- **Verified:** Browser smoke (title, icon, no flag, export select).

### F46: Notes import overwrites, and every keystroke is persisted · **Fixed**
- **Changed:**
  - Importing into a card with text offers **Replace / Append / Cancel**.
  - **Export writes the exact text** (no date or title wrapper), named after the card.
  - Saving is debounced to 400 ms with a visible error. **Pending edits are written immediately** when you navigate away from Home, hide the tab or close the page.
- **Files:** [src/pages/Home.jsx](../src/pages/Home.jsx)
- **Verified:**
  - Browser smoke section 6b, "Pending note edits survive leaving Home". It types, then leaves before the 400 ms save in two ways:
    - an in-app tab switch, which tests saving on unmount;
    - a full page navigation, which tests saving on `pagehide`.

    It checks that the final typed text is stored exactly. With the save-on-leave code disabled, both checks fail, so the test detects this bug.
  - Not automated: the `visibilitychange` path, which runs on mobile tab switching. It uses the same save function.

### F47: Lint failing, with a latent undefined reference · **Fixed**
- **Verified:** `npm run lint`: 0 errors, 0 warnings. No rules were disabled.

### F48: No automated tests or CI · **Fixed**
- **Changed:**
  - 96 tests (35 new in `tests/approved.test.js`, plus updated ones).
  - **GitHub Actions** ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) runs `npm ci`, lint, tests and build on every push and pull request.
  - The browser smoke script now has 54 checks and is documented as a manual pre-release step.
- **Left:** The workflow hasn't run on GitHub yet, since nothing was pushed.

### F49: Storage, state and rules duplicated · **Fixed**
- **Changed:** All of these now live in one place each:
  - weeks, months, easy % and totals ([stats.js](../src/utils/stats.js));
  - PRs ([prDetection.js](../src/utils/prDetection.js));
  - units ([units.js](../src/utils/units.js));
  - IndexedDB access ([idb.js](../src/utils/idb.js)).

  Removed:
  - Home's own weekly calculation, and Profile's own totals, PRs and months;
  - `profileHelpers`' duplicate date and week helpers;
  - the identical duplicate `.modal-overlay` CSS rule.
- **Left:** 14 CSS selectors are still defined in more than one place with *different* declarations. Merging those can change the cascade, so they were left alone to keep the look identical.

### F50: No managed recovery, sync or complete deletion · **Partially fixed**
- **Done:**
  - **Recently deleted** (trash): deleting moves an activity there for **30 days**, with an **Undo** bar. Restore, Delete forever and Empty are under Backup & recovery.
  - **Delete All** moves activities to Recently deleted. It never touches notes, profile or settings.
  - **Reset Velo** is separate. It lists exactly what it removes and requires typing **RESET**. It saves an automatic backup first, disconnects Strava, then removes every Velo key and photo. Automatic backups are kept unless you tick the box.
  - Automatic backups now include photos and have a retention limit.
  - Cross-tab sync covers activities, trash and units, and stale writes are refused (F09).
- **Remaining (undecided):** phone/laptop sync, accounts and offline requirements. You said these aren't decided, so nothing was added. Until then, data lives in one browser; use backup files to move it.
- **Verified:** `tests/approved.test.js` (trash, undo, purge with photos, expiry, failed writes, reset scope). Browser smoke (delete → undo, reset).

### F51: Setup and operating docs missing · **Fixed**
- **Changed:** The README covers:
  - units, plans and status, and the new types;
  - photos and storage, backups, trash, reset and the migration;
  - the import columns;
  - metric definitions;
  - CI and the smoke test.

---

## Files added in pass 2

- `src/utils/units.js`
- `src/utils/stats.js`
- `src/utils/media.js`
- `src/utils/idb.js`
- `src/hooks/usePhoto.js`
- `tests/approved.test.js`
- `.github/workflows/ci.yml`
- `public/velo.svg`

`public/vite.svg` was removed. That deletion is in the working tree only and was not staged.

## Resuming this work

1. Stop any leftover `vite preview` on port 4173, then run `npm ci`. It should install exactly the lockfile.
2. Run `npm run lint`, `npm test` and `npm run build`. All should pass.
3. Before a release, run the browser smoke test (README → Testing) in a throwaway browser profile.
4. Remaining items are in [PENDING_DECISIONS.md](PENDING_DECISIONS.md).

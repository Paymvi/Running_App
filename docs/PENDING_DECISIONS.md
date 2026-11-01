# Pending decisions

This file lists what is **still open** after your answers of November 1, 2026. Every other product question from the audit has been decided and implemented; those are listed at the bottom for reference.

Two kinds of item remain:
- **External prerequisites:** things that need a service, account or credentials outside this repository. The code is ready up to that point.
- **Undecided product choices:** questions you said are not decided yet. Nothing was assumed for them.

Any **Recommendation** below is a suggestion, not an approved decision.

---

## Still open

### 1. Hosting for Strava and for using Velo away from this computer (external prerequisite)

**Findings:** F21, F24, F28. **Questions:** Q1, Q3, Q5, Q53, Q59.

**Status of the code:** complete for local use.
- The Strava server keeps tokens server-side.
- It requests read-only `activity:read`, refreshes and revokes tokens, validates its config, and has `/health`.
- `VITE_API_URL` points the frontend at it.

**What production needs, none of which was provisioned:**
1. A host for `server/` that is always on and serves HTTPS.
2. The frontend and server on the **same site**: one registrable domain, or a reverse proxy. The session cookie is `SameSite=Lax`.
3. `FRONTEND_URL` and `STRAVA_REDIRECT_URI` set to the production URLs. The callback domain must also be registered in the Strava app settings.
4. The frontend rebuilt with `VITE_API_URL` set to the server's URL.
5. **Before anyone other than you uses it:**
   - a persistent session store (sessions are in memory today, single process only);
   - rate limiting;
   - a privacy note covering what Strava data is read and stored (Q53, Q59).

**Recommendation:** while Velo is just for you, keep using Strava locally. When you're ready, pick a small always-on host on a subdomain of the frontend's domain and add the item-5 pieces at the same time.

### 2. Phone/laptop sync, accounts and offline use (undecided)

**Findings:** F50. **Questions:** Q2, Q6.

**Today:**
- All data lives only in the browser you use: localStorage for records and IndexedDB for photos and automatic backups.
- To move data, use **Backup & recovery → Download backup file** on one device and **Restore** on the other. A restore replaces that browser's data.
- There are no accounts, no cloud storage and no background sync. Nothing was added, as you asked.

**What deciding involves:** whether data should follow you between devices, whether the app must work offline (installable PWA), and, if sync is wanted, where data is stored. That would also be the point to add accounts for other users.

### 3. Smaller follow-ups that need no decision but are worth knowing

| Item | Where | Note |
| --- | --- | --- |
| SheetJS updates | `package.json` | SheetJS isn't on the npm registry. Check `cdn.sheetjs.com` for new releases by hand (currently 0.20.3, pinned). |
| ESLint `minimatch` advisories | dev dependencies | 6 moderate advisories, development only. They clear when ESLint ships a fixed chain. |
| Private Strava activities | `server/app.js` | Only public activities import (`activity:read`). Change the marked scope line to `activity:read_all` if you want private ones too. |
| Browser storage eviction | browser | Browsers may clear site data under storage pressure. Keep downloading backup files. Velo doesn't request persistent storage. |
| CSS duplicates | `src/App.css` | 14 selectors are defined more than once with different values. They were left alone to avoid visual changes. |
| CI | `.github/workflows/ci.yml` | It runs once the repository is pushed to GitHub. Not yet observed running. |

---

## Resolved on November 1, 2026 (implemented)

| Topic | Decision implemented | Findings |
| --- | --- | --- |
| Audience | Personal now, open to others later. No accounts, sync, paid services or hosting added. | F50 |
| Photos | Images only, kept in browser IndexedDB, resized (1280 px JPEG, originals not kept), included in backups. Existing photos moved by a backed-up, verified migration. | F05, F06 |
| Activity types | Hiking added. Strength is its own type and may have no distance or time. Distance-only activities are valid, with no pace. | F03 |
| Units | Miles/kilometers preference. Distances are always stored in miles and converted only when typed or shown. | F02, F03 |
| Plans | Planned vs completed status. Plans earn no jars or PRs and don't count toward mileage or coaching. Past plans are never auto-completed. Future-dated legacy records are flagged "Planned or done?". | F03 |
| Strava | Moving time for run pace, with elapsed time kept. Effort imported as unknown. Imported easy runs earn balls without celebration. Manual import only, local edits protected, nothing deleted when an activity disappears, disconnect keeps activities, `activity:read` scope, Hike mapped, unsupported sports reported. Legacy imported "easy" values kept, not reclassified. | F25, F26 |
| Weeks and stats | Monday–Sunday reporting. Easy % by run distance with a known effort. Weighted pace excluding activities without both values. Current month vs the same days of last month, earlier months whole, zero months shown, units and denominators labelled. | F16, F18 |
| PRs | One shared whole-activity rule: event distance to +3%, exact 5 km/10 km/mile, earliest wins ties, race tags don't bypass, plans and data under review excluded, no inferred segments. | F13 |
| Coaching | As of today, same-days week comparisons, baseline excludes the runs being judged, thresholds unchanged, running only, can be hidden, unknown effort explained, plans ignored. | F33, F34 |
| Jars | Every valid completed easy run counts. A jar moves to history at 25. Jars are recalculated from records. Imports earn balls silently; edits and plans never celebrate. | F19, F20 |
| Spreadsheet import | IDs kept, known duplicates skipped, possible duplicates in ID-less files warned about (never merged), invalid rows listed and valid rows imported after confirmation. No worksheet picker. New fields round-trip. | F08, F10 |
| Delete and recovery | Recently deleted for 30 days with Undo. Delete All goes to the trash. A separate Reset with a stated scope, typed RESET and a backup first. Automatic backups capped (upgrades plus the 10 newest). Stale edits refused. | F09, F50 |
| Notes | Replace or Append on import, exact plain-text export, debounced saves flushed on leave. | F46 |
| Interface | Name "Velo", flag removed, new icon, export format next to Export, sound and vibration defaults kept with toggles, reduced motion respected, unsaved-change warning kept, weekly chart unchanged. | F44, F45 |
| Excel library | SheetJS 0.20.3 from the official distribution, pinned with integrity. | F29 |
| CI | GitHub Actions runs lint, tests and build. The browser smoke test is a documented pre-release step. | F48 |

Implementation details and verification for each finding are in [AUDIT_REPAIR_LOG.md](AUDIT_REPAIR_LOG.md).

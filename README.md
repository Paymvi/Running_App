# Velo

Velo is a personal training log for runs, rides, swims, hikes, workouts and strength sessions. It includes:
- a training calendar and weekly mileage;
- coach notes;
- whole-activity PRs;
- an "easy run jar";
- notes cards;
- planned workouts;
- spreadsheet import and export;
- a full backup and restore;
- an optional Strava import.

The frontend is a React and Vite single-page app. The optional `server/` is a small Express process that handles the Strava login.

> Repair history: [PROGRAM_AUDIT.md](docs/PROGRAM_AUDIT.md) is the baseline audit, [AUDIT_REPAIR_LOG.md](docs/AUDIT_REPAIR_LOG.md) records what changed, and [PENDING_DECISIONS.md](docs/PENDING_DECISIONS.md) lists what is still open.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0` (required by Vite 7). Developed on Node 22.12.
- A current Chrome, Edge, Safari or Firefox. The app needs localStorage and IndexedDB.

## Setup

```sh
npm ci               # installs exactly package-lock.json
npm run dev          # frontend at http://localhost:5173
npm run server       # optional: Strava server at http://localhost:5050 (needs server/.env)
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | ESLint (browser rules for `src/`, Node rules for `server/` and `tests/`) |
| `npm test` | Unit and integration tests (`node --test`, no extra packages) |
| `npm run server` | Strava OAuth and activity server |

**Dependencies:** the spreadsheet library is SheetJS `xlsx` **0.20.3**. It is installed from SheetJS's official CDN (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`), not the npm registry, whose last version (0.18.5) has known vulnerabilities. It is pinned in `package.json`, with its integrity hash in the lockfile. To update it, check [cdn.sheetjs.com](https://cdn.sheetjs.com/) and install the new tarball URL with `npm install --save-exact`.

## Configuration

### Frontend

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:5050` | Address of the Strava server. Set it at build time, for example in `.env.local`. |

### Server (`server/.env`)

Copy [server/.env.example](server/.env.example) to `server/.env` and fill it in. The server loads that file whichever directory you start it from. If a required value is missing or invalid, it **refuses to start** and lists what is wrong without printing the values.

| Variable | Purpose |
| --- | --- |
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | From https://www.strava.com/settings/api |
| `STRAVA_REDIRECT_URI` | `http://localhost:5050/auth/strava/callback` locally. Its domain must match the Strava app's "Authorization Callback Domain". |
| `FRONTEND_URL` | Where the app runs, with no trailing slash (for example `http://localhost:5173`). It is also the only allowed CORS origin. |
| `PORT` | Defaults to 5050 |

`server/.env` is git-ignored. Never commit it, and never paste secrets into issues or docs.

## Activities

| Field | Rules |
| --- | --- |
| Type | Run, Bike, Swim, Hike, Workout, Strength |
| Distance / duration | Every type except **Strength** needs a distance, a duration or both. Strength may have neither. Without a duration there is no pace (shown as "-", never 0). |
| Duration entry | Type digits: `MMSS` (`2530` = 25:30, up to 99:59) or `HMMSS` (`13045` = 1:30:45). Decimal minutes aren't accepted in the form. An activity already over 9:59:59 (from Strava, splits or an import) also accepts more digits as `HHMMSS`. Durations show as `MM:SS`, or `H:MM:SS` from one hour up. They are still stored as decimal minutes. |
| Splits | Optional, entered as speed + distance per split (`MPH + Splits` tab). Total distance and time are calculated from them. A shorter last split just uses its real distance. The expanded card shows each split's own time and the running elapsed time. Velo never invents splits from totals, so an activity without them shows an empty state. |
| Status | **Completed** or **Planned**. Completed activities can't be dated after today. Planned ones can be dated any time and never count as training until you edit them to Completed; passing the date doesn't change them. |
| Intensity | Easy, Tempo, Intervals, Long, or **Effort unknown** (Strava's default). Unknown effort is neither easy nor hard. |
| Date | A real date between 1900 and 2100 |
| Photo | Optional. Resized to at most 1280 px JPEG. |

**Units:** Profile → Edit → Distance unit switches between miles and kilometers. Distances are **always stored in miles**, so changing the unit never changes what was recorded. Values you type are converted when you save, and an activity whose distance you didn't touch keeps its exact stored value.

**Planned or done?:** activities that were already dated in the future when this version first opened weren't counted as either planned or completed. They show a "Planned or done?" badge and count nowhere until you open one and choose.

## Strava

1. Start both processes (`npm run dev` and `npm run server`).
2. Open **Activity**, click the Strava icon, then **Connect Strava**, and approve on Strava.
3. Click **Import from Strava**. Velo fetches your whole history in pages of 200 and shows a preview: how many are new, how many are already in Velo (skipped) and which sports are unsupported. Nothing is saved until you confirm.
4. **Disconnect** revokes Velo's access on Strava. Imported activities stay.

How it works:
- Tokens never reach the browser. The server keeps them in a session, and the browser holds only an httpOnly cookie.
- Velo asks only for `activity:read`, so private activities are not imported. Change the marked scope line in `server/app.js` to `activity:read_all` if you want them.
- The OAuth `state` is single-use and tied to your browser.
- Tokens are refreshed automatically.
- Sessions live in server memory, so you need to connect again after a server restart.
- Imports happen only when you click Import. There is no background sync.

| Velo type | Strava sport types |
| --- | --- |
| run | Run, TrailRun, VirtualRun |
| bike | Ride, VirtualRide, EBikeRide, MountainBikeRide, GravelRide, EMountainBikeRide |
| swim | Swim |
| hike | Hike |
| strength | WeightTraining |
| workout | Workout, Crossfit, HighIntensityIntervalTraining |

What an import sets:
- **Unsupported sports** (Walk, Yoga and others) are skipped and listed in the summary.
- **Effort** is "unknown". That means no jar ball and no easy/hard coaching until you edit it.
- **Duration:** runs use **moving time**, so pace ignores stops; other sports use elapsed time. Moving time, elapsed time, exact meters and elevation are all kept.
- **Re-importing** skips activities you already have, matched by Strava ID, so your edits are never overwritten. Activities deleted on Strava are not deleted in Velo.
- **Older imports:** activities imported by earlier versions keep the values they were saved with, intensity "easy" and elapsed time. They were not reclassified, because Velo can't tell whether you edited them.

**Using Strava on the deployed site:** the deployed site (Vercel) serves only the frontend. To use Strava there, the server must also be hosted, on HTTPS and on the **same site** as the frontend (same registrable domain, or a reverse proxy), with `VITE_API_URL` set and the production callback registered with Strava. Before others use it, it also needs a persistent session store and rate limiting. See [PENDING_DECISIONS.md](docs/PENDING_DECISIONS.md) §1.

## Where your data lives

Everything is stored **only in the browser you use**. Nothing is synced. Clearing site data, or switching browser or device, loses it unless you keep a backup file.

| Storage | Key / database | Contents |
| --- | --- | --- |
| localStorage | `activities` | Activity list (photos are referenced by `photoId`) |
| | `activities_trash` | Recently deleted activities (30 days) |
| | `velo_schema_version` | Data format version (currently 2) |
| | `activities_quarantine`, `activities_corrupt_<time>` | Data set aside during an upgrade or recovery |
| | `homeNoteCards` (`homeNotes`: old format) | Home notes cards |
| | `profileName`, `profileTag`, `profileAvatar`, `weeklyScaleMode` | Profile (the avatar is a 512 px JPEG) |
| | `velo_units`, `velo_coach_alerts`, `velo_feedback`, `calendar_settings_v1` | Settings |
| IndexedDB | `velo-media` | Activity photos |
| IndexedDB | `velo-backups` | Automatic backups |

### Upgrading existing data (one time, automatic)

The first time a browser opens this version, Velo upgrades its stored data to format 2:
1. It saves an **automatic backup** of everything as it was, including the photos inside your activities. **If that fails, it stops** and changes nothing; a banner asks you to download a backup file first.
2. It copies photos from the activity list into the photo database and **checks every copy**. If any copy fails, it stops, and your activities are untouched.
3. Only then does it save the activity list, with photos referenced by id. It also flags activities dated after today that have no status as "Planned or done?".

Original values of anything converted are kept under `legacy` on each record. Values Velo can't interpret are left as they were and marked **Needs review**.

### Backup & recovery (Activity → Backup)

- **Download backup file:** a JSON file with everything Velo stores, including photos, recently deleted items, notes, profile and settings. It never includes the Strava connection.
- **Restore from backup file:** replaces all Velo data in this browser with the file's contents, after you confirm and after an automatic backup of the current data. Older version-1 backup files are accepted.
- **Recently deleted:** deleted activities stay for **30 days**. Each can be restored or deleted forever, and the list can be emptied. Deleting an activity also shows an **Undo** bar. **Delete All** moves every activity here; it never touches notes, profile or settings.
- **Automatic backups:** saved before upgrades, Delete All, restores and resets. Every pre-upgrade backup is kept, plus the 10 newest others. Each one can be downloaded as a backup file.
- **Reset Velo:** removes everything Velo stores in this browser (activities, recently deleted, photos, notes, profile, settings, set-aside data) and disconnects Strava. You must type `RESET`, and an automatic backup is saved first. Automatic backups are kept unless you tick the box to delete them too.

Download a backup file regularly. It is the only copy outside this browser.

**Several tabs:** when one tab saves, the others reload their list. A tab whose list is out of date is refused when it tries to save, with a message, and an edit to an activity that changed elsewhere since you opened it is refused rather than overwriting the newer version. Browsers give no way to lock storage, so two saves in the very same instant can still race.

### If saved data is unreadable

A red banner explains the problem, and saving is paused so nothing overwrites the data. You can **Download damaged data**, or **Set aside & start fresh**, which keeps the raw text in this browser under `activities_corrupt_<time>`.

## Spreadsheet import and export

Choose **Excel** or **CSV** next to **Activity → Export**. Spreadsheets are for exchanging activity tables. **They don't include photos, notes cards or settings**; use the backup file for those. Distances in spreadsheets are always in **miles**, whatever unit you display.

| Column | Format |
| --- | --- |
| `id` | Kept on import. Rows whose `id` already exists in Velo are skipped. |
| `title`, `description`, `notes`, `limiter` | Text, imported exactly as written |
| `tags` | Pipe-separated, for example `hills\|race` |
| `type` | `run`, `bike`, `swim`, `hike`, `workout`, `strength` (any case). Defaults to `run`. |
| `intensity` | `easy`, `tempo`, `intervals`, `long`, `unknown`. **Blank means `unknown`.** |
| `feel` | `easy`, `medium`, `hard`. Defaults to `medium`. |
| `date` | **Required.** `YYYY-MM-DD` or `M/D/YYYY` (month first), or an Excel date cell. Export writes `M/D/YYYY`. |
| `time` | `HH:MM` (24-hour), optional |
| `status` | `completed` or `planned`. Blank means completed, except that rows dated after today are flagged "Planned or done?". A `completed` row dated in the future is rejected. |
| `miles` | Number, 0 or more |
| `duration` | Minutes (`45`, `45.5`), `mm:ss` or `h:mm:ss` |
| `mode`, `splits` | `timeMiles` or `splits`; splits are written `mph@miles\|mph@miles`, for example `6@1\|6.5@0.5` |
| `elevationGainFt`, `movingMinutes`, `elapsedMinutes` | Numbers (the last two are durations) |
| `source`, `sourceId` | Provider identity, for example `strava` and `123456`. Used to skip re-imports. |

Rules:
- Every row needs a distance or a duration, except `strength` rows.
- Invalid rows are listed by row number with the reason. The valid rows import after you confirm.
- **Possible duplicates:** a row with no `id` that matches an existing activity's date, sport, distance and duration is listed. You choose whether to skip those rows or import them too. Nothing is merged automatically.
- Unknown columns are ignored and listed. Files are limited to 5 MB. Excel reads the `Activities` sheet, or the first sheet if there isn't one.
- **CSV and formulas:** text that starts with `= + - @` gets a leading `'` so spreadsheet apps don't run it, and import removes it again. Text that already starts with `'` before such a character gets one more, so every note round-trips exactly. Excel files store text as text and need no prefix.

## How metrics are calculated

Statistics count **completed runs** only. Planned activities, "Planned or done?" activities and other sports are left out.

- **Pace and speed:** pace = duration ÷ distance and speed = distance ÷ hours, in your unit. An activity without both values has no pace.
- **Weekly mileage (Home):** Monday–Sunday weeks, every week from your first run to now, including zero weeks. **Show weekly data as a table** under the chart lists every week's numbers.
- **Profile totals:** total run distance and this calendar month's run distance.
- **Monthly snapshot:** one card per month from your first run to now, including months with no runs.
  - **Easy %** = easy run distance ÷ run distance with a **known** effort. Unknown-effort distance is shown separately and left out of both sides.
  - **Average easy pace** = total easy-run time ÷ total easy-run distance. Runs missing either value are left out of both.
  - **The change** for the current month ("so far") compares with the **same days of the previous month**. Earlier months compare whole months.
- **PRs (Mile, 5K, 10K):** whole-activity times.
  - The run must be **at least** the event distance (1609.344 m, 5000 m, 10000 m; Strava's exact meters are used when available) and **no more than 3% longer**. The full recorded time is used.
  - The earliest run wins a tie. A `race` tag doesn't change the distance rule.
  - Activities under review, and activities with no time, don't count.
  - Accepted ranges: Mile 1609.344–1657.624 m (1.00–1.03 mi), 5K 5000–5150 m (about 3.107–3.20 mi), 10K 10000–10300 m (about 6.214–6.40 mi). A 0.01 m allowance absorbs only unit-conversion rounding.
  - **Enter distances as recorded. Never raise a distance just so a run qualifies.** A run recorded as 3.1 mi (4988.97 m) is shorter than 5 km, so it isn't a whole-activity 5K and correctly gets no 5K PR. Velo never changes a recorded distance to make a PR fit, and the upgrade didn't change any stored distance.
  - Correct a distance only when the stored value doesn't match what you measured. For example, a watch or course measurement of exactly 5 km that was typed as a rounded "3.1": enter `5` with the unit set to km.
- **Coach alerts:** running only, analyzed **as of today**.
  - Weeks are Monday–Sunday, and this week so far is compared with the same days of last week.
  - Easy % uses known-effort run distance.
  - Pace baselines never include the runs being judged.
  - Alerts about your last run apply while it's from the last 7 days.
  - When most of this week's runs have unknown effort, the coach says so instead of guessing.
  - Hard efforts are `tempo`, `intervals`, `race` and `hard`.
  - Choose **Hidden** to turn alerts off; the choice is remembered.
- **Easy run jar:** one ball for every completed easy run with valid data, oldest first. At **25** balls the jar moves to Past Jars and a new one starts. Jars are recalculated from your activities, so edits and deletions change them. The celebration appears only when you create a completed easy run.
- **Heatmap (Profile):** 53 weeks at a time, with ‹ Earlier / Later ›.
  - Day score: run distance; bike distance ÷ 3 (or minutes ÷ 15); swim distance × 4 (or minutes ÷ 12); workout and strength (minutes ÷ 20) × effort (1, 1.5 or 2).
  - Hikes aren't scored, since there's no agreed equivalence.

## Testing

```sh
npm test        # 133 tests: dates/timezones, validation (types, strength, plans, units), splits,
                # PRs, weekly/monthly stats, coaching as of today, jars, migrations with photo
                # verification, backup/restore with photos, trash/undo/reset, stale edits,
                # CSV and Excel round trips, Strava mapping, OAuth server (mocked Strava)
npm run lint
npm run build
```

**CI:** [.github/workflows/ci.yml](.github/workflows/ci.yml) runs `npm ci`, lint, tests and build on every push and pull request.

**Browser smoke test (manual, before a release).** It **clears Velo's storage and databases for its origin**, so only run it in a throwaway browser profile:

```sh
npm run build && npx vite preview --port 4173 --strictPort
chrome --headless=new --remote-debugging-port=9333 --user-data-dir=<empty temp dir> --window-size=420,900 about:blank
node tests/browser-smoke.js
```

It covers:
- the upgrade with photo migration;
- real image resizing;
- dialog keyboard behaviour and inert background;
- saving, editing, trash and undo;
- units, the chart data table, reset and corrupt storage;
- note edits typed just before leaving Home, which must still be saved;
- at a 320 px phone width, every page fits the screen and the "+" button and tab bar stay on screen.

Stop the preview server afterwards. On Windows a running preview locks files in `node_modules` and makes `npm ci` fail.

## Troubleshooting

- **"Can't reach the Velo server"** in the Strava dialog: run `npm run server`, and check that `VITE_API_URL` and `FRONTEND_URL` match where things actually run.
- **Server exits with "Velo server not started":** fix the listed items in `server/.env`.
- **"Strava session expired":** connect again. This also happens after a server restart.
- **"Browser storage is full":** download a backup file, then empty Recently deleted or remove large items.
- **"Photo couldn't be loaded" / "Photo not found":** the browser's photo database is blocked or was cleared. Restore a backup file to recover photos.
- **"Changed in another tab":** the list was refreshed; check it and save again.
- **`npm ci` fails with EPERM on Windows:** stop any running `vite`/`vite preview` for this folder, then retry.

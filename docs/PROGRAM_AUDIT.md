# Velo program audit

Audit date: November 1, 2026 (America/New_York)

## Executive assessment

The application builds successfully, but several ordinary user workflows can produce incorrect statistics, lose information, or crash a page. The most urgent work is to protect existing data, fix the non-running-history crash, establish one activity schema, repair split calculations and import/export round trips, and replace the development-only Strava authentication/deployment flow before public use.

This is an audit, not an implementation change. Application source and dependency versions were left unchanged. Findings below distinguish reproduced defects, source-confirmed defects, and risks/design decisions that require your input. Severity describes practical impact in this application; dependency advisory severity is reported separately.

## Scope and evidence

Reviewed the React entry point and routing; Home, Activity, and Profile pages; all component and utility modules; local storage usage; manual entry, editing, filtering, import/export, calendar, charts, PRs, jars, notes, Strava client/server flow; build, lint, package manifests, and deployment configuration. Reviewed styling for layout, interaction, motion, and maintainability concerns. No applicable AGENTS.md was found in the repository file listing.

Verification performed:

| Check | Result |
| --- | --- |
| Production build, `npm run build` | Passed. Initial sandbox filesystem denial was resolved by running the same command with approved expanded permissions. |
| Build size | JS 837.31 kB minified / 274.06 kB gzip; CSS 36.90 kB / 7.62 kB gzip. Vite emitted its large-chunk warning. |
| Lint, `npm run lint` | Failed: 39 errors, 3 warnings. Full messages in [audit-lint-results.json](../audit-lint-results.json). |
| Dependency audit, `npm audit --json` | Registry reports 27 affected package entries: 1 critical, 15 high, 9 moderate, 2 low. Full advisory data in [audit-dependency-results.json](../audit-dependency-results.json). The initial sandbox network denial was resolved with expanded permissions. |
| Small Node runtime probes | Confirmed bike-only coach crash; February 31 rolling into March; slash-format date exporting incorrectly; `5:60` time formatting. |
| Git status | Clean before audit output files, using a command-scoped safe.directory setting. No global Git setting was changed. |
| Secret hygiene check | `server/.env` exists, is ignored, and is not tracked in the current index. Its values were not printed or copied. This does not establish whether secrets ever appeared in past commits. |

Limitations: no interactive browser, screen-reader, real-device, or live Strava-account testing was performed. No deployed host was inspected. Browser-dependent issues are grounded in source inspection, with proposed verification steps where appropriate. The build used existing installed dependencies; a fresh installation was not performed. No claim is made that every possible defect or exploit has been discovered. Registry advisories are a point-in-time dependency scan, not proof that all listed vulnerabilities are reachable here.

Priority key: **P1 high** = crash, data integrity/loss, credential exposure, or major blocked workflow; **P2 medium** = incorrect behavior, misleading metrics, accessibility, or operational risk; **P3 low** = maintainability, polish, or smaller usability issue. Public deployment can increase security priorities.

## Findings: data integrity and core functionality

### F01 — P1: A nonempty history with no runs crashes Activity

**Evidence:** [coachAlert.js:16](../src/utils/coachAlert.js#L16), [coachAlert.js:203](../src/utils/coachAlert.js#L203), Activity's coach-alert memo.

The function checks whether the original activities list is empty, then filters to runs and immediately uses `sorted[0]`. For bike/swim/workout-only histories, `toDate(latest)` dereferences `undefined.date`. A runtime probe with one bike activity produced `Cannot read properties of undefined (reading 'date')`. Setting coach alert count to zero does not avoid the calculation.

**Fix direction:** handle an empty run subset explicitly, validate record shape, and keep one failed analysis from taking down the page. Verify bike-only, swim-only, workout-only, empty, and mixed histories.

### F02 — P1: Split mode never computes distance or duration

**Evidence:** [AddActivityModal.jsx:152](../src/components/AddActivityModal.jsx#L152), split inputs around line 262, consumers in ActivityCard, Home, Profile, PR detection, and calendar.

Saving copies the form unchanged. Entering a one-mile split at 6 mph saves split data but leaves top-level miles/duration blank. Summary consumers use those top-level fields, so the run has no useful totals, pace, mileage contribution, or jar credit. Switching an existing activity from miles/time to splits can retain old totals that contradict the splits.

**Fix direction:** define canonical totals and calculate miles = sum of split distances; minutes = sum of `distance / mph * 60`, rejecting invalid speeds/distances. Recalculate consistently on edit and import.

### F03 — P1: Manual activity entry accepts invalid records

**Evidence:** AddActivityModal `handleSubmit`, plain text miles/duration/split inputs, optional date input.

The Save button has no validation or form constraint enforcement. Blank, negative, nonnumeric, infinite, missing-date, and contradictory values can enter storage. Different consumers reject, truncate, or count these values differently. Negative values are truthy in some Profile filters and can corrupt jar/PR calculations.

**Fix direction:** introduce one validation/normalization boundary for manual entry, imports, storage hydration, and provider imports. Distinguish valid time-only workouts from incomplete runs; show field errors without closing the modal.

### F04 — P1: Storage failures and corrupt saved data are unhandled

**Evidence:** App save handler; Activity loader/save/import/delete handlers; Home hydration and notes persistence; Profile hydration/avatar persistence.

JSON parsing is generally unguarded, and parsed data is assumed to be an array of valid objects. Malformed JSON, `null` records, or wrong-shaped data can crash routes. `localStorage.setItem` failures are also generally unhandled; some paths update UI state before persistence succeeds. Users can see imported or saved information that disappears after refresh. There is no recovery screen or export of damaged raw data.

**Fix direction:** centralize storage access with schema checks, explicit failure feedback, recoverable backups/migrations, and a clear persisted-success contract. Preserve corrupt data for recovery rather than silently replacing it.

### F05 — P1: Media can exhaust the application's only persistent store

**Evidence:** AddActivityModal photo FileReader; Profile avatar FileReader; all activities serialized together in localStorage.

Activity uploads have no size/type/dimension limit and become base64 strings in the full activity array. The avatar's 2 MB file limit still permits substantial base64 expansion. A few media files can exhaust browser storage and make later saves fail. Every activity write also serializes all media again.

**Fix direction:** set supported media policy and limits; resize/compress images; put binary media in an appropriate persistent store; handle quota failures. Preserve existing media during migration.

### F06 — P1: Spreadsheet export is not a complete backup

**Evidence:** [importHelpers.js:101](../src/utils/importHelpers.js#L101), `rowsToActivities`.

Exports omit photos, splits, mode, and elevation fields. Imports force `mode: timeMiles`, reset splits/photo, and generate new IDs even when exported IDs exist. Profile, calendar settings, and Home note cards are outside this export entirely. Exporting and reimporting cannot restore the original application state.

**Fix direction:** distinguish portable activity spreadsheets from a versioned, full-fidelity backup/restore format. Preserve identity and supported fields, with explicit migration rules.

### F07 — P1: Spreadsheet dates break on the next export

**Evidence:** importHelpers date normalization; [dateUtils.js](../src/utils/dateUtils.js), `formatDateMDY`.

Imports preserve `M/D/YYYY` strings, but export assumes every date is hyphen-separated. Runtime probe: `formatDateMDY('3/5/2026')` returns `NaN/NaN/3/5/2026`. This affects a normal export → import → export workflow. Slash dates also do not fit the edit modal's HTML date input.

**Fix direction:** store a validated canonical `YYYY-MM-DD` date internally and format only at display/export boundaries. Verify repeated round trips.

### F08 — P1: Repeated imports duplicate records

**Evidence:** importHelpers assigns a fresh UUID per row and concatenates; Activity Strava mapper assigns fresh UUIDs and discards the upstream ID.

Importing the same spreadsheet or Strava history twice doubles records, mileage, jars, and PR candidates. Existing exported IDs are ignored. No conflict preview, source identity, or import transaction exists.

**Fix direction:** keep provider IDs/source metadata; decide spreadsheet matching and merge rules; preview duplicates/conflicts before committing a validated batch.

### F09 — P1: Async imports can overwrite intervening changes

**Evidence:** `handleCSVImport`, `handleExcelImport`, and `fetchStravaActivities` merge against captured `activities` after asynchronous work.

If a second import finishes first, or history is deleted while a file/request is pending, the later callback can overwrite the newer state or resurrect deleted records. Buttons remain available, and imports are not cancelled or serialized. Independent tabs also read/write whole-array snapshots with no reconciliation.

**Fix direction:** use one authoritative repository/store, atomic merges against current data, operation status/cancellation, and a defined cross-tab policy. Verify overlapping imports and delete-during-import.

### F10 — P2: Import parsing does not validate or report bad rows

**Evidence:** importHelpers `Papa.parse`, `rowsToActivities`, XLSX read and first-sheet selection.

CSV parse errors are ignored, with no error callback. Missing/misspelled headers silently produce default easy runs. Excel numeric notes/description/tags can throw because `.replace`/`.split` assumes strings. Type/intensity casing is not normalized. Invalid dates and nonsensical numbers enter storage without row-level diagnostics. Only the first worksheet is read, without a selection or explanation.

**Fix direction:** documented templates, header validation, type coercion, required-field checks, rejected-row report, preview, and explicit worksheet choice when relevant.

### F11 — P2: Import rewrites legitimate note content

**Evidence:** importHelpers replaces every semicolon and literal `\n` in description/notes with a newline.

Text such as `easy; felt good` changes during import, including after an export/import round trip. This transformation is lossy and undocumented.

**Fix direction:** preserve quoted text verbatim by default; make any legacy conversion explicit and optional.

### F12 — P2: Multiple duration formats produce inconsistent statistics

**Evidence:** profileHelpers parses decimal minutes, `mm:ss`, and `hh:mm:ss`; ActivityCard uses `parseFloat`; filters and `detectPRs` use `Number`; Profile PRs use `parseFloat`.

A duration of `30:30` becomes 30.5 minutes in weekly totals, 30 minutes in some displays/PR calculations, and NaN in other consumers. Duration parsing also accepts malformed/negative components without full validation.

**Fix direction:** store one numeric duration unit, with shared strict parsing at input and shared formatting at output. Migrate legacy strings.

### F13 — P2: PR definitions disagree and can award misleading records

**Evidence:** [prDetection.js](../src/utils/prDetection.js); [Profile.jsx:151](../src/pages/Profile.jsx#L151); PRPanel.

The activity list accepts whole-run times within broad distance tolerances, including runs shorter than the event. Profile accepts the whole duration of any run at least the event distance. A 2-mile/20-minute run can become Profile's 20-minute mile PR while receiving no mile badge in Activity. A 2.9-mile effort can qualify for the list's 5K. Neither method establishes the fastest segment within a longer run. Profile's associated mph is calculated as if the time covered exactly the target distance.

**Fix direction:** choose exact-distance efforts, explicit race records, normalized estimates, or actual best-effort segments; use one shared implementation and distinguish estimates from measured records. Define ties and legacy records.

### F14 — P2: Date parsing still shifts activities between days/months

**Evidence:** Profile stats `new Date(a.date)`; profileHelpers `formatDate`; coachAlert `toDate`; Activity Strava `isoToDateTimeParts`.

Some modules parse date-only ISO strings as UTC while others correctly construct local calendar dates. In New York, `2026-11-01` interpreted at UTC midnight is October 31 locally, affecting month totals, PR dates, and coach weeks. Strava's local wall-clock string is passed through `new Date` and local getters, applying another timezone conversion when the value ends in `Z`.

**Fix direction:** separate calendar dates from instants. Preserve provider-local date/time deliberately, with consistent rules for timezone, travel, and daylight-saving boundaries.

### F15 — P2: Invalid calendar dates silently normalize

**Evidence:** dateUtils `parseLocalYMD`, profileHelpers `parseDateSafe`, duplicated parser in LargeHeatmap.

Parsers construct a Date without checking whether year/month/day round-trip. Runtime probe: `2026-02-31` becomes March 3, 2026. Some parsers return invalid Date objects rather than null, while others accept leading matches with trailing garbage.

**Fix direction:** strict format/range validation shared across modules; reject impossible dates and report affected imports/storage records.

### F16 — P2: Week and percentage definitions differ across views

**Evidence:** Home aggregates Monday–Sunday; coach and the unused Profile weekly calculation use Sunday–Saturday; RunCalendar uses a Sunday-first presentation. Coach easy percentage uses run count, MonthlySnapshot uses mileage.

The same Sunday activity belongs to different reporting weeks, and the same training distribution can receive different easy percentages without indicating the denominator. Calendar presentation can reasonably differ, but reporting definitions need to be explicit.

**Fix direction:** one reporting-week policy, labeled units/denominators, and shared aggregation utilities. Keep any deliberate calendar display difference clearly documented.

### F17 — P2: Pace/time rounding can display 60 seconds

**Evidence:** profileHelpers `formatTime`; ActivityCard pace calculation.

Both round seconds independently without carrying into minutes. A probe with `formatTime(5.999)` returns `5:60` rather than `6:00`.

**Fix direction:** round total seconds once, then divide/modulo. Verify carry boundaries and invalid values.

### F18 — P2: Monthly trends can compare nonadjacent months and misleading averages

**Evidence:** Profile monthlySnapshot aggregation and `const prev = arr[index + 1]`.

Months without activities are omitted. November may therefore compare against August rather than October; the UI does not explain the gap. Current partial months are compared against full prior months. Average easy pace is the mean of per-run paces rather than total easy minutes / easy miles, so a short run has the same influence as a long run.

**Fix direction:** decide whether comparisons are calendar-adjacent and month-to-date, include zero months where appropriate, and define the intended pace weighting.

### F19 — P2: Jar completion is undercounted at exact multiples of 25

**Evidence:** [Profile.jsx:228](../src/pages/Profile.jsx#L228).

The newest chunk is always considered the current jar, even when full; only earlier chunks count as completed. At 25 eligible runs, the UI says jar complete but shows zero completed jars and no history entry. At 50 it counts one completed jar.

**Fix direction:** define completion/rollover behavior and derive completed/current groups consistently at 0, 24, 25, 26, 49, and 50 runs.

### F20 — P2: Jar celebration uses the wrong records and unbounded history

**Evidence:** Activity passes `easyRuns.slice(1)` and `easyRuns[0]` to JarDropModal; AddActivityModal sets a boolean flag for every eligible save; EasyJar expects `key`/`label` fields absent from raw activities.

Editing an existing easy run celebrates it as newly added. Backdating an addition animates the newest easy run instead. The modal receives all easy runs rather than the current group of 25, so long histories can overfill the SVG and cause missing-key warnings. A flag saved on Home/Profile may celebrate later when Activity opens.

**Fix direction:** use an explicit saved-activity ID/event, distinguish create versus edit, and animate only the appropriate current jar with stable IDs.

## Findings: Strava, credentials, and server operation

### F21 — P1: Bearer tokens are passed in URLs and persisted in browser storage

**Evidence:** [server/index.js:79](../server/index.js#L79), Activity OAuth callback and Strava fetch URL.

The OAuth callback redirects with `access_token` in the query string, the API accepts it as a query parameter, and the frontend saves it in localStorage. Tokens can be exposed to request/access logging and browser-side scripts. Cleaning the address bar after mount reduces visible persistence but cannot undo earlier exposure. The scope includes private activities.

**Fix direction:** keep tokens server-side and use an appropriately secured application session; remove tokens from URLs/logs; provide disconnect/revocation and a clear privacy policy. There is no evidence of an actual leak in this audit.

### F22 — P1: OAuth has no request correlation or browser-bound state validation

**Evidence:** server authorization URL and callback route.

No generated `state` value is stored, sent, or verified, and the callback accepts any supplied code. The flow cannot prove that the callback belongs to the authorization initiated by that browser. The frontend also accepts any matching connected/token query pair.

**Fix direction:** implement provider-supported OAuth protections with single-use, expiring, browser-bound request state, validate callback parameter types and granted scopes, and reject unsolicited callbacks. Confirm the final provider requirements during implementation.

### F23 — P1: The documented server command does not load server/.env

**Evidence:** package.json `server: node server/index.js`; [server/index.js:4](../server/index.js#L4).

`dotenv.config()` defaults to the process working directory. Running `npm run server` from the project root looks for root `.env`, while the existing file and warning point to `server/.env`. Unless variables are supplied externally, required configuration remains missing. Startup only warns and continues to serve broken OAuth routes.

**Fix direction:** resolve the env path explicitly relative to the server module, or document/configure root environment loading; validate URLs/required settings and fail startup clearly. Provide a placeholder-only `.env.example`.

### F24 — P1: Strava is hardcoded to localhost and has no deployment wiring

**Evidence:** Activity connect/import URLs; vercel.json catch-all rewrite; package scripts/server entry.

The deployed browser calls its own `http://localhost:5050`, which normally has no Velo server. The repository's Vercel rewrite provides SPA routing but does not deploy this Express process or route backend requests. No environment-based backend origin/proxy configuration is provided.

**Fix direction:** choose hosting for the backend, configure the frontend API origin or same-origin proxy, HTTPS, CORS, secrets, and registered callback URLs. Verify a complete deployed flow.

### F25 — P2: Token expiry, refresh, scope, and disconnect are missing

**Evidence:** server token response retains only access_token; client treats any stored token as connected; StravaModal.

Refresh token and expiry information are discarded. Expired credentials leave a connected badge but imports fail. There is no disconnect control, no authorization-scope validation, and no specific expired/revoked-token recovery.

**Fix direction:** define server-side token lifecycle and connected status; refresh safely when supported, handle denial/revocation, and implement disconnect cleanup.

### F26 — P2: Strava conversion changes activity meaning and precision

**Evidence:** stravaHelpers; Activity mapper.

Unknown sports fall back to `run`, so non-running sports can inflate running mileage/PRs. Every import becomes `easy` regardless of actual effort, affecting jars and coach conclusions. Seconds are rounded to whole minutes, distances to two decimals, and elapsed time takes precedence over moving time without a visible choice. Elevation and provider identity are dropped.

**Fix direction:** define explicit sport mapping/unsupported-sport behavior, unknown intensity, duration policy, unit precision, and supported metadata. Preserve source values before deriving display metrics.

### F27 — P2: Strava history import silently stops at 200 activities

**Evidence:** Activity fetch `per_page=200&page=1`.

Only one page is requested, with no indication that older history is omitted. The interface suggests a general history import. There is no in-progress state, disabled repeated import, cancellation, resumability, or partial-failure summary.

**Fix direction:** implement paginated, deduplicated imports with progress and provider rate-limit handling, or explicitly label a limited recent-history import.

### F28 — P2: Server requests and errors lack operational controls

**Evidence:** server routes and fetch calls.

Query values are not type/range-validated; `per_page` has an upper cap but permits negative/fractional values, and page is unchecked. Upstream fetches have no explicit timeout. Authentication, rate-limit, and other upstream failures become generic 500 responses. Upstream error bodies are logged verbatim. No app rate limiting, health endpoint, structured/redacted logging, or graceful shutdown is provided.

**Fix direction:** validate inputs, bound calls, preserve actionable error categories safely, respect retry/rate-limit guidance, and add operational controls proportionate to public versus private hosting. CORS alone does not authenticate callers.

### F29 — P1: Dependency scan reports vulnerabilities, including the file parser

**Evidence:** package-lock.json, installed xlsx 0.18.5, [saved npm scan](../audit-dependency-results.json).

The registry reports 27 affected package entries: 1 critical (`proxy-addr`), 15 high, 9 moderate, 2 low. Direct dependencies flagged include `xlsx`, `react-router-dom`, and `vite`; direct development tools `eslint` and `eslint-plugin-react-refresh` are also flagged through their trees. Other affected entries include body-parser, path-to-regexp, qs, postcss, and several build/lint transitive dependencies. Counts include propagated dependency effects, not 27 proven exploitable application paths.

`xlsx` is particularly relevant because the application parses user-provided files in the browser. The scan lists [prototype pollution](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) and [regular-expression denial of service](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9), with `fixAvailable: false` in npm's reported dependency solution. Vite findings concern development tooling; some Router findings concern server/framework modes that this BrowserRouter SPA does not use. The server's proxy-related advisory exposure needs configuration/reachability review rather than assuming a critical compromise.

**Fix direction:** triage each advisory against actual usage, update compatible dependencies and lockfile, evaluate the spreadsheet parser's distribution/replacement options, then validate imports/build/server flows. Do not blindly run a forced audit fix. All package entries, ranges, advisory URLs, and npm fix flags are retained in the JSON evidence.

### F30 — P2: CSV exports can contain spreadsheet formulas

**Evidence:** importHelpers manually quotes fields but does not neutralize formula-leading text.

Quoting CSV values does not stop spreadsheet applications from interpreting a title/note beginning with `=`, `+`, `-`, or `@` as a formula. Imported/provider-controlled text can travel into exported files. Whether a particular formula executes depends on the spreadsheet application and its settings; no exploit was executed.

**Fix direction:** define spreadsheet-safe CSV escaping while preserving raw values in a full backup. Verify the target spreadsheet applications and text round trips.

## Findings: coach logic and reporting

### F31 — P2: Pace-based coaching reads a field the app never populates

**Evidence:** coachAlert `avgMph`, `easyRuns`, and `latestMph`; AddActivityModal/import mappings; ActivityCard.

Coach baselines and drift checks require top-level `a.mph`. Manual and imported activities store miles/duration but do not derive/store that field. ActivityCard computes mph locally for display only. Consequently normal application data cannot activate several advertised coach rules.

**Fix direction:** derive speed from canonical distance/duration in shared selectors rather than relying on an absent persisted field. Decide how pauses and missing values affect baselines.

### F32 — P2: Intervals are not classified as hard

**Evidence:** coachAlert `isHardIntensity` recognizes `interval`; form saves `intervals`.

Normal interval workouts miss hard-effort counts, consecutive-hard alerts, and related follow-up notes. The help modal claims intervals are included.

**Fix direction:** centralize the intensity vocabulary; separately decide whether race tags and long runs alter effort classification.

### F33 — P2: Coach time windows and messages can be stale or inaccurate

**Evidence:** coachAlert sets `now` from the newest run; consecutive-hard rule checks no date gap; hard count slices the last 12 runs before filtering; `daysSince` uses elapsed 24-hour periods.

The coach's clock freezes at the last logged run, so inactivity does not age alerts or overdue-long-run messages. Two hard runs weeks apart can be described as back-to-back hard days. A busy seven-day period can be undercounted because only 12 records are inspected. Inclusive elapsed-day bounds and UTC day keys do not consistently represent the stated calendar-day windows. A current partial week is compared against a full prior week; recent baseline samples overlap the comparison sample.

**Fix direction:** specify current versus retrospective analysis, exact calendar windows, adjacent-day requirements, comparison periods, and independent baselines. Validate with synthetic dated histories. These are software-rule concerns; no medical effectiveness assessment was made.

### F34 — P3: Coach alert-count input is not robustly bounded

**Evidence:** coachAlert line 172 uses `Number(maxAlerts) ?? 1`.

`Number(...)` may return NaN, which nullish coalescing does not replace. A nonnumeric setting produces no alerts through a NaN slice bound. Empty history also returns an alert regardless of a zero limit, though the current UI separately hides it.

**Fix direction:** use finite integer validation and apply one limit policy to all return paths. This is lower priority because the current UI supplies constrained values.

## Findings: interaction, accessibility, and performance

### F35 — P2: Two activity-add controls and save paths coexist

**Evidence:** App always renders FloatingButton/AddActivityModal; Activity renders another pair.

On Activity, two identically positioned floating buttons and two modal owners exist. App's save path appends the record without assigning an ID or sorting; Activity's path assigns IDs and sorts. Behavior depends on which owner opens the modal. Home/Profile additions initially persist null IDs until Activity later repairs them.

**Fix direction:** one activity action/modal owner backed by one shared save implementation and state source.

### F36 — P2: Saving reloads the page and can trigger duplicate/incorrect feedback

**Evidence:** AddActivityModal calls onSave, onClose, sets global feedback flags, then reloads after 675 ms; Activity onClose reloads storage.

Save remains enabled during the delay, so repeated clicks can save more than once. Reloading discards UI state and interrupts navigation; feedback flags can be consumed on a different later page visit. Closing does not warn about a dirty form. Celebration/sound is not tied to a confirmed create operation, and browser autoplay may reject sound after reload.

**Fix direction:** update shared state without reload, make submission single-flight, celebrate the actual persisted event, and define draft/discard behavior.

### F37 — P2: Dialog accessibility is incomplete

**Evidence:** AddActivityModal, StravaModal, NotesSettingsModal, EditProfileModal, PastJarsModal, ActivityFilterModal; no shared focus management found.

Most dialogs lack dialog semantics, accessible titles, initial focus, focus containment, and focus restoration. Escape works in some modals but is absent in others. Background content is not made inert, and body scroll is not consistently locked. Some close buttons have only a glyph as their name. Existing dialog roles in CoachHelp/CalendarSettings do not provide full focus handling.

**Fix direction:** one accessible modal foundation with labeling, focus lifecycle, Escape policy, background isolation, and appropriate scrolling. Verify keyboard and screen-reader workflows interactively.

### F38 — P2: Important controls require pointer interaction or lack field labels

**Evidence:** ActivityCard outer div; weekly SVG point groups; Profile avatar; PRPanel clickable cells; MonthlySnapshot heading; Home notes headers; placeholder-only activity inputs; unassociated labels in settings/filter forms.

These click targets generally have no keyboard equivalent, focusability, or expanded/pressed state. The weekly chart's image label does not expose selectable weeks. Many inputs lack durable accessible names. Hidden file import input is triggered by a label without a keyboard-focusable button. The floating `+` button lacks a descriptive action label.

**Fix direction:** native buttons or correctly implemented keyboard widgets, programmatic labels, expanded/selected states, meaningful names, and a text/table alternative for chart data.

### F39 — P2: Weekly chart selection has small targets and forced scrolling

**Evidence:** WeeklyMileage SVG circles have radius 4, 20 px slots, and selection-triggered smooth scroll with `visibleWeeks = 4`.

Point targets are small on touch devices. Selecting a point always scrolls the chart using a fixed pixel offset that ignores actual viewport width. This can move context unexpectedly. Comments claim a roughly three-month default window although the offset uses four weeks. Resize handling listens only to window resize, so container changes can leave dynamic scaling stale.

**Fix direction:** larger transparent hit targets, viewport-aware scrolling only when needed, container observation, and a defined initial visible range. Verify on narrow screens and long histories.

### F40 — P2: Heatmap/history generation has no effective range bound

**Evidence:** LargeHeatmap accepts `weeksToShow` but never uses it; loops from earliest record to current week; Home/Profile weekly aggregation similarly spans all history.

An ancient or mistyped year generates huge day/week arrays and DOM/SVG trees. LargeHeatmap also spreads all daily scores into `Math.max`, which can exceed argument limits for extreme ranges. Ordinary long histories grow cost indefinitely. Future-only histories can generate an empty range even though records exist.

**Fix direction:** validate date limits and future-date policy, honor a bounded/virtualized visible range, and avoid spread on unbounded arrays. Preserve access to older history through navigation.

### F41 — P2: Filtering can leave the wrong activity expanded

**Evidence:** Activity stores `expandedIndex`; reset effect depends only on `filteredActivities.length`.

Changing sort/filter results without changing the result count retains the old numeric index. The card occupying that position changes, so a different activity can suddenly be expanded. The visible rendering window also fails to reset for equal-count filter changes. Exact date search compares raw strings, so slash-format imports are missed.

**Fix direction:** store expansion by stable ID, reset pagination on the actual filter/query identity, and compare canonical dates. Reject inverted/invalid filter ranges with clear feedback.

### F42 — P2: Every route loads the spreadsheet implementation up front

**Evidence:** static App → Activity → importHelpers imports; build's single 837.31 kB JS chunk.

Home/Profile users pay for spreadsheet import/export and all route code at initial load. No route or optional import feature splitting exists. The size warning is measured; actual device load times were not benchmarked.

**Fix direction:** lazy-load route modules and optional spreadsheet tooling, then compare real transfer/parse/render costs. Avoid optimizing calculations without measurement.

### F43 — P3: Excessive debug logging includes personal activity data

**Evidence:** Activity PR/list logs; RunCalendar logs full activities, every activity date, every tile, and every render.

Console output can include notes, activity details, and large photo data URLs. It also adds avoidable work and obscures useful errors. No actual external logging pipeline was observed.

**Fix direction:** remove routine data dumps and use development-only, redacted diagnostics.

### F44 — P2: No user motion/sound preference handling

**Evidence:** AddActivityModal vibration, Activity mount audio, JarDropModal timers/audio, weekly smooth scrolling/pulses, CSS animations; no prefers-reduced-motion rule found.

Feedback is automatic with no in-app opt-out, and animations do not adapt to reduced-motion preference. JarDropModal cannot be dismissed manually before its timer. These are source-confirmed gaps; actual sensory/accessibility impact needs user testing.

**Fix direction:** explicit feedback preferences, reduced-motion support, predictable dismissibility, and graceful handling of denied vibration/audio APIs.

### F45 — P3: UI promises and available actions do not always match

**Evidence:** StravaModal says export downloads CSV although default is XLSX; AddActivityModal says Photos / Videos but previews every file through img; Profile `removeAvatar` is unused; ProfileTopSection hardcodes a US flag.

Video/unsupported uploads produce broken previews and consume storage. Users cannot remove an avatar through the existing UI. The country display can misrepresent the user. Export format is hidden inside advanced activity filters, making discovery difficult.

**Fix direction:** align text and controls with supported behavior, expose avatar removal and format selection, and decide whether country is configurable or omitted.

### F46 — P3: Notes import overwrites without a preview and persistence runs per keystroke

**Evidence:** Home `handleImportNotes` replaces card text; noteCards effect serializes the whole collection on each edit.

Importing text replaces existing note content immediately, with no merge choice/undo. Every character synchronously writes all notes to localStorage. Large notes can make typing sluggish and quota failures are not surfaced. Text export adds a Date/Notes wrapper, so importing the result does not restore the original raw note text.

**Fix direction:** replace/append preview or undo, deliberate notes backup semantics, and debounced/durable persistence with error feedback.

## Findings: maintainability, verification, and release readiness

### F47 — P2: Lint is failing and includes a latent undefined reference

**Evidence:** [full lint output](../audit-lint-results.json); Home line 339 references undeclared `textareaRefs` in unused `copyAllNotesText`.

The 39 errors include Node `process` incorrectly linted with browser-only globals, unused code, empty catches, synchronous state updates in effects, a nonfunctional nullish fallback, and React Compiler memoization incompatibility in EasyJar. There are three hook-dependency warnings. The undefined notes helper is currently unused, so it is a latent defect rather than a current click-path crash. Lint violations alone do not establish runtime failure.

**Fix direction:** separate server/browser lint environments; remove dead paths; refactor state initialization/effects and memo dependencies with behavior checks. Do not suppress every hook rule just to get a green command.

### F48 — P2: No automated regression suite or CI configuration is present

**Evidence:** package scripts expose dev/build/lint/preview/server only; repository file inventory contains no application tests or CI workflow.

The currently observed date, split, PR, coach, and round-trip defects have no automated protection. A passing build cannot catch them.

**Fix direction:** prioritize meaningful tests for canonical data normalization, save/edit, mixed-sport history, split totals, import/export, PR rules, timezone boundaries, storage recovery, and OAuth callback validation. Add CI for the agreed required checks, then a small browser smoke suite for core user journeys.

### F49 — P2: Storage/state logic and business rules are duplicated

**Evidence:** App/Activity save implementations; independent route hydration; multiple date parsers; duplicate PR/weekly calculations; one large App.css with repeated selectors.

Routes own independent snapshots of the same data and do not subscribe to changes. Profile retains unused weekly chart calculations, state, helpers, and imports. CSS repeats selectors such as `.modal-overlay`, `.weekly-chart-scroll`, and `.weekly-svg`, making effective styles depend on distant order. These patterns already contribute to inconsistent behavior and increase repair risk.

**Fix direction:** one activity repository/store, canonical schema with migrations, shared selectors/formatters, clear modal ownership, and scoped or organized styles. Refactor incrementally around verified behavior.

### F50 — P2: User data has no managed recovery, sync, or complete deletion model

**Evidence:** all durable user state is browser localStorage; Delete All removes only activities; backup limitations in F06.

Clearing site data, switching browsers/devices, or losing the browser profile loses the only stored copy unless the user has manually exported fragments. Delete All leaves notes, avatar, name, preferences, Strava token, and feedback flags. A second tab can remain stale after deletion and later overwrite state. A local-only app can be a valid design, but the limits and recovery path are not communicated.

**Fix direction:** decide local-only versus accounts/sync, provide a complete backup/recovery path, and distinguish delete activities, reset application, and disconnect provider. Avoid promising cloud persistence without implementing it.

### F51 — P3: Project setup and operating instructions are missing

**Evidence:** README is the Vite starter text; no environment example, runtime version pin, deployment runbook, or app-specific usage/import schema.

The repository does not explain how to run both processes, configure Strava, choose supported Node/npm versions, register callback URLs, back up data, deploy, or interpret its metrics. Missing env vars only produce a warning. Catch-all routing has no application-level not-found screen.

**Fix direction:** write setup/environment/deployment and import-format documentation; define runtime versions and supported browsers; document metric definitions, persistence, recovery, and operations. Replace remaining starter branding/assets where appropriate.

## Recommended repair sequence

1. Capture a full-fidelity copy of current user data before changing its format. Agree on date, duration, sport, PR, week, and merge definitions.
2. Fix F01–F09 and establish a validated, versioned activity model plus reliable storage boundary. Add focused regression coverage around these workflows.
3. Repair shared PR/date/coach/jar calculations and migrate existing records with a reviewable report of ambiguous values.
4. Triage dependency advisories; rebuild the Strava credential/session flow and configure a real deployed backend before public availability.
5. Consolidate modal/state ownership, remove reload-based saves, and complete keyboard/dialog accessibility.
6. Split optional code, bound long-history views, clean lint/dead code, and document setup/backup/deployment. Verify the final agreed release checks.

This ordering is a suggested implementation plan, not authorization to change data or publish anything. Many direct bug fixes are clear from the code; the questionnaire below identifies choices that change the correct implementation.

## Questionnaire for fixing the program properly

Answer by question number. Short answers are fine; “use your recommendation” is sufficient where you have no preference. Questions marked **essential** most strongly affect data compatibility and architecture. You do not need to answer every preference before clear crash/validation fixes can begin.

### Purpose, audience, and deployment

1. **Essential:** Is Velo intended only for you, a small private group, or public users? Is the current live app already holding data you need preserved?
2. **Essential:** Should the app remain local to one browser, or support accounts, cloud backup, and multiple devices?
3. **Essential:** Where should the frontend and backend run in production? Is Vercel the intended frontend host, and do you already have a backend host/domain?
4. Which devices and browsers matter most: iPhone Safari, Android Chrome, desktop browsers, or others?
5. Must the app work offline? If so, which workflows must remain available?
6. What is the largest realistic history: number of activities, years of data, note size, and media count?

### Existing data and storage

7. **Essential:** Do you have existing CSV/Excel exports, browser-only data, or legacy records whose format must remain compatible? Describe their date and duration formats without sharing secrets.
8. **Essential:** May an eventual repair migrate stored records automatically after making a backup, or should you review a migration preview first?
9. **Essential:** For ambiguous or invalid historical values, should the app quarantine records for review, leave them visible with warnings, or attempt explicit repairs?
10. Should backup/restore include activities, photos, splits, notes, profile, and settings in one file? Recommended: yes, with provider credentials excluded.
11. Should delete controls offer undo/trash? How long should recoverable deleted records remain?
12. Should “Delete All” mean activities only, or should there also be a separate complete application reset?
13. Do you use multiple tabs or devices simultaneously, and how should conflicts be resolved?

### Activity schema, dates, units, and splits

14. **Essential:** Which sports must be supported, including walks, hikes, strength, indoor cycling, treadmill, and unsupported Strava sports?
15. **Essential:** Should distance be stored/displayed in miles only, or should users choose kilometers/meters/yards by sport?
16. **Essential:** Should duration mean elapsed time or moving time? Should both be preserved when available?
17. **Essential:** What entry formats should duration support: decimal minutes, `mm:ss`, `hh:mm:ss`, or separate fields?
18. **Essential:** Should an activity retain its original local calendar date/time when you travel, or display in the viewer's current timezone?
19. **Essential:** Are future-dated activities valid planned workouts, or should this program contain completed activities only?
20. **Essential:** Should the reporting week begin Monday or Sunday across mileage and coaching? May the calendar grid use a separate preference?
21. **Essential:** In split mode, is each row distance at a given mph, and should splits always determine the saved total distance/time?
22. Should split entry also support pace, duration, recovery intervals, or metric units? Should individual splits be removable/reorderable?
23. Which fields must be required for runs versus strength/time-only workouts? Are zero-distance activities valid?
24. Are `easy`, `tempo`, `intervals`, and `long` the final intensity categories? Is “long” a workout type that can also be easy/hard?
25. Should race tags affect coaching/PR eligibility, and should imported effort initially be unknown until reviewed?
26. Is elevation tracking required? What unit/source should be authoritative?

### PRs, statistics, and coaching

27. **Essential:** What counts as a PR: an exact-distance whole activity, a race, a best segment within any activity, or an estimated equivalent performance?
28. **Essential:** Should shorter-than-event distances ever qualify? If GPS tolerance is allowed, how should time/distance be adjusted and labeled?
29. How should equal PR times be handled: first achievement, latest achievement, or all tied activities?
30. Should easy percentage use miles, minutes, or number of runs? Should the app show more than one clearly labeled measure?
31. Should average pace be total duration divided by total distance, or the average of per-run paces?
32. Should monthly trends compare full months, month-to-date against equivalent prior days, or both? Should zero-activity months appear?
33. **Essential:** Should coach alerts analyze the present day, or describe conditions at the last logged run? Recommended: present-day analysis with clearly retrospective activity notes where appropriate.
34. Do you want the existing coach rules retained after correcting their implementation, or should thresholds and messages be redesigned?
35. Should coaching use only running or account for cycling/swimming/strength load too?
36. How should fitness level, injury context, planned recovery weeks, and training goals affect coach rules, if at all?
37. Should users be able to disable individual rules, change thresholds, or hide coaching entirely?

### Jars and feedback

38. **Essential:** What earns a jar ball: every easy run, a minimum distance/time, or an activity you explicitly approve?
39. At the 25th eligible run, should a completed jar move to history immediately and show a new empty jar? Recommended: yes.
40. Should editing/deleting/backdating old activities recalculate jar history, or are awarded jars permanent achievements?
41. Should imported easy runs earn jars and trigger celebrations? Should edits ever trigger the add celebration?
42. Which feedback do you want enabled by default: sound, vibration, animation? Should each have its own preference?

### Imports, exports, media, and notes

43. **Essential:** On repeated imports, should matching records be skipped, merged, or presented for review? Which source wins for edited names/notes?
44. Should spreadsheets preserve stable IDs and all supported activity fields, even if that adds columns?
45. Do you need compatibility with a specific existing spreadsheet template or another training application?
46. When a file contains invalid rows, should the entire import stop, or should valid rows import after a preview with a rejected-row report?
47. Should an import support multiple worksheets and allow selecting the relevant sheet?
48. Are activity videos actually required, or should upload support images only? What size/count limits are acceptable?
49. Should images be compressed/resized automatically, and must originals be retained?
50. When importing notes into a populated card, should users replace, append, or choose each time?
51. Should note export be a raw text round trip or a formatted document with date/title metadata?
52. Do you want draft autosave, recovery after accidental close, or explicit save/discard for activity forms?

### Strava and privacy

53. **Essential:** Do you want to keep Strava integration, and is it already configured for a deployed app? Do not paste client secrets or access tokens into answers.
54. Should Strava import all historical activities, a date range, or only recent activities?
55. Should Strava sync be manual, scheduled, or webhook-driven? Is automatic background syncing actually needed?
56. **Essential:** Should later Strava edits/deletions update locally edited records? Which fields should always remain private/local?
57. Is access to private Strava activities necessary, or can authorization use a narrower scope?
58. Should disconnect revoke provider authorization, remove cached credentials only, or also offer deletion of imported records?
59. If cloud accounts are added, what sharing/export/retention controls do you expect for notes, media, and private activities?

### Interaction, accessibility, and delivery

60. Should Save preserve the current route/filters/scroll position and show a confirmation without reloading? Recommended: yes.
61. Should avatar removal and country selection be available, or should the flag be removed?
62. For the weekly chart, how many weeks should initially be visible, and should selection automatically scroll only when offscreen?
63. Is the full-history heatmap essential on first render, or would a recent-year view with navigation be preferable?
64. Do you have accessibility requirements beyond a baseline of keyboard navigation, labeled controls, screen-reader dialogs, and reduced motion?
65. Which is the first repair milestone you want to review: data safety/core calculations, Strava production readiness, or a complete release including accessibility?
66. Which checks should block releases, and do you want CI configured in the repository? Recommended: build, lint, core logic tests, and selected browser smoke tests.
67. Are dependency/parser replacements acceptable if they alter the spreadsheet implementation while preserving your agreed file compatibility?
68. Are there any workflows or visual behaviors you especially want preserved while the internal architecture is repaired?

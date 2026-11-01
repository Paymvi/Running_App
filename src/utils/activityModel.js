// Shared activity rules: parsing, validation, normalization and derived metrics.
// Every page and importer should go through these instead of parsing fields itself.
// Distances are stored in miles; see units.js for display conversion.

import { normalizeYMD, parseLocalYMD, todayYMD } from "./dateUtils.js";
import { fromDisplay, toDisplay } from "./units.js";

export const TYPES = ["run", "bike", "swim", "hike", "workout", "strength"];
// "unknown" = effort not recorded (e.g. Strava imports). It is neither easy nor hard.
export const INTENSITIES = ["easy", "tempo", "intervals", "long", "unknown"];
export const FEELS = ["easy", "medium", "hard"];
export const STATUSES = ["completed", "planned"];
export const JAR_SIZE = 25;

const round = (n, dp) => Math.round(n * 10 ** dp) / 10 ** dp;
const isBlank = (v) => v == null || String(v).trim() === "";

// Distance-like value (miles, mph). Returns a number >= 0, or null when blank/invalid.
export function parseDistance(value) {
  if (isBlank(value)) return null;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  const s = String(value).trim();
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
  return Number(s);
}

// Duration in minutes. Accepts decimal minutes ("45", "45.5"), "m:ss" and "h:mm:ss".
// Returns a number >= 0, or null when blank/invalid (e.g. "5:60", "-3", "abc").
export function parseDuration(value) {
  if (isBlank(value)) return null;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  const s = String(value).trim();
  let m;
  if ((m = s.match(/^(\d+):([0-5]\d)$/))) return Number(m[1]) + Number(m[2]) / 60;
  if ((m = s.match(/^(\d+):([0-5]\d):([0-5]\d)$/))) return Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 60;
  return parseDistance(s);
}

// 0 when missing; use activityPaceParts when "missing" must not count as zero.
export const activityMiles = (a) => parseDistance(a?.miles) ?? 0;
export const activityMinutes = (a) => parseDuration(a?.duration) ?? 0;

// { miles, minutes } only when both are recorded (> 0); otherwise null (pace unavailable).
export function activityPaceParts(a) {
  const miles = activityMiles(a);
  const minutes = activityMinutes(a);
  return miles > 0 && minutes > 0 ? { miles, minutes } : null;
}

export function activityMph(a) {
  const p = activityPaceParts(a);
  return p ? p.miles / (p.minutes / 60) : null;
}

// Total valid duration / the matching distance; activities without both are left out of both sides.
export function weightedPace(list) {
  let miles = 0;
  let minutes = 0;
  for (const a of list) {
    const p = activityPaceParts(a);
    if (!p) continue;
    miles += p.miles;
    minutes += p.minutes;
  }
  return miles > 0 ? { minutesPerMile: minutes / miles, miles, minutes } : null;
}

// ---- Status -----------------------------------------------------------------
// Missing status means completed (every record before plans existed). A record flagged
// needsReview "status" (dated in the future when plans were introduced) is neither
// planned nor completed until the user says which.
export const isUnconfirmed = (a) => Boolean(a?.needsReview?.includes("status"));
export const isPlanned = (a) => a?.status === "planned" && !isUnconfirmed(a);
export const isCompleted = (a) => Boolean(a) && a.status !== "planned" && !isUnconfirmed(a);

// Completed and dated: what every training statistic counts.
export const isCountable = (a) => isCompleted(a) && Boolean(parseLocalYMD(a.date));
export const activityType = (a) => a?.type || "run";
export const isCountableRun = (a) => isCountable(a) && activityType(a) === "run";

// No date/distance/duration/splits value awaiting review.
const DATA_REVIEW = ["date", "miles", "duration", "splits", "status"];
export const hasDataReview = (a) => Boolean(a?.needsReview?.some((f) => DATA_REVIEW.includes(f)));

// Each split is "distance at mph": miles = sum(distance), minutes = sum(distance / mph * 60).
export function computeSplitTotals(splits = []) {
  let miles = 0;
  let minutes = 0;
  let count = 0;
  const invalidRows = [];

  (splits || []).forEach((s, i) => {
    if (isBlank(s?.mph) && isBlank(s?.distance)) return;
    const mph = parseDistance(s?.mph);
    const distance = parseDistance(s?.distance);
    if (!(mph > 0) || !(distance > 0)) {
      invalidRows.push(i);
      return;
    }
    miles += distance;
    minutes += (distance / mph) * 60;
    count += 1;
  });

  return { miles: round(miles, 3), minutes: round(minutes, 2), count, invalidRows };
}

// Display-unit string for a stored miles value (used to prefill the form).
export const displayNumber = (miles, unit) =>
  isBlank(miles) || parseDistance(miles) === null ? String(miles ?? "") : String(round(toDisplay(Number(miles), unit), 3));

// Form splits are typed in the display unit; stored splits are mph / miles.
const splitsToDisplay = (splits, unit) =>
  (splits || []).map((s) => ({ mph: displayNumber(s.mph, unit), distance: displayNumber(s.distance, unit) }));

export function activityToForm(a, unit = "mi") {
  return {
    ...a, // keep every stored field (source ids, legacy values, ...)
    title: a.title ?? "",
    description: a.description ?? "",
    notes: a.notes ?? "",
    type: a.type || "run",
    intensity: a.intensity || "easy",
    feel: a.feel || "medium",
    limiter: a.limiter ?? "",
    tags: Array.isArray(a.tags) ? [...a.tags] : [],
    date: normalizeYMD(a.date) || "",
    time: a.time ?? "",
    status: isUnconfirmed(a) ? "" : a.status === "planned" ? "planned" : "completed",
    mode: a.mode === "splits" ? "splits" : "timeMiles",
    miles: displayNumber(a.miles, unit),
    duration: a.duration ?? "",
    splits: a.splits?.length ? splitsToDisplay(a.splits, unit) : [{ mph: "", distance: "" }],
  };
}

// Validates the add/edit form (distances typed in `unit`). Returns { errors } or { errors: {}, activity }.
// `original` is the stored record being edited: untouched distance fields keep their exact stored
// value instead of being re-derived from the rounded display number.
export function validateActivityForm(form, { unit = "mi", original = null, today = todayYMD() } = {}) {
  const errors = {};

  const date = normalizeYMD(form.date);
  if (isBlank(form.date)) errors.date = "Date is required.";
  else if (!date) errors.date = "Enter a real calendar date between 1900 and 2100.";

  if (!isBlank(form.time) && !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time)) {
    errors.time = "Enter a valid time (HH:MM).";
  }
  if (!TYPES.includes(form.type)) errors.type = "Choose an activity type.";
  if (!INTENSITIES.includes(form.intensity)) errors.intensity = "Choose an intensity.";
  if (!FEELS.includes(form.feel)) errors.feel = "Choose how it felt.";
  if (!STATUSES.includes(form.status)) errors.status = "Choose whether this is completed or planned.";
  else if (form.status === "completed" && date && date > today) {
    errors.status = "A completed activity can't be dated in the future. Mark it Planned or fix the date.";
  }

  const unitName = unit === "km" ? "Kilometers" : "Miles";
  const toMiles = (v) => (unit === "km" ? round(fromDisplay(v, unit), 6) : v);
  const originalForm = original ? activityToForm(original, unit) : null;

  let miles = null;
  let duration = null;
  let splits = [];

  if (form.mode === "splits") {
    const unchanged = originalForm && JSON.stringify(form.splits) === JSON.stringify(originalForm.splits);
    const stored = unchanged
      ? original.splits
      : (form.splits || [])
          .filter((s) => !isBlank(s.mph) || !isBlank(s.distance))
          .map((s) => ({
            mph: parseDistance(s.mph) === null ? s.mph : toMiles(Number(s.mph)),
            distance: parseDistance(s.distance) === null ? s.distance : toMiles(Number(s.distance)),
          }));
    const totals = computeSplitTotals(stored);
    if (totals.invalidRows.length) {
      errors.splits = `Split ${totals.invalidRows.map((i) => i + 1).join(", ")}: enter speed and distance greater than 0.`;
    } else if (!totals.count) {
      errors.splits = "Add at least one split with speed and distance.";
    } else {
      miles = totals.miles;
      duration = totals.minutes;
      splits = stored.map((s) => ({ mph: Number(s.mph), distance: Number(s.distance) }));
    }
  } else {
    if (!isBlank(form.miles)) {
      if (originalForm && String(form.miles) === originalForm.miles) miles = parseDistance(original.miles);
      else {
        const typed = parseDistance(form.miles);
        miles = typed === null ? null : toMiles(typed);
      }
      if (miles === null) errors.miles = `${unitName} must be a number (0 or more).`;
    }
    if (!isBlank(form.duration)) {
      duration = parseDuration(form.duration);
      if (duration === null) errors.duration = "Use minutes (45 or 45.5), mm:ss, or h:mm:ss.";
    }
    // Strength sessions may omit both; every other type needs a distance or a duration.
    if (form.type !== "strength" && !errors.miles && !errors.duration && !(miles > 0) && !(duration > 0)) {
      errors.miles = "Enter a distance or a duration.";
    }
  }

  if (Object.keys(errors).length) return { errors };

  return {
    errors: {},
    activity: {
      ...form,
      date,
      status: form.status,
      mode: form.mode === "splits" ? "splits" : "timeMiles",
      miles: miles ?? "",
      duration: duration === null ? "" : round(duration, 2),
      splits,
    },
  };
}

// Normalizes one stored/legacy record without losing information.
// Returns null for values that are not activity objects (callers quarantine those).
// Changed formats keep their original under `legacy`; values that cannot be
// interpreted are left untouched and listed in `needsReview`.
export function normalizeStoredActivity(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const a = { ...raw };
  const legacy = { ...(raw.legacy || {}) };
  // "status" review is decided by the user, not re-derived here.
  const issues = (raw.needsReview || []).filter((f) => f === "status");

  a.id = isBlank(a.id) ? crypto.randomUUID() : String(a.id);

  for (const key of ["type", "intensity", "feel"]) {
    if (typeof a[key] === "string") {
      const lower = a[key].trim().toLowerCase();
      if (lower !== a[key] && [...TYPES, ...INTENSITIES, ...FEELS].includes(lower)) a[key] = lower;
    }
  }

  const ymd = normalizeYMD(a.date);
  if (ymd) {
    if (ymd !== a.date) {
      legacy.date ??= a.date;
      a.date = ymd;
    }
  } else {
    issues.push("date");
  }

  if (!isBlank(a.miles)) {
    const miles = parseDistance(a.miles);
    if (miles === null) issues.push("miles");
    else a.miles = miles;
  }

  if (!isBlank(a.duration)) {
    const minutes = parseDuration(a.duration);
    if (minutes === null) issues.push("duration");
    else {
      if (String(a.duration).includes(":")) legacy.duration ??= a.duration;
      a.duration = round(minutes, 2);
    }
  }

  // Split-mode records saved before totals were calculated.
  if (a.mode === "splits" && isBlank(a.miles) && isBlank(a.duration)) {
    const totals = computeSplitTotals(a.splits);
    if (totals.count && !totals.invalidRows.length) {
      a.miles = totals.miles;
      a.duration = totals.minutes;
    } else {
      issues.push("splits");
    }
  }

  if (Object.keys(legacy).length) a.legacy = legacy;
  if (issues.length) a.needsReview = issues;
  else delete a.needsReview;
  return a;
}

// Newest first: by date, then time, then id for a stable order.
export function compareActivitiesNewestFirst(a, b) {
  const da = parseLocalYMD(a.date)?.getTime() ?? -Infinity;
  const db = parseLocalYMD(b.date)?.getTime() ?? -Infinity;
  if (da !== db) return db - da;
  return String(b.time || "").localeCompare(String(a.time || ""));
}

// Every valid completed easy run earns a ball; no extra distance/time minimum.
export const isJarEligible = (a) =>
  isCountableRun(a) &&
  a.intensity === "easy" &&
  !hasDataReview(a) &&
  (activityMiles(a) > 0 || activityMinutes(a) > 0);

// Easy runs oldest-first, chunked into jars of 25. A jar is moved to history the
// moment it holds 25 balls, so `current` is then a new, empty jar.
// Recomputed from the current records every time (edits/deletes can change history).
export function buildJarGroups(activities) {
  const runs = activities
    .filter(isJarEligible)
    .sort((a, b) => compareActivitiesNewestFirst(b, a))
    .map((a) => ({
      key: a.id,
      id: a.id,
      date: a.date,
      miles: activityMiles(a),
      duration: activityMinutes(a),
      label: "Easy Run",
    }));

  const groups = [];
  for (let i = 0; i < runs.length; i += JAR_SIZE) groups.push(runs.slice(i, i + JAR_SIZE));

  const completed = groups.filter((g) => g.length === JAR_SIZE);
  const last = groups[groups.length - 1];
  return { groups, completed, current: last && last.length < JAR_SIZE ? last : [] };
}

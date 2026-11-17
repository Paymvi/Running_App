// Import from the Stars habit tracker. Reads the JSON Stars writes from Settings -> Export backup
// (schema version 1): `runs` ({ id, date, distanceMi?, notes? }) and `workouts`, which are lifts
// ({ id, date, type: Push/Pull/Legs/..., notes? }). Nothing here writes; the preview modal saves
// through mergeImported once the user confirms.

import { normalizeYMD, todayYMD } from "./dateUtils.js";
import { activityMiles, activityType, displayNumber, formatDuration, parseDistance, readDurationInput, validateActivityForm } from "./activityModel.js";
import { MAX_IMPORT_BYTES } from "./importHelpers.js";
import { distLabel, speedLabel } from "./units.js";

export const STARS_SOURCE = "stars";
const STARS_VERSION = 1;
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const blank = (v) => String(v ?? "").trim() === "";

// JSON text -> rows, one per Stars entry. Entries that can't be read stay in the list with a
// `problem` so they are shown, not silently dropped. Throws a readable Error for a bad file.
export function parseStarsBackup(text) {
  if (text.length > MAX_IMPORT_BYTES) throw new Error("File is larger than 5 MB.");
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file isn't valid JSON. Choose the file from Stars' Settings → Export backup.");
  }
  if (!isObj(data) || !Array.isArray(data.runs) || !Array.isArray(data.workouts)) {
    throw new Error("This isn't a Stars backup (no runs or workouts list). Choose the file from Stars' Settings → Export backup.");
  }
  if (data.version !== STARS_VERSION) {
    throw new Error(`This Stars backup uses schema version ${JSON.stringify(data.version)}; Velo reads version ${STARS_VERSION}.`);
  }

  const row = (kind, e, i) => {
    const sourceId = isObj(e) && typeof e.id === "string" && e.id ? e.id : null;
    const date = isObj(e) && typeof e.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? normalizeYMD(e.date) : null;
    const notes = isObj(e) && typeof e.notes === "string" ? e.notes : "";
    const d = isObj(e) ? e.distanceMi : undefined;
    const distanceMi = typeof d === "number" && Number.isFinite(d) && d > 0 ? d : null;
    const label = kind === "strength" ? (isObj(e) && typeof e.type === "string" ? e.type.trim() : "") : "Run";
    let problem = null;
    if (!sourceId) problem = "Missing its Stars id.";
    else if (!date) problem = `Invalid date ${JSON.stringify(isObj(e) ? e.date : e)}.`;
    else if (kind === "strength" && !label) problem = "Missing its workout type.";
    else if (d !== undefined && distanceMi === null) problem = `Invalid distance ${JSON.stringify(d)}.`;
    return { key: `${kind}:${sourceId ?? `#${i}`}`, kind, sourceId, date, label, notes, distanceMi, problem };
  };

  return [...data.runs.map((e, i) => row("run", e, i)), ...data.workouts.map((e, i) => row("strength", e, i))].sort(
    (a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")) || a.key.localeCompare(b.key)
  );
}

// Adds { status, reason } to each row: "invalid", "imported" (same Stars id already in Velo),
// "duplicate" (a Velo activity of the same type on the same date with a compatible distance)
// or "new". Only "new" rows start selected; "invalid" and "imported" can't be selected.
export function classifyStarsRows(rows, current) {
  const imported = new Set(current.filter((a) => a.source === STARS_SOURCE).map((a) => String(a.sourceId)));
  return rows.map((r) => {
    if (r.problem) return { ...r, status: "invalid", reason: r.problem };
    if (imported.has(r.sourceId)) return { ...r, status: "imported", reason: "Already imported from Stars." };
    const match = current.find((c) => {
      if (c.date !== r.date || activityType(c) !== r.kind) return false;
      const miles = activityMiles(c);
      return r.distanceMi == null || !(miles > 0) || Math.abs(miles - r.distanceMi) <= 0.15;
    });
    if (match) {
      const what = r.kind === "run" ? "run" : "strength session";
      const title = match.title ? ` (“${match.title}”)` : "";
      return { ...r, status: "duplicate", reason: `Possible duplicate: Velo already has a ${what}${title} on this date. Left unselected.` };
    }
    return { ...r, status: "new", reason: "" };
  });
}

// What the run fields start with: Stars only ever has a distance.
export const initialRunEntry = (row, unit = "mi") => ({
  distance: row.distanceMi == null ? "" : displayNumber(row.distanceMi, unit),
  duration: "",
  speed: "",
});

// Distance and speed typed in `unit`, time as MMSS/HMMSS digits. Blank means not recorded; 0 is
// refused rather than read as blank. Any two values give the third; three must agree.
// Returns { distance, minutes, speed, derived, errors } (numbers or null; derived names the
// calculated field). On save only distance and time are stored; speed is always derived from them.
export function resolveRunEntry({ distance = "", duration = "", speed = "" }, unit = "mi") {
  const errors = {};
  const dl = distLabel(unit);
  const sl = speedLabel(unit);
  const num = (value, field, name) => {
    if (blank(value)) return null;
    const n = parseDistance(value);
    if (n === null) errors[field] = `${name} must be a number.`;
    else if (n === 0) errors[field] = `${name} can't be 0. Leave it blank if you don't know it.`;
    return n || null;
  };
  let d = num(distance, "distance", "Distance");
  let s = num(speed, "speed", "Speed");
  const typed = readDurationInput(duration);
  let minutes = typed.minutes ?? null;
  if (typed.error) errors.duration = typed.error;
  else if (minutes === 0) errors.duration = "Time can't be 00:00. Leave it blank if you don't know it.";
  if (Object.keys(errors).length) return { distance: null, minutes: null, speed: null, derived: null, errors };

  let derived = null;
  if (d && minutes && s) {
    const calc = d / (minutes / 60);
    // Speed is typed to one decimal, so allow its rounding.
    if (Math.abs(calc - s) > 0.05 + 1e-9) {
      errors.speed = `These don't agree: ${d} ${dl} in ${formatDuration(minutes)} is ${calc.toFixed(1)} ${sl}. Clear or fix one of the three.`;
    }
  } else if (d && minutes) {
    s = d / (minutes / 60);
    derived = "speed";
  } else if (d && s) {
    minutes = Math.round((d / s) * 3600) / 60; // whole seconds, as Velo shows time
    derived = "duration";
  } else if (minutes && s) {
    d = Math.round(s * (minutes / 60) * 100) / 100;
    derived = "distance";
  } else if (s) {
    errors.speed = "Speed alone can't be saved. Add a distance or a time.";
  } else if (!d && !minutes) {
    errors.distance = "Missing: Velo needs a distance or a time for a run.";
  }
  return { distance: d, minutes, speed: s, derived, errors };
}

// One selected row -> { activity } ready for mergeImported, or { errors } (messages to show).
export function starsRowToActivity(row, entry, { unit = "mi", today = todayYMD() } = {}) {
  let miles = "";
  let duration = "";
  if (row.kind === "run") {
    const r = resolveRunEntry(entry || initialRunEntry(row, unit), unit);
    if (Object.keys(r.errors).length) return { errors: Object.values(r.errors) };
    if (r.distance) miles = String(r.distance);
    if (r.minutes) duration = formatDuration(r.minutes).replaceAll(":", ""); // the form's digit format
  }
  const form = {
    title: row.label,
    description: "",
    notes: row.notes,
    type: row.kind,
    intensity: "unknown", // Stars doesn't record effort; same as Strava imports
    feel: "medium",
    limiter: "",
    tags: [],
    date: row.date,
    time: "",
    status: "completed",
    mode: "timeMiles",
    miles,
    duration,
    splits: [],
    source: STARS_SOURCE,
    sourceId: row.sourceId,
  };
  const { errors, activity } = validateActivityForm(form, { unit, today });
  if (errors.status) errors.status = "Dated in the future, so it can't be imported as a completed workout.";
  if (!activity) return { errors: Object.values(errors) };
  return { activity: { ...activity, id: crypto.randomUUID() } };
}

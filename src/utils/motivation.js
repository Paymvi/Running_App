// The Profile motivation section: which module shows (Easy Run Jar or Constellations), its
// settings, and the Constellations rules. Progress is always derived from the activity list,
// never stored, so edits, deletions, imports, backdating and restores recompute it.
import { TYPES, activityMiles, activityMinutes, activityType, buildCycles, hasDataReview, isCountable, isJarEligible } from "./activityModel.js";
import { normalizeYMD } from "./dateUtils.js";
import { SHAPES } from "./constellationShapes.js";
import { describeWriteError, readJSON } from "./storage.js";

// ---- Settings -----------------------------------------------------------------
export const MOTIVATION_KEY = "velo_motivation";
export const MODULE_IDS = ["jar", "constellations"];

// Missing or unreadable values fall back to these, so existing users keep the jar as before.
export function getMotivationSettings(storage = globalThis.localStorage) {
  const raw = readJSON(MOTIVATION_KEY, {}, storage);
  const s = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    module: MODULE_IDS.includes(s.module) ? s.module : "jar",
    hidden: s.hidden === true,
    animations: s.animations !== false,
    starColors: s.starColors === "white" ? "white" : "type",
  };
}

// Returns an error message, or null when saved.
export function setMotivationSettings(settings, storage = globalThis.localStorage) {
  try {
    storage.setItem(MOTIVATION_KEY, JSON.stringify(settings));
    return null;
  } catch (e) {
    return describeWriteError(e);
  }
}

// ---- Constellations ---------------------------------------------------------------
export const STARS_PER_CONSTELLATION = 12;
export const CONSTELLATIONS_PER_SKY = 4;
export const TYPE_LABELS = { run: "Run", bike: "Bike", swim: "Swim", hike: "Hike", workout: "Workout", strength: "Strength" };

// Any completed activity of any type, with nothing under review. Strength needs no distance or time.
export const countsForActiveDay = (a) => isCountable(a) && !hasDataReview(a);

// A day with several types takes the first in Velo's type order (run, bike, swim, hike, workout, strength).
const dayType = (list) => TYPES.find((t) => list.some((a) => a.type === t)) ?? list[0].type;

// One entry per calendar day with at least one counted activity, oldest first.
export function buildActiveDays(activities) {
  const byDate = new Map();
  for (const a of activities) {
    if (!countsForActiveDay(a)) continue;
    const date = normalizeYMD(a.date);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push({
      id: a.id,
      title: a.title || "",
      type: activityType(a),
      miles: activityMiles(a),
      minutes: activityMinutes(a),
      time: a.time || "",
    });
  }
  return [...byDate.keys()].sort().map((date) => {
    const list = byDate.get(date).sort((a, b) => a.time.localeCompare(b.time) || String(a.id).localeCompare(String(b.id)));
    return { date, activities: list, type: dayType(list) };
  });
}

export const shapeFor = (index) => SHAPES[index % SHAPES.length];

// Every constellation (12 days each) grouped into season skies of 4.
// `current` is the constellation being filled (possibly empty); `currentSky` holds the
// completed constellations shown dimmed beside it; `skies` is everything for the Star Atlas.
export function buildSky(activities) {
  const days = buildActiveDays(activities);
  const { groups, completed } = buildCycles(days, STARS_PER_CONSTELLATION);
  const constellations = groups.map((stars, index) => ({
    index,
    shape: shapeFor(index),
    stars,
    complete: stars.length === STARS_PER_CONSTELLATION,
  }));
  const done = completed.length;
  const current = constellations[done] ?? { index: done, shape: shapeFor(done), stars: [], complete: false };
  if (!constellations[done]) constellations.push(current);

  const skies = [];
  for (let i = 0; i < constellations.length; i += CONSTELLATIONS_PER_SKY) {
    const list = constellations.slice(i, i + CONSTELLATIONS_PER_SKY);
    // Not-yet-started constellations of this sky are shown as faint guides.
    while (list.length < CONSTELLATIONS_PER_SKY) list.push({ index: i + list.length, shape: shapeFor(i + list.length), stars: [], complete: false });
    const stars = list.flatMap((c) => c.stars);
    skies.push({
      index: i / CONSTELLATIONS_PER_SKY,
      constellations: list,
      complete: list.every((c) => c.complete),
      firstDate: stars[0]?.date ?? null,
      lastDate: stars[stars.length - 1]?.date ?? null,
    });
  }
  const skyIndex = Math.floor(done / CONSTELLATIONS_PER_SKY);
  return {
    days,
    current,
    currentSky: constellations.slice(skyIndex * CONSTELLATIONS_PER_SKY, done),
    skyIndex,
    completedConstellations: done,
    completedSkies: skies.filter((s) => s.complete).length,
    // A sky with no stars yet (a fresh one) isn't listed in the atlas.
    skies: skies.filter((s) => s.firstDate),
  };
}

// The constellation that holds `activityId`'s day, and that star's position in it.
export function findStar(sky, activityId) {
  const dayIndex = sky.days.findIndex((d) => d.activities.some((a) => a.id === activityId));
  if (dayIndex < 0) return null;
  const index = Math.floor(dayIndex / STARS_PER_CONSTELLATION);
  return {
    constellation: { index, shape: shapeFor(index), stars: sky.days.slice(index * STARS_PER_CONSTELLATION, (index + 1) * STARS_PER_CONSTELLATION) },
    starIndex: dayIndex % STARS_PER_CONSTELLATION,
  };
}

// ---- Celebration ------------------------------------------------------------------
// True when `activity` (saved with its id) is the first counted activity on its day.
export function addsNewActiveDay(activity, activities) {
  if (!countsForActiveDay(activity)) return false;
  const date = normalizeYMD(activity.date);
  return !activities.some((a) => a.id !== activity.id && countsForActiveDay(a) && normalizeYMD(a.date) === date);
}

// Which celebration (if any) a save shows: only a newly created activity that adds progress to
// the selected, visible module. Edits, imports and plans never reach here as `created`.
export function celebrationFor(result, activity, activities, settings) {
  if (!result?.created || settings.hidden) return null;
  const saved = { ...activity, id: result.id };
  if (settings.module === "constellations") return addsNewActiveDay(saved, activities) ? "constellations" : null;
  return isJarEligible(saved) ? "jar" : null;
}

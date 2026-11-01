// Strava activity -> Velo activity. Sports outside these lists are skipped (and
// reported) instead of being counted as runs.
const SPORT_MAP = {
  run: ["Run", "TrailRun", "VirtualRun"],
  bike: ["Ride", "VirtualRide", "EBikeRide", "MountainBikeRide", "GravelRide", "EMountainBikeRide"],
  swim: ["Swim"],
  hike: ["Hike"],
  strength: ["WeightTraining"],
  workout: ["Workout", "Crossfit", "HighIntensityIntervalTraining"],
};

export const mapStravaTypeToYourType = (stravaType) =>
  Object.keys(SPORT_MAP).find((t) => SPORT_MAP[t].includes(String(stravaType || ""))) || null;

const round = (n, dp) => Math.round(n * 10 ** dp) / 10 ** dp;
const num = (v) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : null);

export const metersToMiles = (meters) => (num(meters) === null ? "" : round(num(meters) / 1609.344, 2));
export const secondsToMinutes = (seconds) => (num(seconds) === null ? "" : round(num(seconds) / 60, 2));

// start_date_local is the athlete's wall-clock time even though it ends in "Z";
// read the digits directly instead of converting through a Date.
export function localDateTimeParts(iso) {
  const m = String(iso || "").match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? { date: m[1], time: m[2] } : { date: "", time: "" };
}

export function stravaActivityToVelo(s) {
  const type = mapStravaTypeToYourType(s.sport_type || s.type);
  if (!type) return null;

  const { date, time } = localDateTimeParts(s.start_date_local || s.start_date);
  const elevation = num(s.total_elevation_gain);

  return {
    id: crypto.randomUUID(),
    source: "strava",
    sourceId: String(s.id),
    title: s.name || "Strava Activity",
    description: s.description || "",
    type,
    // Strava has no easy/hard field; "unknown" earns no jar credit and is neither easy nor hard in coaching.
    intensity: "unknown",
    feel: "medium",
    limiter: "",
    tags: [],
    date,
    time,
    mode: "timeMiles",
    // Runs use moving time (so pace ignores stops); other sports keep elapsed time. Both are stored.
    duration: secondsToMinutes(type === "run" ? s.moving_time ?? s.elapsed_time : s.elapsed_time ?? s.moving_time),
    elapsedMinutes: secondsToMinutes(s.elapsed_time),
    movingMinutes: secondsToMinutes(s.moving_time),
    miles: metersToMiles(s.distance),
    distanceMeters: num(s.distance),
    ...(elevation !== null && { elevationGainFt: Math.round(elevation * 3.28084) }),
    splits: [],
    notes: "Imported from Strava",
  };
}

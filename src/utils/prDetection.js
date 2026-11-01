// The one PR rule, used by the activity list and the Profile panel.
// A PR is a WHOLE-ACTIVITY time: a completed run at least the event distance and at
// most 3% longer. The recorded duration is used as-is (no estimate of a faster
// segment inside a longer run). On equal times the earliest run keeps the record.
import { activityMinutes, compareActivitiesNewestFirst, hasDataReview, isCountableRun } from "./activityModel.js";

const METERS_PER_MILE = 1609.344;
export const PR_EVENTS = [
  { key: "mile", label: "Mile", meters: METERS_PER_MILE },
  { key: "fiveK", label: "5K", meters: 5000 },
  { key: "tenK", label: "10K", meters: 10000 },
];
export const PR_MAX_OVER = 0.03;
const EPSILON_M = 0.01; // float noise from unit conversion, not a tolerance

// Strava imports keep the exact meters; otherwise convert the stored miles.
const activityMeters = (a) => {
  const exact = Number(a.distanceMeters);
  return Number.isFinite(exact) && exact > 0 ? exact : Number(a.miles) * METERS_PER_MILE;
};

export const qualifiesFor = (meters, event) =>
  meters >= event.meters - EPSILON_M && meters <= event.meters * (1 + PR_MAX_OVER) + EPSILON_M;

export function detectPRs(activities) {
  const result = Object.fromEntries(PR_EVENTS.map((e) => [e.key, { time: Infinity, id: null, date: null }]));

  const eligible = activities
    .filter((a) => isCountableRun(a) && !hasDataReview(a) && activityMinutes(a) > 0)
    .sort((a, b) => compareActivitiesNewestFirst(b, a)); // oldest first, so ties keep the earliest

  for (const a of eligible) {
    const meters = activityMeters(a);
    if (!Number.isFinite(meters)) continue;
    const time = activityMinutes(a);
    for (const event of PR_EVENTS) {
      if (qualifiesFor(meters, event) && time < result[event.key].time) {
        result[event.key] = { time, id: a.id, date: a.date, miles: meters / METERS_PER_MILE };
      }
    }
  }
  return result;
}

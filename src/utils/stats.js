// Training statistics shared by Home, Profile and coaching. Only completed runs count
// (planned and unconfirmed records never do). Reporting weeks run Monday–Sunday.
import { parseLocalYMD, toYMD } from "./dateUtils.js";
import { activityMiles, activityMinutes, durationSeconds, isCountableRun, weightedPace } from "./activityModel.js";

export function startOfWeekMonday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

const elevationFt = (a) => Number(a.elevationGainFt) || 0;

// Easy share of RUN MILES with a known effort. Unknown-effort miles are reported
// separately and left out of both sides, so they never count as easy or hard.
export function easyShare(runs) {
  let easyMiles = 0;
  let knownMiles = 0;
  let unknownMiles = 0;
  for (const a of runs) {
    const miles = activityMiles(a);
    if ((a.intensity || "unknown") === "unknown") unknownMiles += miles;
    else {
      knownMiles += miles;
      if (a.intensity === "easy") easyMiles += miles;
    }
  }
  return { easyMiles, knownMiles, unknownMiles, pct: knownMiles > 0 ? Math.round((easyMiles / knownMiles) * 100) : null };
}

// Monday–Sunday run totals from the first completed run's week to the current week (zero weeks included).
export function weeklyRunTotals(activities, today = new Date()) {
  const byWeek = new Map();
  let earliest = null;
  for (const a of activities) {
    if (!isCountableRun(a)) continue;
    const d = parseLocalYMD(a.date);
    if (!earliest || d < earliest) earliest = d;
    const key = toYMD(startOfWeekMonday(d));
    const w = byWeek.get(key) || { miles: 0, minutes: 0, elevationFt: 0 };
    w.miles += activityMiles(a);
    w.minutes += durationSeconds(activityMinutes(a)) / 60; // whole seconds, so the total matches the cards
    w.elevationFt += elevationFt(a);
    byWeek.set(key, w);
  }

  const end = startOfWeekMonday(today);
  const weeks = [];
  for (let ws = earliest ? startOfWeekMonday(earliest) : end; ws <= end; ws = addDays(ws, 7)) {
    const found = byWeek.get(toYMD(ws));
    weeks.push({
      weekStart: ws,
      miles: found ? Number(found.miles.toFixed(2)) : 0,
      minutes: found ? found.minutes : 0,
      elevationFt: found ? Math.round(found.elevationFt) : 0,
    });
  }
  return weeks;
}

function monthStats(runs) {
  const pace = weightedPace(runs.filter((a) => a.intensity === "easy"));
  return {
    miles: runs.reduce((s, a) => s + activityMiles(a), 0),
    longest: runs.reduce((m, a) => Math.max(m, activityMiles(a)), 0),
    share: easyShare(runs),
    avgEasyPace: pace ? pace.minutesPerMile : null,
    runCount: runs.length,
  };
}

// One card per calendar month from the first completed run to the current month (newest first,
// zero months included). The current month is compared with the same days of the previous
// month; earlier months are compared whole.
export function monthlySnapshot(activities, today = new Date()) {
  const runs = activities.filter(isCountableRun).map((a) => ({ a, d: parseLocalYMD(a.date) }));
  if (!runs.length) return [];

  const first = runs.reduce((m, r) => (r.d < m ? r.d : m), runs[0].d);
  const inMonth = (y, m, lastDay = 31) =>
    runs.filter((r) => r.d.getFullYear() === y && r.d.getMonth() === m && r.d.getDate() <= lastDay).map((r) => r.a);

  const out = [];
  for (let y = today.getFullYear(), m = today.getMonth(); ; m--) {
    if (m < 0) {
      m = 11;
      y--;
    }
    const start = new Date(y, m, 1);
    if (start < new Date(first.getFullYear(), first.getMonth(), 1)) break;

    const isCurrent = y === today.getFullYear() && m === today.getMonth();
    const prev = new Date(y, m - 1, 1);
    const prevLen = new Date(y, m, 0).getDate();
    const cutoff = isCurrent ? today.getDate() : 31;
    const stats = monthStats(inMonth(y, m, cutoff));
    const hasPrev = prev >= new Date(first.getFullYear(), first.getMonth(), 1);
    const prevStats = hasPrev ? monthStats(inMonth(prev.getFullYear(), prev.getMonth(), Math.min(cutoff, prevLen))) : null;
    const prevName = prev.toLocaleString("en-US", { month: "short" });

    out.push({
      key: `${y}-${m}`,
      label: `${start.toLocaleString("en-US", { month: "short" })} ${y}`,
      partial: isCurrent,
      ...stats,
      mileageDelta: prevStats ? stats.miles - prevStats.miles : null,
      comparedWith: prevStats
        ? isCurrent
          ? `vs ${prevName} 1–${Math.min(cutoff, prevLen)}`
          : `vs ${prevName}`
        : null,
    });
  }
  return out;
}

export function runTotals(activities, today = new Date()) {
  let total = 0;
  let month = 0;
  let year = 0;
  for (const a of activities) {
    if (!isCountableRun(a)) continue;
    const miles = activityMiles(a);
    const d = parseLocalYMD(a.date);
    total += miles;
    if (d.getFullYear() === today.getFullYear()) {
      year += miles;
      if (d.getMonth() === today.getMonth()) month += miles;
    }
  }
  return { totalMiles: total, thisMonthMiles: month, thisYearMiles: year };
}

// Coach alerts: pure training logic (no UI). Running only, analyzed as of TODAY.
// - Only completed runs count; planned and unconfirmed records are ignored.
// - Weeks are Monday–Sunday, and the current week-to-date is compared with the
//   same days of last week.
// - Pace baselines never include the runs being evaluated.
// - "unknown" effort is neither easy nor hard; analyses that need a missing input
//   (pace without a duration, effort without an intensity) are skipped.

import { parseLocalYMD, toYMD, calendarDaysBetween } from "./dateUtils.js";
import { activityMiles, activityMph, compareActivitiesNewestFirst, isCountableRun } from "./activityModel.js";
import { easyShare, startOfWeekMonday } from "./stats.js";
import { formatDistance, speedLabel, toDisplay } from "./units.js";

const toDate = (a) => parseLocalYMD(a.date);
const sumMiles = (list) => list.reduce((acc, a) => acc + activityMiles(a), 0);

function avgMph(list) {
  const vals = list.map(activityMph).filter((v) => v !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function median(nums) {
  const arr = nums.slice().sort((a, b) => a - b);
  const n = arr.length;
  if (!n) return null;
  const mid = Math.floor(n / 2);
  return n % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

const HARD = new Set(["tempo", "hard", "interval", "intervals", "race"]);
const isHard = (a) => HARD.has((a.intensity || "").toLowerCase());
const isEasy = (a) => (a.intensity || "").toLowerCase() === "easy";

// Alerts about "your last run" only apply while that run is recent.
const RECENT_DAYS = 7;

export function generateCoachAlerts(activities, maxAlerts = 1, { today = new Date(), unit = "mi" } = {}) {
  const requested = Math.trunc(Number(maxAlerts));
  const clampN = Number.isFinite(requested) ? Math.max(0, Math.min(requested, 6)) : 1;

  const PRIORITY = { red: 4, yellow: 3, green: 2, blue: 1 };
  const make = (color, title, detail, key) => ({
    key,
    toneClass: `easy-zone-${color}`,
    title,
    detail,
    priority: PRIORITY[color] || 1,
  });

  const now = new Date(today);
  now.setHours(0, 0, 0, 0);
  const daysAgo = (a) => calendarDaysBetween(toDate(a), now);

  const sorted = (activities || [])
    .filter((a) => a && isCountableRun(a) && daysAgo(a) >= 0)
    .sort(compareActivitiesNewestFirst);

  if (sorted.length === 0) {
    return [make("blue", "Log your first run 👟", "Add a few runs and I’ll start giving coach notes.", "empty-first-run")].slice(0, clampN);
  }

  const dist = (miles) => formatDistance(miles, unit);
  const speed = (mph) => `${toDisplay(mph, unit).toFixed(1)} ${speedLabel(unit)}`;

  const latest = sorted[0];
  const latestRecent = daysAgo(latest) <= RECENT_DAYS;
  const intensity = (latest.intensity || "").toLowerCase();
  const feel = (latest.feel || "").toLowerCase();
  const latestMph = activityMph(latest);

  // Week-to-date vs the same number of days last week.
  const ws = startOfWeekMonday(now);
  const dayIndex = calendarDaysBetween(ws, now);
  const between = (from, days) =>
    sorted.filter((a) => {
      const diff = calendarDaysBetween(from, toDate(a));
      return diff >= 0 && diff <= days;
    });
  const lastWs = new Date(ws);
  lastWs.setDate(ws.getDate() - 7);
  const thisWeek = between(ws, dayIndex);
  const lastWeekSamePart = between(lastWs, dayIndex);
  const thisWeekMiles = sumMiles(thisWeek);
  const lastWeekMiles = sumMiles(lastWeekSamePart);
  const portion = dayIndex === 6 ? "" : " (same days)";

  // Easy runs with a usable pace, newest first.
  const easyPaced = sorted.filter((a) => isEasy(a) && activityMph(a) !== null);

  const alerts = [];
  const push = (alert) => {
    if (alert && !alerts.some((a) => a.key === alert.key)) alerts.push(alert);
  };

  // 🔴 R1: easy but felt hard
  if (latestRecent && intensity === "easy" && feel === "hard") {
    push(make("red", "Marked easy… but it felt hard 🟥", "That’s a classic fatigue signal. Slow down next easy run or take a reset day.", "r1-easy-felt-hard"));
  }

  // 🔴 R2: back-to-back hard efforts on the same or consecutive days
  if (latestRecent && sorted.length >= 2) {
    const [a0, a1] = sorted;
    if (isHard(a0) && isHard(a1) && calendarDaysBetween(toDate(a1), toDate(a0)) <= 1) {
      push(make("red", "Back-to-back hard days 🚨", "Stacking intensity is how tempo creep turns into burnout. Next run: easy or rest.", "r2-b2b-hard"));
    }
  }

  // 🔴 R3: latest easy run much faster than the baseline of the 10 easy runs before it
  const baselineRuns = easyPaced.filter((a) => a !== latest).slice(0, 10);
  const baseline = baselineRuns.length >= 4 ? avgMph(baselineRuns) : null;
  if (
    latestRecent && intensity === "easy" && baseline !== null && latestMph !== null &&
    latestMph > baseline + 0.4 && (feel === "medium" || feel === "hard")
  ) {
    push(make("red", "That wasn’t easy 😅", `Easy pace creep: baseline ~${speed(baseline)}. Keep easy truly easy.`, "r3-easy-pace-creep"));
  }

  // 🟡 Y1: 3+ hard efforts in the last 7 days
  const hardCount7 = sorted.filter((a) => daysAgo(a) <= 7 && isHard(a)).length;
  if (hardCount7 >= 3) {
    push(make("yellow", "A lot of intensity this week ⚠️", `You’ve hit ${hardCount7} hard efforts in the last 7 days. Consider an easy reset.`, "y1-too-much-intensity"));
  }

  // 🟡 Y2: mileage spike vs the same part of last week
  if (lastWeekMiles >= 1 && thisWeekMiles >= 1) {
    const change = ((thisWeekMiles - lastWeekMiles) / lastWeekMiles) * 100;
    if (change >= 25) {
      push(make("yellow", `Mileage jump: +${Math.round(change)}% ⚠️`, `This week: ${dist(thisWeekMiles)} • Last week${portion}: ${dist(lastWeekMiles)}.`, "y2-mileage-spike"));
    }
  }

  // 🟡 Y3: ran 5+ of the last 6 days
  const runDays6 = new Set(sorted.filter((a) => daysAgo(a) <= 6).map((a) => toYMD(toDate(a)))).size;
  if (runDays6 >= 5) {
    push(make("yellow", "No-rest pattern ⚠️", `You ran ${runDays6} of the last 6 days. A rest day can make you faster.`, "y3-no-rest"));
  }

  // 🟡 Y4: recent 5 easy runs vs the 10 easy runs before them, with tougher feel
  const recentEasy = easyPaced.slice(0, 5);
  const driftBase = easyPaced.slice(5, 15);
  if (latestRecent && recentEasy.length >= 4 && driftBase.length >= 4) {
    const recentAvg = avgMph(recentEasy);
    const base = avgMph(driftBase);
    const tougher = recentEasy.filter((a) => ["medium", "hard"].includes((a.feel || "").toLowerCase())).length;
    if (recentAvg - base >= 0.35 && tougher >= 2) {
      push(make("yellow", "Easy pace is drifting (fatigue?) ⚠️", `Recent easy avg ~${speed(recentAvg)} vs baseline ~${speed(base)}.`, "y4-easy-drift"));
    }
  }

  // 🟡 Y5: last 4 runs stuck at the same distance (under 4 mi)
  const lastWithMiles = sorted.slice(0, 5).filter((a) => activityMiles(a) > 0).slice(0, 4).map(activityMiles);
  if (latestRecent && lastWithMiles.length === 4) {
    const med = median(lastWithMiles);
    if (lastWithMiles.every((m) => Math.abs(m - med) <= 0.6) && med <= 4.0) {
      push(make("yellow", "You keep hitting the same wall 🧱", `Last runs cluster around ~${dist(med)}. Try adding a little on your next easy run.`, "y5-wall"));
    }
  }

  // Easy % of this week's run miles with a known effort.
  const known = thisWeek.filter((a) => (a.intensity || "unknown") !== "unknown");
  const share = easyShare(thisWeek);
  if (known.length >= 3 && share.pct !== null) {
    if (share.pct <= 45) {
      push(make("yellow", "Intensity imbalance ⚠️", `${share.pct}% of this week’s miles were easy. Consider making the next run a true easy day.`, "y6-easy-too-low"));
    }
    if (share.pct >= 75) {
      push(make("green", `Discipline week ✅ ${share.pct}% easy`, "This is how base gets built. Keep stacking.", "g1-discipline"));
    }
  }

  // 🔵 Effort unknown for most runs this week: easy/hard analysis is incomplete.
  if (thisWeek.length - known.length > 0 && thisWeek.length - known.length >= known.length) {
    const n = thisWeek.length - known.length;
    push(make("blue", "Effort unknown ❔", `${n} run${n === 1 ? "" : "s"} this week ha${n === 1 ? "s" : "ve"} no intensity, so easy % and hard-day checks only use the rest. Edit them to set the effort.`, "b3-unknown-effort"));
  }

  // 🟢 steady week (same-days comparison)
  if (lastWeekMiles >= 3 && thisWeekMiles >= 3 && thisWeek.length >= 3) {
    const changeAbs = Math.abs((thisWeekMiles - lastWeekMiles) / lastWeekMiles) * 100;
    if (changeAbs <= 15) {
      push(make("green", "Steady week ✅", `Mileage stayed stable (${dist(thisWeekMiles)}). Consistency is the cheat code.`, "g2-steady-week"));
    }
  }

  // 🟢 comeback after a 7+ day gap
  if (latestRecent && sorted.length >= 2) {
    const gap = calendarDaysBetween(toDate(sorted[1]), toDate(sorted[0]));
    if (gap >= 7) {
      push(make("green", "Welcome back ✅", `You returned after ${gap} days. Keep it easy for a few runs and rebuild.`, "g3-comeback"));
    }
  }

  // 🔵 long run overdue (as of today)
  const longRun = sorted.find((a) => (a.intensity || "").toLowerCase() === "long");
  if (longRun && daysAgo(longRun) >= 14) {
    push(make("blue", "Long run is overdue 👻", `Last long run was ${daysAgo(longRun)} days ago. Even a chill long run counts.`, "b1-long-overdue"));
  }

  if (latestRecent && isHard(latest)) {
    push(make("blue", "Next move: easy reset 🧊", "You went hard last time. Keep the next run easy to actually get fitter.", "b2-next-move"));
  }

  if (alerts.length === 0) {
    push(make("blue", "Coach note: keep stacking reps 🧱", "Consistency beats hero workouts.", "b-default"));
  }

  alerts.sort((a, b) => b.priority - a.priority);
  return alerts.slice(0, clampN);
}

export function generateCoachAlert(activities, options) {
  return generateCoachAlerts(activities, 1, options)[0];
}

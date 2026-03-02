// src/utils/coachAlert.js

/* Why is this in utils and not in compoennts?
 Because this is logic, not UI

 The coach alert system is:
 Pure training logic that analyzes data and returns a result.
 That makes it a utility function, not a component.

*/

function isValidDate(d) {
  return d instanceof Date && !isNaN(d);
}

function toDate(activity) {
  const d = new Date(activity.date);
  return isValidDate(d) ? d : null;
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0..6 (Sun..Sat)
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

function endOfWeek(date) {
  const s = startOfWeek(date);
  const e = new Date(s);
  e.setDate(e.getDate() + 7);
  return e;
}

function sumMiles(list) {
  return list.reduce((acc, a) => acc + (Number(a.miles) || 0), 0);
}

function avgMph(list) {
  const vals = list.map(a => Number(a.mph)).filter(v => isFinite(v) && v > 0);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function median(nums) {
  const arr = nums.slice().sort((a,b) => a-b);
  const n = arr.length;
  if (!n) return null;
  const mid = Math.floor(n / 2);
  return n % 2 ? arr[mid] : (arr[mid-1] + arr[mid]) / 2;
}

function daysSince(dateA, dateB) {
  const ms = (dateB.getTime() - dateA.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function isHardIntensity(intensity) {
  const i = (intensity || "").toLowerCase();
  return i === "tempo" || i === "hard" || i === "interval" || i === "race";
}

function easyRuns(activities) {
  return activities
    .filter(a => (a.intensity || "").toLowerCase() === "easy")
    .filter(a => isFinite(Number(a.mph)) && Number(a.mph) > 0);
}

function easyBaselineMph(activities, count = 10) {
  const easy = easyRuns(activities).slice(0, count); // newest-first
  if (easy.length < 4) return null;
  return avgMph(easy);
}

function getWeekSlice(sorted, now) {
  const ws = startOfWeek(now);
  const we = endOfWeek(now);

  const thisWeek = sorted.filter(a => {
    const d = toDate(a);
    return d && d >= ws && d < we;
  });

  const lastWeekStart = new Date(ws);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(ws);

  const lastWeek = sorted.filter(a => {
    const d = toDate(a);
    return d && d >= lastWeekStart && d < lastWeekEnd;
  });

  return { thisWeek, lastWeek, ws };
}

function countRunDaysLastNDays(sorted, now, nDays = 6) {
  // counts unique calendar days with at least one run
  const seen = new Set();
  for (const a of sorted) {
    const d = toDate(a);
    if (!d) continue;
    const diff = daysSince(d, now);
    if (diff < 0) continue;
    if (diff <= nDays) {
      seen.add(d.toISOString().slice(0, 10));
    }
  }
  return seen.size;
}

function findLongestRunInDays(sorted, now, days = 14) {
  let best = null;
  for (const a of sorted) {
    const d = toDate(a);
    if (!d) continue;
    const diff = daysSince(d, now);
    if (diff < 0 || diff > days) continue;
    if (!best || (Number(a.miles) || 0) > (Number(best.miles) || 0)) best = a;
  }
  return best;
}

function detectWallPattern(sorted, now) {
  // If last 4 runs are all within ~0.6 miles of each other (and under 4 miles), you're “stuck”
  const last = sorted.slice(0, 5).filter(a => isFinite(Number(a.miles)) && Number(a.miles) > 0);
  if (last.length < 4) return null;

  const miles = last.slice(0, 4).map(a => Number(a.miles));
  const med = median(miles);
  if (!med) return null;

  const within = miles.every(m => Math.abs(m - med) <= 0.6);
  if (within && med <= 4.0) {
    return { med, sample: miles };
  }
  return null;
}

function easyDriftWarning(sorted) {
  // Compare recent easy mph vs baseline easy mph
  const baseline = easyBaselineMph(sorted, 10);
  const recentEasy = easyRuns(sorted).slice(0, 5);
  if (!baseline || recentEasy.length < 4) return null;

  const recentAvg = avgMph(recentEasy);
  if (!recentAvg) return null;

  // drift threshold (mph) – tweak later
  const drift = recentAvg - baseline;

  // Feel trend: if any of the recent easy runs felt medium/hard, flag more strongly
  const tougherFeelCount = recentEasy.filter(a => {
    const f = (a.feel || "").toLowerCase();
    return f === "medium" || f === "hard";
  }).length;

  if (drift >= 0.35 && tougherFeelCount >= 2) {
    return { baseline, recentAvg, drift };
  }

  return null;
}

export function generateCoachAlert(activities) {
  if (!activities || activities.length === 0) {
    return {
      toneClass: "easy-zone-blue",
      title: "Log your first run 👟",
      detail: "Add a few runs and I’ll start giving coach notes.",
    };
  }

  const sorted = [...activities].sort((a, b) => new Date(b.date) - new Date(a.date));
  const latest = sorted[0];
  const now = toDate(latest) || new Date();

  const { thisWeek, lastWeek } = getWeekSlice(sorted, now);

  const thisWeekMiles = sumMiles(thisWeek);
  const lastWeekMiles = sumMiles(lastWeek);

  const intensity = (latest.intensity || "").toLowerCase();
  const feel = (latest.feel || "").toLowerCase();
  const latestMph = Number(latest.mph);

  // -------------------------
  // 🔴 RED (highest priority)
  // -------------------------

  // R1: Easy but felt hard
  if (intensity === "easy" && feel === "hard") {
    return {
      toneClass: "easy-zone-red",
      title: "Marked easy… but it felt hard 🟥",
      detail: "That’s a classic fatigue signal. Slow down next easy run or take a reset day.",
    };
  }

  // R2: Back-to-back hard efforts
  if (sorted.length >= 2) {
    const a0 = sorted[0], a1 = sorted[1];
    if (isHardIntensity(a0.intensity) && isHardIntensity(a1.intensity)) {
      return {
        toneClass: "easy-zone-red",
        title: "Back-to-back hard days 🚨",
        detail: "Stacking intensity is how tempo creep turns into burnout. Next run: easy or rest.",
      };
    }
  }

  // R3: “This wasn’t easy” pace creep vs baseline + feel medium/hard
  const baseline = easyBaselineMph(sorted, 10);
  const tooFastForEasy =
    intensity === "easy" &&
    baseline !== null &&
    isFinite(latestMph) &&
    latestMph > baseline + 0.4 &&
    (feel === "medium" || feel === "hard");

  if (tooFastForEasy) {
    return {
      toneClass: "easy-zone-red",
      title: "That wasn’t easy 😅",
      detail: `Easy pace creep: baseline ~${baseline.toFixed(1)} mph. Keep easy truly easy.`,
    };
  }

  // -------------------------
  // 🟡 YELLOW (caution)
  // -------------------------

  // Y1: 3+ hard efforts in last 7 days
  const last7 = sorted.slice(0, 12); // not perfect; enough recent items
  const hardCount7 = last7.filter(a => {
    const d = toDate(a);
    if (!d) return false;
    return daysSince(d, now) <= 7 && isHardIntensity(a.intensity);
  }).length;

  if (hardCount7 >= 3) {
    return {
      toneClass: "easy-zone-yellow",
      title: "A lot of intensity this week ⚠️",
      detail: `You’ve hit ${hardCount7} hard efforts in the last 7 days. Consider an easy reset.`,
    };
  }

  // Y2: Mileage spike vs last week
  if (lastWeekMiles >= 1 && thisWeekMiles >= 1) {
    const change = ((thisWeekMiles - lastWeekMiles) / lastWeekMiles) * 100;
    if (change >= 25) {
      return {
        toneClass: "easy-zone-yellow",
        title: `Mileage jump: +${Math.round(change)}% ⚠️`,
        detail: `This week: ${thisWeekMiles.toFixed(1)} mi • Last week: ${lastWeekMiles.toFixed(1)} mi.`,
      };
    }
  }

  // Y3: No-rest-days pattern (ran 5+ of last 6 days)
  const runDays6 = countRunDaysLastNDays(sorted, now, 6);
  if (runDays6 >= 5) {
    return {
      toneClass: "easy-zone-yellow",
      title: "No-rest pattern ⚠️",
      detail: `You ran ${runDays6} of the last 6 days. A rest day can make you faster.`,
    };
  }

  // Y4: Easy pace drift upward + feel getting tougher
  const drift = easyDriftWarning(sorted);
  if (drift) {
    return {
      toneClass: "easy-zone-yellow",
      title: "Easy pace is drifting (fatigue?) ⚠️",
      detail: `Recent easy avg ~${drift.recentAvg.toFixed(1)} mph vs baseline ~${drift.baseline.toFixed(1)} mph.`,
    };
  }

  // Y5: Wall pattern (stuck at same distance)
  const wall = detectWallPattern(sorted, now);
  if (wall) {
    return {
      toneClass: "easy-zone-yellow",
      title: "You keep hitting the same wall 🧱",
      detail: `Last runs cluster around ~${wall.med.toFixed(1)} mi. Try adding +0.2 mi on your next easy run.`,
    };
  }

  // Y6: Too little easy (this week)
  const totalCount = thisWeek.length;
  const easyCount = thisWeek.filter(a => (a.intensity || "").toLowerCase() === "easy").length;
  if (totalCount >= 3) {
    const easyPct = Math.round((easyCount / totalCount) * 100);
    if (easyPct <= 45) {
      return {
        toneClass: "easy-zone-yellow",
        title: "Intensity imbalance ⚠️",
        detail: `${easyPct}% easy this week. Consider making the next run a true easy day.`,
      };
    }
  }

  // -------------------------
  // 🟢 GREEN (praise)
  // -------------------------

  if (totalCount >= 3) {
    const easyPct = Math.round((easyCount / totalCount) * 100);
    if (easyPct >= 75) {
      return {
        toneClass: "easy-zone-green",
        title: `Discipline week ✅ ${easyPct}% easy`,
        detail: "This is how base gets built. Keep stacking.",
      };
    }
  }

  // G2: Consistency win (stable mileage week-over-week)
  if (lastWeekMiles >= 3 && thisWeekMiles >= 3) {
    const changeAbs = Math.abs((thisWeekMiles - lastWeekMiles) / lastWeekMiles) * 100;
    if (changeAbs <= 15 && totalCount >= 3) {
      return {
        toneClass: "easy-zone-green",
        title: "Steady week ✅",
        detail: `Mileage stayed stable (${thisWeekMiles.toFixed(1)} mi). Consistency is the cheat code.`,
      };
    }
  }

  // G3: Comeback win (7+ day gap before latest)
  if (sorted.length >= 2) {
    const d0 = toDate(sorted[0]);
    const d1 = toDate(sorted[1]);
    if (d0 && d1) {
      const gap = daysSince(d1, d0);
      if (gap >= 7) {
        return {
          toneClass: "easy-zone-green",
          title: "Welcome back ✅",
          detail: `You returned after ${gap} days. Keep it easy for a few runs and rebuild.`,
        };
      }
    }
  }

  // -------------------------
  // 🔵 BLUE (default / informative)
  // -------------------------

  // B1: Long run overdue (if user has any "long" runs logged)
  const longRun = sorted.find(a => (a.intensity || "").toLowerCase() === "long");
  if (longRun) {
    const d = toDate(longRun);
    if (d) {
      const ds = daysSince(d, now);
      if (ds >= 14) {
        return {
          toneClass: "easy-zone-blue",
          title: "Long run is overdue 👻",
          detail: `Last long run was ${ds} days ago. Even a chill long run counts.`,
        };
      }
    }
  }

  // B2: Next best move based on last run
  if (isHardIntensity(intensity)) {
    return {
      toneClass: "easy-zone-blue",
      title: "Next move: easy reset 🧊",
      detail: "You went hard last time. Keep the next run easy to actually get fitter.",
    };
  }

  return {
    toneClass: "easy-zone-blue",
    title: "Coach note: keep stacking reps 🧱",
    detail: "Consistency beats hero workouts.",
  };
}
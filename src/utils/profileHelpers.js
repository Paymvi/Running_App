// Make sure to make it "export function" so that react can import them


import { formatDisplayDate } from "./dateUtils.js";

// Minutes -> "m:ss". Rounds total seconds once so 5.999 becomes "6:00", not "5:60".
export function formatTime(min) {
  if (!Number.isFinite(min) || min < 0) return "-";
  const total = Math.round(min * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export const formatDate = formatDisplayDate;

// -------------------------
// WEEK HELPERS
// -------------------------
export function formatWeekRange(startDateObj) {
  const end = new Date(startDateObj);
  end.setDate(end.getDate() + 6);
  const sameMonth = startDateObj.getMonth() === end.getMonth();
  const sameYear = startDateObj.getFullYear() === end.getFullYear();

  const startStr = startDateObj.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  const endStr = end.toLocaleDateString("en-US", {
    month: sameMonth ? undefined : "long",
    day: "numeric",
  });

  // Optional: if weeks can span years (rare), add year
  const yearStr = sameYear ? "" : `, ${end.getFullYear()}`;

  return `${startStr} - ${endStr}${yearStr}`;
}

export function formatHoursMinsFromMinutes(totalMinutes) {
  if (!isFinite(totalMinutes)) return "-";
  const mins = Math.round(totalMinutes);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}


export function getEasyZone(pct) {
  if (pct < 50) {
    return {
      label: "Workout Heavy",
      className: "easy-zone-red",
    };
  }
  if (pct < 70) {
    return {
      label: "Workout Leaning",
      className: "easy-zone-yellow",
    };
  }
  if (pct <= 85) {
    return {
      label: "Balanced Aerobic",
      className: "easy-zone-green",
    };
  }
  return {
    label: "Recovery / Base",
    className: "easy-zone-blue",
  };
}


export function daysAgo(dateObj) {
    if (!dateObj) return null;
    const diff = new Date() - dateObj;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

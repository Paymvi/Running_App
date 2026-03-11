export const mapStravaTypeToYourType = (stravaType) => {
  const t = String(stravaType || "").toLowerCase();
  if (t.includes("run")) return "run";
  if (t.includes("ride") || t.includes("bike")) return "bike";
  if (t.includes("swim")) return "swim";
  return "run";
};

export const metersToMiles = (meters) => {
  const m = Number(meters);
  if (!Number.isFinite(m)) return "";
  return (m / 1609.34).toFixed(2);
};

export const secondsToMinutes = (seconds) => {
  const s = Number(seconds);
  if (!Number.isFinite(s)) return "";
  return Math.round(s / 60);
};
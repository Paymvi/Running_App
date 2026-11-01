// Distances are stored in miles everywhere (activities, splits, exports). The
// miles/kilometers preference only changes what is typed and shown.
import { useSyncExternalStore } from "react";

export const UNIT_KEY = "velo_units";
export const MI_PER_KM = 1 / 1.609344;
export const KM_PER_MI = 1.609344;

const listeners = new Set();

export function getUnit() {
  try {
    return globalThis.localStorage?.getItem(UNIT_KEY) === "km" ? "km" : "mi";
  } catch {
    return "mi";
  }
}

// Returns an error message, or null when saved.
export function setUnit(unit) {
  try {
    localStorage.setItem(UNIT_KEY, unit === "km" ? "km" : "mi");
  } catch {
    return "Couldn't save the unit setting (browser storage refused it).";
  }
  listeners.forEach((l) => l());
  return null;
}

const subscribe = (l) => {
  listeners.add(l);
  const onStorage = (e) => e.key === UNIT_KEY && l();
  globalThis.addEventListener?.("storage", onStorage);
  return () => {
    listeners.delete(l);
    globalThis.removeEventListener?.("storage", onStorage);
  };
};

export const useUnit = () => useSyncExternalStore(subscribe, getUnit, () => "mi");

// Stored miles -> number in the display unit.
export const toDisplay = (miles, unit) => (unit === "km" ? miles * KM_PER_MI : miles);
// Typed number in the display unit -> stored miles.
export const fromDisplay = (value, unit) => (unit === "km" ? value * MI_PER_KM : value);

export const distLabel = (unit) => (unit === "km" ? "km" : "mi");
export const speedLabel = (unit) => (unit === "km" ? "km/h" : "mph");

// "3.1 mi" / "5 km"; "-" for missing.
export function formatDistance(miles, unit, dp = 1) {
  if (!Number.isFinite(miles)) return "-";
  return `${Number(toDisplay(miles, unit).toFixed(dp))} ${distLabel(unit)}`;
}

// Sound/vibration feedback, both on by default (existing behaviour) and switchable in Edit Profile.
import { readJSON } from "./storage.js";

const KEY = "velo_feedback";
const DEFAULTS = { sound: true, vibration: true };

export function getFeedbackPrefs() {
  return { ...DEFAULTS, ...readJSON(KEY, {}) };
}

export function setFeedbackPrefs(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}

export function vibrate(pattern) {
  if (!getFeedbackPrefs().vibration) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // unsupported or blocked: feedback is optional
  }
}

export function playSound(src, volume = 0.6) {
  if (!getFeedbackPrefs().sound) return;
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    audio.play().catch(() => {});
  } catch {
    // unsupported: feedback is optional
  }
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

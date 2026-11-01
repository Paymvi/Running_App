// Talks to the Velo server (server/), which holds the Strava tokens. The browser
// only carries an httpOnly session cookie, so requests use credentials: "include".
import { stravaActivityToVelo } from "./stravaHelpers.js";

export const API_BASE = (import.meta.env?.VITE_API_URL || "http://localhost:5050").replace(/\/$/, "");

const PER_PAGE = 200;
const MAX_PAGES = 100; // 20,000 activities

export const connectUrl = () => `${API_BASE}/auth/strava`;

async function request(path, options = {}) {
  const resp = await fetch(`${API_BASE}${path}`, { credentials: "include", ...options });
  const data = await resp.json().catch(() => ({}));
  return { status: resp.status, ok: resp.ok, data };
}

export async function getStravaStatus() {
  try {
    const { ok, data } = await request("/api/strava/status");
    return ok ? { connected: Boolean(data.connected) } : { connected: false };
  } catch {
    return { connected: false, offline: true };
  }
}

export async function disconnectStrava() {
  const { ok, data } = await request("/auth/strava/disconnect", { method: "POST" });
  if (!ok) throw new Error(data.error || "Disconnect failed.");
}

// Fetches pages until a short page. `fetchPage(page)` resolves to { status, ok, data }.
// Stops early (keeping what it has) on rate limiting or errors.
export async function collectStravaPages(fetchPage, onProgress = () => {}) {
  const raw = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { status, ok, data } = await fetchPage(page);
    if (!ok) {
      const reason =
        status === 401 ? "Strava session expired or was revoked. Connect again." :
        status === 429 ? "Strava rate limit reached. Try again in 15 minutes; already-imported activities will be skipped." :
        data?.error || "Strava request failed.";
      return { raw, error: reason, partial: raw.length > 0 };
    }
    const list = Array.isArray(data.activities) ? data.activities : [];
    raw.push(...list);
    onProgress(raw.length);
    if (list.length < PER_PAGE) return { raw };
  }
  return { raw, error: `Stopped after ${MAX_PAGES * PER_PAGE} activities.`, partial: true };
}

export function mapStravaActivities(raw) {
  const activities = [];
  const unsupported = {};
  for (const s of raw) {
    const a = stravaActivityToVelo(s);
    if (a && a.date) activities.push(a);
    else {
      const t = s.sport_type || s.type || "unknown";
      unsupported[t] = (unsupported[t] || 0) + 1;
    }
  }
  return { activities, unsupported };
}

export function fetchAllStravaActivities(onProgress) {
  return collectStravaPages(
    (page) => request(`/api/strava/activities?per_page=${PER_PAGE}&page=${page}`),
    onProgress
  );
}

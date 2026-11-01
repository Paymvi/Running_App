import express from "express";
import cors from "cors";
import crypto from "node:crypto";

const STRAVA = "https://www.strava.com";
const STATE_COOKIE = "velo_oauth_state";
const SESSION_COOKIE = "velo_sid";
const STATE_TTL_S = 10 * 60;
const SESSION_TTL_S = 30 * 24 * 60 * 60;
const UPSTREAM_TIMEOUT_MS = 15000;

function parseCookies(header = "") {
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const safeEqual = (a, b) =>
  typeof a === "string" && typeof b === "string" && a.length === b.length &&
  crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Integer query param within [min, max], or null if absent/invalid.
function intParam(value, min, max) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

/**
 * Strava OAuth + activity proxy. Tokens never leave the server: the browser holds
 * only an httpOnly session cookie.
 *
 * shortcut: sessions live in memory (lost on restart, single process only);
 * move to a persistent store before running more than one instance.
 */
export function createApp({ config, fetchImpl = globalThis.fetch, sessions = new Map(), log = console }) {
  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REDIRECT_URI, FRONTEND_URL } = config;
  const secure = FRONTEND_URL.startsWith("https://");
  const cookieAttrs = `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;

  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: FRONTEND_URL, credentials: true }));

  const upstream = (url, options = {}) =>
    fetchImpl(url, { ...options, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });

  const setCookie = (res, name, value, maxAge) =>
    res.append("Set-Cookie", `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; ${cookieAttrs}`);
  const clearCookie = (res, name) => res.append("Set-Cookie", `${name}=; Max-Age=0; ${cookieAttrs}`);

  const toFrontend = (res, result) => res.redirect(`${FRONTEND_URL}/activity?strava=${result}`);

  function getSession(req) {
    const sid = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    const session = sid && sessions.get(sid);
    if (!session) return null;
    if (session.createdAt + SESSION_TTL_S * 1000 < Date.now()) {
      sessions.delete(sid);
      return null;
    }
    return { sid, session };
  }

  async function tokenRequest(body) {
    const resp = await upstream(`${STRAVA}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: STRAVA_CLIENT_ID, client_secret: STRAVA_CLIENT_SECRET, ...body }),
    });
    if (!resp.ok) {
      log.error(`Strava token request failed: HTTP ${resp.status}`);
      return null;
    }
    const data = await resp.json();
    if (typeof data.access_token !== "string") return null;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Number(data.expires_at) || 0,
    };
  }

  // Returns a valid access token, refreshing it when it is about to expire; null if unusable.
  async function accessTokenFor({ sid, session }) {
    if (session.expiresAt - 60 > Date.now() / 1000) return session.accessToken;
    const refreshed = session.refreshToken
      ? await tokenRequest({ grant_type: "refresh_token", refresh_token: session.refreshToken })
      : null;
    if (!refreshed) {
      sessions.delete(sid);
      return null;
    }
    Object.assign(session, refreshed, { refreshToken: refreshed.refreshToken || session.refreshToken });
    return session.accessToken;
  }

  app.get("/health", (req, res) => res.json({ ok: true }));

  // Step 1: send the browser to Strava with a single-use state bound to this browser.
  app.get("/auth/strava", (req, res) => {
    const state = crypto.randomBytes(16).toString("hex");
    setCookie(res, STATE_COOKIE, state, STATE_TTL_S);
    const url = new URL(`${STRAVA}/oauth/authorize`);
    url.search = new URLSearchParams({
      client_id: STRAVA_CLIENT_ID,
      redirect_uri: STRAVA_REDIRECT_URI,
      response_type: "code",
      approval_prompt: "auto",
      // Public activities only; switch to "activity:read_all" if private activities are needed.
      scope: "activity:read",
      state,
    }).toString();
    res.redirect(url.toString());
  });

  // Step 2: Strava returns here. Only accept the callback for the request this browser started.
  app.get("/auth/strava/callback", async (req, res) => {
    const { code, error, state, scope } = req.query;
    const expected = parseCookies(req.headers.cookie)[STATE_COOKIE];
    clearCookie(res, STATE_COOKIE);

    if (!safeEqual(state, expected)) return toFrontend(res, "error");
    if (error || typeof code !== "string" || !code) return toFrontend(res, "error");

    const granted = typeof scope === "string" ? scope.split(",") : [];
    if (!granted.includes("activity:read") && !granted.includes("activity:read_all")) {
      return toFrontend(res, "error");
    }

    try {
      const tokens = await tokenRequest({ code, grant_type: "authorization_code" });
      if (!tokens) return toFrontend(res, "error");

      const sid = crypto.randomBytes(32).toString("hex");
      sessions.set(sid, { ...tokens, scope: granted, createdAt: Date.now() });
      setCookie(res, SESSION_COOKIE, sid, SESSION_TTL_S);
      return toFrontend(res, "connected");
    } catch (e) {
      log.error(`Strava callback failed: ${e.name}`);
      return toFrontend(res, "error");
    }
  });

  app.get("/api/strava/status", (req, res) => {
    res.json({ connected: Boolean(getSession(req)) });
  });

  // Step 3: proxy the athlete's activities. GET /api/strava/activities?per_page=200&page=1
  app.get("/api/strava/activities", async (req, res) => {
    const found = getSession(req);
    if (!found) return res.status(401).json({ error: "Not connected to Strava." });

    const perPage = intParam(req.query.per_page, 1, 200) ?? (req.query.per_page === undefined ? 50 : null);
    const page = intParam(req.query.page, 1, 1000) ?? (req.query.page === undefined ? 1 : null);
    if (perPage === null || page === null) {
      return res.status(400).json({ error: "per_page must be 1-200 and page 1-1000." });
    }

    try {
      const token = await accessTokenFor(found);
      if (!token) {
        clearCookie(res, SESSION_COOKIE);
        return res.status(401).json({ error: "Strava session expired. Connect again." });
      }

      const resp = await upstream(`${STRAVA}/api/v3/athlete/activities?per_page=${perPage}&page=${page}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (resp.status === 401) {
        sessions.delete(found.sid);
        clearCookie(res, SESSION_COOKIE);
        return res.status(401).json({ error: "Strava access was revoked or expired. Connect again." });
      }
      if (resp.status === 429) {
        const retryAfter = resp.headers.get("retry-after");
        if (retryAfter) res.set("Retry-After", retryAfter);
        return res.status(429).json({ error: "Strava rate limit reached." });
      }
      if (!resp.ok) {
        log.error(`Strava activities request failed: HTTP ${resp.status}`);
        return res.status(502).json({ error: "Strava request failed." });
      }

      const data = await resp.json();
      return res.json({ activities: Array.isArray(data) ? data : [] });
    } catch (e) {
      const timedOut = e.name === "TimeoutError" || e.name === "AbortError";
      log.error(`Strava activities request error: ${e.name}`);
      return res.status(timedOut ? 504 : 502).json({ error: timedOut ? "Strava timed out." : "Server error." });
    }
  });

  // Revokes Velo's Strava authorization and forgets the session. Imported activities are untouched.
  app.post("/auth/strava/disconnect", async (req, res) => {
    const found = getSession(req);
    clearCookie(res, SESSION_COOKIE);
    if (!found) return res.json({ ok: true });

    sessions.delete(found.sid);
    try {
      const resp = await upstream(`${STRAVA}/oauth/deauthorize`, {
        method: "POST",
        headers: { Authorization: `Bearer ${found.session.accessToken}` },
      });
      if (!resp.ok) log.error(`Strava deauthorize failed: HTTP ${resp.status}`);
    } catch (e) {
      log.error(`Strava deauthorize error: ${e.name}`);
    }
    return res.json({ ok: true });
  });

  return app;
}

const REQUIRED = ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET", "STRAVA_REDIRECT_URI", "FRONTEND_URL"];

// Returns a list of problems with the configuration (empty when valid). Never includes secret values.
export function validateConfig(env) {
  const problems = REQUIRED.filter((k) => !env[k]).map((k) => `${k} is missing`);
  for (const k of ["STRAVA_REDIRECT_URI", "FRONTEND_URL"]) {
    if (!env[k]) continue;
    try {
      if (!/^https?:$/.test(new URL(env[k]).protocol)) problems.push(`${k} must be an http(s) URL`);
    } catch {
      problems.push(`${k} is not a valid URL`);
    }
  }
  if (env.FRONTEND_URL?.endsWith("/")) problems.push("FRONTEND_URL must not end with /");
  return problems;
}

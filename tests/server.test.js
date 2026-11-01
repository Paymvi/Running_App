import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp, validateConfig } from "../server/app.js";

const config = {
  STRAVA_CLIENT_ID: "cid",
  STRAVA_CLIENT_SECRET: "csecret",
  STRAVA_REDIRECT_URI: "http://localhost:5050/auth/strava/callback",
  FRONTEND_URL: "http://localhost:5173",
};

// Mocked Strava: records calls; behaviour switchable per test.
const strava = { calls: [], activitiesStatus: 200, tokenExpiresAt: () => Math.floor(Date.now() / 1000) + 3600 };
const fakeFetch = async (url, options = {}) => {
  strava.calls.push({ url: String(url), options });
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  if (url.endsWith("/oauth/token")) {
    return json(200, { access_token: "tok-" + strava.calls.length, refresh_token: "ref", expires_at: strava.tokenExpiresAt() });
  }
  if (url.endsWith("/oauth/deauthorize")) return json(200, {});
  if (url.includes("/athlete/activities")) {
    return strava.activitiesStatus === 200 ? json(200, [{ id: 1 }]) : json(strava.activitiesStatus, { message: "nope" });
  }
  return json(404, {});
};

const sessions = new Map();
let server;
let base;
const quietLog = { error: () => {} };

before(async () => {
  server = createApp({ config, fetchImpl: fakeFetch, sessions, log: quietLog }).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const get = (path, cookie) => fetch(base + path, { redirect: "manual", headers: cookie ? { cookie } : {} });
const cookieValue = (resp, name) => {
  const c = resp.headers.getSetCookie().find((x) => x.startsWith(`${name}=`));
  return c ? c.split(";")[0] : null;
};

async function connect() {
  const start = await get("/auth/strava");
  const stateCookie = cookieValue(start, "velo_oauth_state");
  const state = new URL(start.headers.get("location")).searchParams.get("state");
  const cb = await get(`/auth/strava/callback?code=abc&state=${state}&scope=read,activity:read_all`, stateCookie);
  return { cb, sid: cookieValue(cb, "velo_sid") };
}

test("authorize redirect carries a state that matches an httpOnly cookie (F22)", async () => {
  const resp = await get("/auth/strava");
  assert.equal(resp.status, 302);
  const location = new URL(resp.headers.get("location"));
  assert.equal(location.origin, "https://www.strava.com");
  const state = location.searchParams.get("state");
  assert.match(state, /^[0-9a-f]{32}$/);
  const set = resp.headers.getSetCookie().find((c) => c.startsWith("velo_oauth_state="));
  assert.ok(set.includes(state) && /HttpOnly/.test(set) && /SameSite=Lax/.test(set));
});

test("callbacks without the matching state are rejected and create no session", async () => {
  const before = sessions.size;
  const noCookie = await get("/auth/strava/callback?code=abc&state=deadbeef&scope=activity:read_all");
  assert.equal(noCookie.headers.get("location"), `${config.FRONTEND_URL}/activity?strava=error`);
  const wrong = await get("/auth/strava/callback?code=abc&state=aaaa&scope=activity:read_all", "velo_oauth_state=bbbb");
  assert.equal(wrong.headers.get("location"), `${config.FRONTEND_URL}/activity?strava=error`);
  assert.equal(sessions.size, before);
});

test("callbacks without an activity scope are rejected", async () => {
  const start = await get("/auth/strava");
  const state = new URL(start.headers.get("location")).searchParams.get("state");
  const cb = await get(`/auth/strava/callback?code=abc&state=${state}&scope=read`, cookieValue(start, "velo_oauth_state"));
  assert.match(cb.headers.get("location"), /strava=error/);
});

test("successful connect keeps the token server-side (F21)", async () => {
  const { cb, sid } = await connect();
  const location = cb.headers.get("location");
  assert.equal(location, `${config.FRONTEND_URL}/activity?strava=connected`);
  assert.ok(!location.includes("tok-"));
  assert.ok(sid);
  // The state cookie is single-use: it is cleared on the callback.
  assert.ok(cb.headers.getSetCookie().some((c) => c.startsWith("velo_oauth_state=;") && c.includes("Max-Age=0")));

  const status = await (await get("/api/strava/status", sid)).json();
  assert.deepEqual(status, { connected: true });
});

test("activities require a session and are fetched with a Bearer header, not a URL token", async () => {
  assert.equal((await get("/api/strava/activities")).status, 401);
  assert.equal((await get("/api/strava/activities?access_token=x")).status, 401);

  const { sid } = await connect();
  strava.calls.length = 0;
  const resp = await get("/api/strava/activities?per_page=200&page=2", sid);
  assert.equal(resp.status, 200);
  assert.deepEqual(await resp.json(), { activities: [{ id: 1 }] });
  const call = strava.calls.find((c) => c.url.includes("/athlete/activities"));
  assert.match(call.url, /per_page=200&page=2$/);
  assert.match(call.options.headers.Authorization, /^Bearer tok-/);
});

test("query parameters are validated (F28)", async () => {
  const { sid } = await connect();
  for (const q of ["per_page=-1", "per_page=1.5", "per_page=500", "page=0", "page=abc"]) {
    assert.equal((await get(`/api/strava/activities?${q}`, sid)).status, 400, q);
  }
});

test("upstream 429 and 401 are passed on; 401 drops the session (F25)", async () => {
  const { sid } = await connect();
  strava.activitiesStatus = 429;
  assert.equal((await get("/api/strava/activities", sid)).status, 429);
  strava.activitiesStatus = 401;
  assert.equal((await get("/api/strava/activities", sid)).status, 401);
  strava.activitiesStatus = 200;
  assert.deepEqual(await (await get("/api/strava/status", sid)).json(), { connected: false });
});

test("expired tokens are refreshed before use (F25)", async () => {
  strava.tokenExpiresAt = () => Math.floor(Date.now() / 1000) - 10;
  const { sid } = await connect();
  strava.tokenExpiresAt = () => Math.floor(Date.now() / 1000) + 3600;
  strava.calls.length = 0;
  assert.equal((await get("/api/strava/activities", sid)).status, 200);
  const refresh = strava.calls.find((c) => c.url.endsWith("/oauth/token"));
  assert.equal(JSON.parse(refresh.options.body).grant_type, "refresh_token");
});

test("disconnect revokes at Strava and forgets the session", async () => {
  const { sid } = await connect();
  strava.calls.length = 0;
  const resp = await fetch(base + "/auth/strava/disconnect", { method: "POST", headers: { cookie: sid } });
  assert.equal(resp.status, 200);
  assert.ok(strava.calls.some((c) => c.url.endsWith("/oauth/deauthorize")));
  assert.deepEqual(await (await get("/api/strava/status", sid)).json(), { connected: false });
});

test("health endpoint and config validation (F23)", async () => {
  assert.deepEqual(await (await get("/health")).json(), { ok: true });
  assert.deepEqual(validateConfig(config), []);
  const problems = validateConfig({ STRAVA_CLIENT_ID: "x", FRONTEND_URL: "notaurl" });
  assert.ok(problems.includes("STRAVA_CLIENT_SECRET is missing"));
  assert.ok(problems.includes("FRONTEND_URL is not a valid URL"));
  assert.ok(!problems.join(" ").includes("x ")); // no values echoed
});

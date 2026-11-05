// Browser smoke test over the Chrome DevTools Protocol (Node 22+, no extra packages).
// Not part of `npm test`. It CLEARS localStorage and IndexedDB for the app origin, so only
// ever point it at a throwaway browser profile, never one holding real Velo data.
//
//   npm run build && npx vite preview --port 4173 --strictPort
//   chrome --headless=new --remote-debugging-port=9333 --user-data-dir=<empty temp dir> --window-size=420,900 about:blank
//   node tests/browser-smoke.js
const APP = process.env.SMOKE_APP_URL || "http://localhost:4173";
const DEVTOOLS = process.env.SMOKE_DEVTOOLS_URL || "http://127.0.0.1:9333";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeout = 20000) {
  const end = Date.now() + timeout;
  for (;;) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) {
      if (Date.now() > end) throw e;
    }
    if (Date.now() > end) throw new Error("timeout");
    await sleep(250);
  }
}

const targets = await waitFor(async () => (await fetch(`${DEVTOOLS}/json/list`)).json());
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let seq = 0;
const pending = new Map();
const problems = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === "Runtime.exceptionThrown") {
    problems.push("EXCEPTION " + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
  } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    problems.push("console.error " + msg.params.args.map((a) => a.value ?? a.description).join(" "));
  }
};
const send = (method, params = {}) =>
  new Promise((r) => {
    const id = ++seq;
    pending.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || "eval failed");
  return r.result.result.value;
};
const goto = async (path) => {
  await send("Page.navigate", { url: APP + path });
  await sleep(1800);
};
const text = () => evaluate("document.body.innerText");
const key = async (k, modifiers = 0) => {
  const code = k === "Escape" ? 27 : 9;
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: k, windowsVirtualKeyCode: code, modifiers });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k, windowsVirtualKeyCode: code, modifiers });
  await sleep(150);
};
const idbAll = (db, store) =>
  evaluate(`new Promise((res) => {
    const r = indexedDB.open(${JSON.stringify(db)});
    r.onsuccess = () => {
      if (!r.result.objectStoreNames.contains(${JSON.stringify(store)})) return res([]);
      const g = r.result.transaction(${JSON.stringify(store)}).objectStore(${JSON.stringify(store)}).getAll();
      g.onsuccess = () => res(g.result);
    };
    r.onerror = () => res(null);
  })`);
const clickText = (selector, txt) =>
  evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].find(b => b.textContent.trim() === ${JSON.stringify(txt)}).click()`);
// Sets a React-controlled input/textarea value.
const setField = (selector, value) =>
  evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);

const results = [];
const check = (name, ok, detail = "") => {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

await send("Runtime.enable");
await send("Page.enable");

// ---------- 1. Legacy data upgrade with backup ----------
await goto("/");
for (const db of ["velo-backups", "velo-media"]) {
  await evaluate(`new Promise((res) => { const r = indexedDB.deleteDatabase("${db}"); r.onsuccess = r.onerror = r.onblocked = () => res(true); })`);
}
await evaluate(`(() => {
  localStorage.clear();
  localStorage.setItem("activities", JSON.stringify([
    { id: "a1", title: "Old slash", type: "run", intensity: "easy", feel: "easy", date: "3/5/2026", duration: "30:30", miles: "3", photo: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" },
    { id: "f1", title: "Future race", type: "run", intensity: "tempo", date: "2099-05-01", miles: "3.1", duration: "" },
    { id: "b1", title: "Bike ride", type: "bike", intensity: "easy", date: "2026-10-20", miles: "10", duration: "40" },
    { id: null, title: "Split run", type: "run", intensity: "tempo", date: "2026-10-25", mode: "splits", miles: "", duration: "", splits: [{ mph: "6", distance: "1" }] },
    null,
    { id: "bad", title: "Impossible date", type: "run", intensity: "easy", date: "2026-02-31", miles: "3", duration: "30" }
  ]));
  localStorage.setItem("strava_access_token", "fake-old-token");
  localStorage.setItem("jarDrop", "true");
  localStorage.setItem("homeNoteCards", JSON.stringify([{ id: 1, title: "Notes 1", text: "keep me; please" }]));
})()`);
await goto("/");
const ls = await evaluate("({ ...localStorage })");
const stored = JSON.parse(ls.activities);
check("schema upgraded to v2", ls.velo_schema_version === "2");
check("5 activities kept, 1 non-object set aside", stored.length === 5 && JSON.parse(ls.activities_quarantine).length === 1);
check("photo moved out of localStorage", !ls.activities.includes("base64") && stored.find((a) => a.id === "a1")?.photoId === "legacy-a1");
const mediaRows = await idbAll("velo-media", "photos");
check("photo stored in IndexedDB unchanged", mediaRows?.length === 1 && mediaRows[0].id === "legacy-a1" && mediaRows[0].dataUrl.startsWith("data:image/png;base64,iVBOR"));
check("future-dated legacy record flagged, not guessed", stored.find((a) => a.id === "f1")?.needsReview?.includes("status") && !stored.find((a) => a.id === "f1").status);
check("slash date normalized, original kept", stored.some((a) => a.date === "2026-03-05" && a.legacy?.date === "3/5/2026"));
check("split totals computed", stored.some((a) => a.title === "Split run" && a.miles === 1 && a.duration === 10 && a.id));
check("impossible date left as-is and flagged", stored.some((a) => a.id === "bad" && a.date === "2026-02-31" && a.needsReview?.includes("date")));
check("browser-held Strava token and stale flags removed", !ls.strava_access_token && !ls.jarDrop);
const backups = await evaluate(`new Promise((res) => {
  const r = indexedDB.open("velo-backups");
  r.onsuccess = () => { const tx = r.result.transaction("backups"); const g = tx.objectStore("backups").getAll(); g.onsuccess = () => res(g.result.map(b => ({ reason: b.reason, hasActivities: b.entries.activities.includes("3/5/2026") && b.entries.activities.includes("base64"), hasToken: "strava_access_token" in b.entries }))); };
  r.onerror = () => res(null);
})`);
check("pre-upgrade backup saved in IndexedDB with original data, no token", backups?.length === 1 && backups[0].hasActivities && !backups[0].hasToken, JSON.stringify(backups));
const homeText = await text();
check("upgrade notice shown", /couldn't read/.test(homeText) && /Nothing was deleted/.test(homeText));
check("Home renders calendar and weekly mileage", /Training Calendar/.test(homeText) && /Distance/.test(homeText));

// ---------- 2. Activity page with mixed history ----------
await goto("/activity");
let t = await text();
check("Activity page renders all 5", /Showing 5 activities/.test(t));
check("needs-review badge shown", /Needs review/.test(t));
check("unconfirmed future record shows 'Planned or done?'", /Planned or done\?/.test(t));
check("migrated photo displayed from IndexedDB", await waitFor(() => evaluate(`[...document.querySelectorAll('.card-right img')].some(i => i.src.startsWith("data:image/png") && i.naturalWidth === 1)`), 5000).catch(() => false));

// ---------- 3. Add activity: validation keeps input, then save without reload ----------
await evaluate(`document.querySelector(".floating-btn").click()`);
await sleep(400);
check("add dialog opens with focus inside", await evaluate(`(() => { const d = document.querySelector('[role="dialog"]'); return !!d && d.contains(document.activeElement); })()`));
check("background is inert while the dialog is open", await evaluate(`!!document.querySelector('.tabbar').closest('[inert]') && !!document.querySelector('.floating-btn').closest('[inert]') && !document.querySelector('[role="dialog"]').closest('[inert]')`));
let escaped = false;
for (let i = 0; i < 40; i++) {
  await key("Tab");
  if (!(await evaluate(`document.querySelector('[role="dialog"]').contains(document.activeElement)`))) escaped = true;
}
await key("Tab", 8);
check("Tab and Shift+Tab stay inside the dialog", !escaped && (await evaluate(`document.querySelector('[role="dialog"]').contains(document.activeElement)`)));
// Real image resize: a 3000x2000 PNG becomes a JPEG no larger than 1280 px.
await evaluate(`(async () => {
  const c = document.createElement("canvas"); c.width = 3000; c.height = 2000;
  const g = c.getContext("2d"); g.fillStyle = "#3a7"; g.fillRect(0, 0, 3000, 2000);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  const dt = new DataTransfer(); dt.items.add(new File([blob], "big.png", { type: "image/png" }));
  const input = document.querySelector('input[aria-label="Add photo"]');
  input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true }));
})()`);
const resized = await waitFor(() => evaluate(`(() => { const i = document.querySelector('img[alt="Activity photo preview"]'); return i && i.complete && i.naturalWidth ? { w: i.naturalWidth, h: i.naturalHeight, jpeg: i.src.startsWith("data:image/jpeg") } : null; })()`), 10000).catch(() => null);
check("photo resized in the browser to 1280 px JPEG", resized?.w === 1280 && resized?.h === 853 && resized?.jpeg, JSON.stringify(resized));
await setField('input[name="title"]', "Smoke test run");
await setField('input[name="miles"]', "");
await evaluate(`document.querySelector('.primary-btn').click()`);
await sleep(300);
t = await text();
check("blank distance/duration rejected with message", /Enter a distance or a duration/.test(t));
check("typed title kept after failed save", (await evaluate(`document.querySelector('input[name="title"]').value`)) === "Smoke test run");
await setField('input[name="miles"]', "2");
await setField('input[name="duration"]', "2000");
const navBefore = await evaluate("performance.getEntriesByType('navigation')[0].startTime + ':' + performance.timeOrigin");
await evaluate(`document.querySelector('.primary-btn').click()`);
await sleep(500);
check("dialog closed after save", !(await evaluate(`!!document.querySelector('.modal')`)));
check("jar celebration shown for new easy run", await evaluate(`!!document.querySelector('.jar-drop-modal')`));
const after = JSON.parse(await evaluate(`localStorage.getItem("activities")`));
check("saved to storage with numeric totals", after.some((a) => a.title === "Smoke test run" && a.miles === 2 && a.duration === 20 && a.id && a.status === "completed"));
const savedPhotoId = after.find((a) => a.title === "Smoke test run")?.photoId;
check("new photo saved to IndexedDB, not localStorage", !!savedPhotoId && !JSON.stringify(after).includes("base64") && (await idbAll("velo-media", "photos")).some((r) => r.id === savedPhotoId && r.dataUrl.startsWith("data:image/jpeg")));
await key("Escape");
check("Escape dismisses jar celebration", !(await evaluate(`!!document.querySelector('.jar-drop-modal')`)));
const navAfter = await evaluate("performance.getEntriesByType('navigation')[0].startTime + ':' + performance.timeOrigin");
check("no page reload on save", navBefore === navAfter);
t = await text();
check("list updated in place", /Showing 6 activities/.test(t));

// ---------- 4. Edit does not celebrate; Escape closes filter dialog ----------
await evaluate(`[...document.querySelectorAll('.card-toggle')].find(b => b.textContent.includes("Smoke test run")).click()`);
await sleep(200);
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === "Edit").click()`);
await sleep(300);
await setField('input[name="title"]', "Smoke test run edited");
await evaluate(`document.querySelector('.primary-btn').click()`);
await sleep(500);
check("edit saved without celebration", !(await evaluate(`!!document.querySelector('.jar-drop-modal')`)) && /edited/.test(await text()));
await evaluate(`(() => { const b = document.querySelector('.filter-btn'); b.focus(); b.click(); })()`);
await sleep(300);
check("filter dialog open", await evaluate(`!!document.querySelector('.activity-filter-modal[role="dialog"]')`));
await key("Escape");
check("Escape closes filter dialog", !(await evaluate(`!!document.querySelector('.activity-filter-modal')`)));
check("focus returns to the opener", (await evaluate(`document.activeElement?.className || ""`)).includes("filter-btn"), await evaluate(`document.activeElement?.outerHTML.slice(0, 80) || ""`));

// ---------- 4b. Delete -> undo -> trash ----------
await evaluate(`(() => { const b = [...document.querySelectorAll('.card-toggle')].find(b => b.textContent.includes("Smoke test run edited")); if (b.getAttribute("aria-expanded") !== "true") b.click(); })()`);
await sleep(200);
await clickText("button", "Edit");
await sleep(300);
await clickText("button", "Delete Activity");
await sleep(400);
t = await text();
check("delete moves to trash and offers Undo", /Showing 5 activities/.test(t) && /moved to Recently deleted/.test(t) && JSON.parse(await evaluate(`localStorage.getItem("activities_trash")`)).length === 1);
await clickText(".undo-bar button", "Undo");
await sleep(300);
check("Undo restores the activity", /Showing 6 activities/.test(await text()) && !(await evaluate(`localStorage.getItem("activities_trash")`)));

// ---------- 4c. Export format beside Export; units ----------
check("export format choice sits next to Export", await evaluate(`!!document.querySelector('.export-group select[aria-label="Export format"]')`));
await evaluate(`localStorage.setItem("velo_units", "km")`);
await goto("/activity");
t = await text();
check("kilometers preference changes display only", /3\.22 km/.test(t) && JSON.parse(await evaluate(`localStorage.getItem("activities")`)).some((a) => a.title === "Smoke test run edited" && a.miles === 2), t.match(/[\d.]+ km/)?.[0]);
await evaluate(`localStorage.setItem("velo_units", "mi")`);
await goto("/activity");

// ---------- 5. Strava modal without server ----------
await evaluate(`document.querySelector('.strava-btn').click()`);
await sleep(1500);
t = await text();
check("Strava modal reports server unreachable; import disabled", /Can't reach the Velo server/.test(t) && (await evaluate(`document.querySelector('.strava-import-btn').disabled`)));
await key("Escape");

// ---------- 6. Profile ----------
await goto("/profile");
t = await text();
check("Profile renders jar, PRs, heatmap navigation", /Easy Run Jar/.test(t) && /PRs/.test(t) && /Whole-activity/.test(t) && /Earlier/.test(t));
check("no hardcoded country flag", !(await evaluate(`!!document.querySelector('.profile-flag')`)));
check("page title is Velo with Velo icon", (await evaluate("document.title")) === "Velo" && (await evaluate(`document.querySelector('link[rel=icon]').getAttribute('href')`)) === "/velo.svg");
await goto("/");
check("weekly chart has a data-table alternative", await evaluate(`(() => { const d = document.querySelector('details.chart-data'); return !!d && /Show weekly data as a table/.test(d.textContent) && d.querySelectorAll('tbody tr').length > 0 && !!d.querySelector('caption'); })()`));

// ---------- 6b. Pending note edits survive leaving Home (F46) ----------
// Each check leaves within the 400 ms save debounce, so only the leave-flush can persist the text.
const storedNote = async () => JSON.parse(await evaluate(`localStorage.getItem("homeNoteCards")`))?.[0]?.text;
const typeNote = async (txt) => {
  await evaluate(`(() => { const el = document.querySelector(".notes-input"); el.focus(); el.setSelectionRange(el.value.length, el.value.length); })()`);
  await send("Input.insertText", { text: txt });
  return evaluate(`document.querySelector(".notes-input").value`);
};
await evaluate(`localStorage.setItem("homeNoteCards", JSON.stringify([{ id: 1, title: "Notes 1", text: "start", isOpen: true }]))`);
await goto("/");
const shownTab = await typeNote(" then tab away");
const beforeTab = await evaluate(`(() => {
  const saved = JSON.parse(localStorage.getItem("homeNoteCards"))[0].text;
  document.querySelector('.tabbar a[href="/profile"]').click();
  return saved;
})()`);
await sleep(600);
check("note typed then tab switch: final text saved on unmount", shownTab === "start then tab away" && beforeTab === "start" && (await storedNote()) === shownTab, JSON.stringify({ shownTab, beforeTab, after: await storedNote() }));
await goto("/");
const shownNav = await typeNote(" + reload");
const beforeNav = await storedNote();
await send("Page.navigate", { url: APP + "/activity" });
await sleep(1800);
check("note typed then page navigation: final text saved on pagehide", shownNav === "start then tab away + reload" && beforeNav === "start then tab away" && (await storedNote()) === shownNav, JSON.stringify({ shownNav, beforeNav, after: await storedNote() }));

// ---------- 6c. Phone width: nothing widens the page; "+" and tab bar stay on screen ----------
// On a phone, content wider than the screen widens the layout viewport and pushes fixed elements off it.
await send("Emulation.setDeviceMetricsOverride", { width: 320, height: 568, deviceScaleFactor: 2, mobile: true });
for (const path of ["/", "/activity", "/profile"]) {
  await goto(path);
  const fit = await evaluate(`(() => {
    const vw = document.documentElement.clientWidth;
    const usable = (sel) => { const e = document.querySelector(sel), b = e.getBoundingClientRect();
      return b.left >= 0 && b.right <= vw && b.bottom <= innerHeight && e.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)); };
    return { scrollW: document.documentElement.scrollWidth, vw, fab: usable(".floating-btn"), tab: usable(".tabbar") };
  })()`);
  check(`320px ${path}: page fits, "+" and tab bar on screen`, fit.scrollW === fit.vw && fit.fab && fit.tab, JSON.stringify(fit));
}
await send("Emulation.clearDeviceMetricsOverride");

// ---------- 6b. Duration field ----------
await evaluate(`localStorage.setItem("activities", JSON.stringify([
  { id: "d1", title: "Old decimal", type: "run", intensity: "easy", feel: "easy", status: "completed", date: "2026-10-20", miles: 10, duration: 90.75 },
  { id: "d2", title: "Very long", type: "bike", intensity: "easy", feel: "easy", status: "completed", date: "2026-10-19", miles: 100, duration: 612.5 }
]))`);
await goto("/activity");
t = await text();
check("older decimal minutes shown as H:MM:SS", /1:30:45/.test(t) && !/90\.75/.test(t));
check("duration past 9:59:59 shown in full", /10:12:30/.test(t));
await send("Emulation.setFocusEmulationEnabled", { enabled: true }); // headless pages otherwise get no focus/blur events
const durValue = () => evaluate(`document.querySelector('input[name="duration"]').value`);
const openEdit = async (title) => {
  const card = `[...document.querySelectorAll('.card-toggle')].find((b) => b.textContent.includes(${JSON.stringify(title)}))`;
  await evaluate(`${card}.getAttribute('aria-expanded') === 'true' || ${card}.click()`);
  await sleep(200);
  await evaluate(`${card}.closest('.activity-card').querySelector('.tertiary-btn').click()`);
  await sleep(300);
};
const focusDur = async () => { await evaluate(`document.querySelector('input[name="duration"]').focus()`); await sleep(100); };
const blurDur = async () => { await evaluate(`document.querySelector('input[name="duration"]').blur()`); await sleep(100); };
await openEdit("Old decimal");
check("edit form shows older record formatted", (await durValue()) === "1:30:45");
await focusDur();
check("colons stay while editing", (await durValue()) === "1:30:45");
await blurDur();
check("leaving without typing shows the format again", (await durValue()) === "1:30:45");
await evaluate(`document.querySelector('.close-btn').click()`);
await sleep(300);
check("looking at the field doesn't mark the form dirty", !(await evaluate(`!!document.querySelector('.modal')`)));

await openEdit("Old decimal");
await evaluate(`document.querySelector('input[name="miles"]').focus()`);
await key("Tab");
await sleep(100);
await send("Input.insertText", { text: "2530" });
check("tabbing in selects the value, so typing replaces it", (await durValue()) === "25:30");
await evaluate(`document.querySelector('input[name="duration"]').select()`);
await send("Input.insertText", { text: "0" });
await send("Input.insertText", { text: "1" });
await send("Input.insertText", { text: "4" });
check("colon shows while typing, no message mid-entry", (await durValue()) === "01:4" && !(await evaluate(`!!document.querySelector('#err-duration')`)));
check("cursor stays where it was typed", (await evaluate(`document.querySelector('input[name="duration"]').selectionStart`)) === 4);
await send("Input.insertText", { text: "a" });
check("letters can't be typed", (await durValue()) === "01:4");
await send("Input.insertText", { text: "." });
check("a decimal point can't be typed", (await durValue()) === "01:4");
const backspace = async () => {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 });
  await sleep(60);
};
await backspace();
check("Backspace removes the last digit", (await durValue()) === "01:");
await backspace();
check("Backspace isn't stuck on the colon", (await durValue()) === "0:");
await send("Input.insertText", { text: "1" });
await send("Input.insertText", { text: "4" });
await blurDur();
check("incomplete input explained on leaving", /4 digits \(MMSS\)/.test(await text()) && (await durValue()) === "01:4");
await focusDur();
await evaluate(`document.querySelector('input[name="duration"]').setSelectionRange(4, 4)`);
await send("Input.insertText", { text: "5" });
await blurDur();
check("leading zero kept, formats on leaving, message clears", (await durValue()) === "01:45" && !(await evaluate(`!!document.querySelector('#err-duration')`)));
await focusDur();
await setField('input[name="duration"]', "2575");
await blurDur();
check("invalid seconds explained", /Seconds must be 00–59/.test(await text()));
await focusDur();
await setField('input[name="duration"]', "1.75");
check("pasted decimal minutes refused", (await durValue()) === "25:75");
await setField('input[name="duration"]', "0145");
await evaluate(`document.querySelector('.primary-btn').click()`);
await sleep(500);
check("typed duration stored as decimal minutes", JSON.parse(await evaluate(`localStorage.getItem("activities")`)).find((a) => a.id === "d1").duration === 1.75);
await evaluate(`document.querySelector('.jar-drop-modal') && document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))`);
await key("Escape");
await sleep(200);

await openEdit("Very long");
await evaluate(`document.querySelector('.primary-btn').click()`);
await sleep(500);
check("over-range duration saved unchanged", JSON.parse(await evaluate(`localStorage.getItem("activities")`)).find((a) => a.id === "d2").duration === 612.5);

// ---------- 7. Bike-only history (F01) ----------
await evaluate(`localStorage.setItem("activities", JSON.stringify([{ id: "x", type: "bike", intensity: "easy", date: "2026-10-20", miles: 10, duration: 40 }]))`);
await goto("/activity");
t = await text();
check("bike-only history renders with first-run coach note", /Log your first run/.test(t) && /Showing 1 activity/.test(t));

// ---------- 7a. Delete All lives in Backup & recovery, keeps its confirm, and leaves Undo reachable ----------
await evaluate(`document.querySelector('.backup-btn').click()`);
await sleep(500);
await evaluate(`window.confirm = () => false`);
await clickText(".backup-modal button", "Delete All");
await sleep(300);
check("declining the Delete All confirm changes nothing", JSON.parse(await evaluate(`localStorage.getItem("activities")`)).length === 1);
await evaluate(`window.confirm = () => true`);
await clickText(".backup-modal button", "Delete All");
await sleep(800);
check("Delete All closes the dialog and moves activities to trash", !(await evaluate(`!!document.querySelector('.backup-modal')`)) && /Showing 0 activities/.test(await text()) && JSON.parse(await evaluate(`localStorage.getItem("activities_trash")`)).length === 1);
await clickText(".undo-bar button", "Undo");
await sleep(300);
check("Undo after Delete All restores activities", /Showing 1 activity/.test(await text()));

// ---------- 7b. Reset Velo (typed confirmation, backup first) ----------
await evaluate(`localStorage.setItem("profileName", "Smoke")`);
await goto("/activity");
await evaluate(`document.querySelector('.backup-btn').click()`);
await sleep(500);
check("reset button disabled until RESET is typed", await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === "Reset Velo").disabled`));
await setField("#reset-confirm", "RESET");
await sleep(100);
const backupsBefore = (await idbAll("velo-backups", "backups")).length;
await clickText("button", "Reset Velo");
await sleep(2500);
const afterReset = await evaluate("({ ...localStorage })");
check("reset removed Velo data and photos", !afterReset.activities?.includes("Bike ride") && !afterReset.profileName && (await idbAll("velo-media", "photos")).length === 0, JSON.stringify(Object.keys(afterReset)));
check("a backup was saved before reset and kept", (await idbAll("velo-backups", "backups")).length === backupsBefore + 1);

// ---------- 8. Corrupt storage ----------
await evaluate(`localStorage.setItem("activities", "{broken")`);
await goto("/activity");
t = await text();
check("corrupt data banner shown", /couldn't be read/.test(t));
await evaluate(`document.querySelector(".floating-btn").click()`);
await sleep(300);
await setField('input[name="miles"]', "3");
await evaluate(`document.querySelector('.primary-btn').click()`);
await sleep(300);
check("save refused and dialog stays open", /changes are disabled/.test(await text()) && (await evaluate(`!!document.querySelector('.modal')`)));
check("corrupt data left untouched", (await evaluate(`localStorage.getItem("activities")`)) === "{broken");

console.log(results.join("\n"));
console.log(problems.length ? "\nPAGE ERRORS:\n" + problems.join("\n") : "\nNo uncaught page exceptions or console errors.");
ws.close();
if (problems.length || results.some((r) => r.startsWith("FAIL"))) process.exitCode = 1;

// Run in a US timezone so UTC-vs-local mistakes show up (see F14).
process.env.TZ = "America/New_York";

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLocalYMD, normalizeYMD, formatDateMDY, calendarDaysBetween, formatDisplayDate } from "../src/utils/dateUtils.js";
import { formatTime } from "../src/utils/profileHelpers.js";
import { localDateTimeParts } from "../src/utils/stravaHelpers.js";

test("date-only strings are local calendar dates, not UTC instants", () => {
  const d = parseLocalYMD("2026-11-01");
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 10);
  assert.equal(d.getDate(), 1);
  assert.equal(formatDisplayDate("2026-11-01"), "Nov 1, 2026");
});

test("impossible dates are rejected instead of rolling over", () => {
  assert.equal(parseLocalYMD("2026-02-31"), null);
  assert.equal(parseLocalYMD("2026-02-29"), null);
  assert.ok(parseLocalYMD("2024-02-29"));
  assert.equal(parseLocalYMD("2026-13-01"), null);
  assert.equal(parseLocalYMD("2/31/2026"), null);
  assert.equal(parseLocalYMD("2026-03-05garbage"), null);
  assert.equal(parseLocalYMD("0201-01-01"), null); // typo year: would make history views enormous
  assert.equal(parseLocalYMD("2101-01-01"), null);
  assert.equal(parseLocalYMD(""), null);
});

test("slash dates normalize and export without corruption (F07)", () => {
  assert.equal(normalizeYMD("3/5/2026"), "2026-03-05");
  assert.equal(formatDateMDY("3/5/2026"), "3/5/2026");
  assert.equal(formatDateMDY("2026-03-05"), "3/5/2026");
  // Repeated round trips are stable.
  assert.equal(normalizeYMD(formatDateMDY(normalizeYMD(formatDateMDY("2026-03-05")))), "2026-03-05");
  // Unreadable legacy values are exported as-is, not mangled.
  assert.equal(formatDateMDY("someday"), "someday");
});

test("calendar day differences are DST-safe", () => {
  assert.equal(calendarDaysBetween(parseLocalYMD("2026-03-07"), parseLocalYMD("2026-03-09")), 2);
  assert.equal(calendarDaysBetween(parseLocalYMD("2026-10-31"), parseLocalYMD("2026-11-02")), 2);
});

test("time formatting carries 60 seconds into the next minute (F17)", () => {
  assert.equal(formatTime(5.999), "6:00");
  assert.equal(formatTime(7.5), "7:30");
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(Infinity), "-");
  assert.equal(formatTime(-1), "-");
});

test("Strava local start time is read as wall-clock, not converted (F14)", () => {
  assert.deepEqual(localDateTimeParts("2026-03-05T23:30:00Z"), { date: "2026-03-05", time: "23:30" });
  assert.deepEqual(localDateTimeParts(""), { date: "", time: "" });
});

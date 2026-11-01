process.env.TZ = "America/New_York";

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateCoachAlerts } from "../src/utils/coachAlert.js";
import { run } from "./helpers.js";

const keys = (alerts) => alerts.map((a) => a.key);
// Coaching is analyzed as of `today` (local date).
const on = (y, m, d) => ({ today: new Date(y, m - 1, d) });

test("non-running histories do not crash (F01)", () => {
  for (const type of ["bike", "swim", "workout"]) {
    const alerts = generateCoachAlerts([run({ type })], 4);
    assert.deepEqual(keys(alerts), ["empty-first-run"]);
  }
  assert.deepEqual(keys(generateCoachAlerts([], 1)), ["empty-first-run"]);
  assert.deepEqual(keys(generateCoachAlerts([null, { date: "nope", type: "run" }], 1)), ["empty-first-run"]);
});

test("alert limit is respected on every path, including NaN (F34)", () => {
  assert.equal(generateCoachAlerts([], 0).length, 0);
  assert.equal(generateCoachAlerts([run()], 0).length, 0);
  assert.equal(generateCoachAlerts([run()], "abc").length, 1);
});

test("'intervals' counts as a hard effort (F32)", () => {
  const alerts = generateCoachAlerts([run({ intensity: "intervals", date: "2026-10-02" })], 6, on(2026, 10, 3));
  assert.ok(keys(alerts).includes("b2-next-move"));
});

test("back-to-back hard alert requires adjacent calendar days (F33)", () => {
  const adjacent = generateCoachAlerts([
    run({ intensity: "tempo", date: "2026-10-02" }),
    run({ intensity: "intervals", date: "2026-10-01" }),
  ], 6, on(2026, 10, 3));
  assert.ok(keys(adjacent).includes("r2-b2b-hard"));

  const weeksApart = generateCoachAlerts([
    run({ intensity: "tempo", date: "2026-10-20" }),
    run({ intensity: "intervals", date: "2026-10-01" }),
  ], 6, on(2026, 10, 21));
  assert.ok(!keys(weeksApart).includes("r2-b2b-hard"));
});

test("hard-effort count uses the date window, not only the last 12 records", () => {
  const list = [
    ...Array.from({ length: 12 }, (_, i) => run({ date: "2026-10-10", time: `0${i % 10}:00`, intensity: "easy" })),
    run({ date: "2026-10-09", intensity: "tempo" }),
    run({ date: "2026-10-08", intensity: "tempo" }),
    run({ date: "2026-10-07", intensity: "tempo" }),
  ];
  assert.ok(keys(generateCoachAlerts(list, 6, on(2026, 10, 10))).includes("y1-too-much-intensity"));
});

test("pace rules work from miles/duration alone (no stored mph) (F31)", () => {
  // 10 easy runs at 6 mph form the baseline; the latest easy run at 7 mph felt hard.
  const list = Array.from({ length: 10 }, (_, i) =>
    run({ date: `2026-09-${String(10 + i).padStart(2, "0")}`, miles: 3, duration: 30, feel: "easy" })
  );
  list.unshift(run({ date: "2026-09-25", miles: 3.5, duration: 30, feel: "medium" }));
  assert.ok(keys(generateCoachAlerts(list, 6, on(2026, 9, 26))).includes("r3-easy-pace-creep"));
});

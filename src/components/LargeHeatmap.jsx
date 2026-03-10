import React, { useMemo } from "react";

/*
  GitHub-style activity heatmap
  - 7 rows = days of week
  - columns = weeks
  - each square = one day
  - month labels shown across top
*/

function parseLocalYMD(input) {
  if (!input) return null;
  if (input instanceof Date) return input;

  const clean = String(input).split("T")[0];

  // YYYY-MM-DD
  if (clean.includes("-")) {
    const [y, m, d] = clean.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  // M/D/YYYY
  if (clean.includes("/")) {
    const [m, d, y] = clean.split("/").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  return null;
}

const pad2 = (n) => String(n).padStart(2, "0");
const toYMD = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeekSunday(date) {
  const d = startOfDay(date);
  const day = d.getDay(); // 0 = Sun
  return addDays(d, -day);
}

function sameMonth(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth()
  );
}

function getActivityScore(activity) {
  const type = String(
    activity?.type || activity?.sport || activity?.activityType || "run"
  ).toLowerCase();

  const miles = Number(activity?.miles ?? 0);
  const minutes = Number(
    activity?.minutes ??
      activity?.duration ??
      activity?.durationMin ??
      activity?.durationMinutes ??
      0
  );
  const feel = String(activity?.feel || "").toLowerCase();

  // You can tweak these however you want later.
  // For now:
  // - runs/bikes/swims mainly reward distance
  // - workouts reward effort + some time

  if (type === "run") {
    if (Number.isFinite(miles) && miles > 0) return miles;
    if (Number.isFinite(minutes) && minutes > 0) return minutes / 10;
    return 0;
  }

  if (type === "bike") {
    if (Number.isFinite(miles) && miles > 0) return miles / 3;
    if (Number.isFinite(minutes) && minutes > 0) return minutes / 15;
    return 0;
  }

  if (type === "swim") {
    if (Number.isFinite(miles) && miles > 0) return miles * 4;
    if (Number.isFinite(minutes) && minutes > 0) return minutes / 12;
    return 0;
  }

  if (type === "workout") {
    let effortBonus = 1;
    if (feel === "easy") effortBonus = 1;
    else if (feel === "medium") effortBonus = 1.5;
    else if (feel === "hard") effortBonus = 2;

    if (Number.isFinite(minutes) && minutes > 0) {
      return (minutes / 20) * effortBonus;
    }
    return effortBonus;
  }

  // fallback
  if (Number.isFinite(miles) && miles > 0) return miles;
  if (Number.isFinite(minutes) && minutes > 0) return minutes / 10;
  return 0;
}

function getLevel(score, maxScore) {
  if (!score || score <= 0) return 0;
  if (!maxScore || maxScore <= 0) return 1;

  const ratio = score / maxScore;

  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export default function ActivityHeatmap({
  activities = [],
  weeksToShow = 53,
  showMonthLabels = true,
  title = "Activity Heatmap",
}) {
  const {
    weeks,
    monthLabels,
    totalActiveDays,
    maxScore,
  } = useMemo(() => {
    const totalsByDay = {};
    let earliestDate = null;

  for (const activity of activities) {
    const d = parseLocalYMD(activity?.date);
    if (!d || Number.isNaN(d.getTime())) continue;

    if (!earliestDate || d < earliestDate) {
      earliestDate = d;
    }

    const key = toYMD(d);
    const score = getActivityScore(activity);

    if (!score || score <= 0) continue;

    totalsByDay[key] = (totalsByDay[key] || 0) + score;
  }

    const today = startOfDay(new Date());
    const endDate = addDays(startOfWeekSunday(today), 6);

    let startDate;

    if (earliestDate) {
      startDate = startOfWeekSunday(earliestDate);
    } else {
      startDate = startOfWeekSunday(today);
    }

    const allDays = [];
    let cursor = new Date(startDate);

    while (cursor <= endDate) {
      const key = toYMD(cursor);

      allDays.push({
        date: new Date(cursor),
        key,
        score: totalsByDay[key] || 0,
      });

      cursor = addDays(cursor, 1);
    }

    const visibleMaxScore = Math.max(
      0,
      ...allDays.map((d) => d.score)
    );

    const weekColumns = [];
    for (let i = 0; i < allDays.length; i += 7) {
      weekColumns.push(allDays.slice(i, i + 7));
    }

    const labels = [];
    for (let i = 0; i < weekColumns.length; i++) {
      const week = weekColumns[i];
      const firstDay = week[0];
      if (!firstDay) continue;

      if (
        i === 0 ||
        !sameMonth(firstDay.date, weekColumns[i - 1]?.[0]?.date)
      ) {
        labels.push({
          index: i,
          text: firstDay.date.toLocaleString("en-US", { month: "short" }),
        });
      }
    }

    const activeDays = allDays.filter((d) => d.score > 0).length;

    return {
      weeks: weekColumns,
      monthLabels: labels,
      totalActiveDays: activeDays,
      maxScore: visibleMaxScore,
    };
  }, [activities, weeksToShow]);

  return (
    <div className="activity-heatmap-card">
      <div className="activity-heatmap-header">
        <h2 className="activity-heatmap-title">{title}</h2>
        <div className="activity-heatmap-sub">
          {totalActiveDays} active days logged
        </div>
      </div>

      <div className="activity-heatmap-shell">
        <div className="activity-heatmap-content">
          {showMonthLabels && (
            <div
              className="activity-heatmap-months"
              style={{ gridTemplateColumns: `repeat(${weeks.length}, 14px)` }}
            >
              {Array.from({ length: weeks.length }).map((_, i) => {
                const label = monthLabels.find((m) => m.index === i);
                return (
                  <div key={i} className="activity-heatmap-month-cell">
                    {label ? label.text : ""}
                  </div>
                );
              })}
            </div>
          )}

          <div className="activity-heatmap-main">
            <div className="activity-heatmap-days">
              <div></div>
              <div>Mon</div>
              <div></div>
              <div>Wed</div>
              <div></div>
              <div>Fri</div>
              <div></div>
            </div>

            <div
              className="activity-heatmap-grid"
              style={{ gridTemplateColumns: `repeat(${weeks.length}, 14px)` }}
            >
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="activity-heatmap-week">
                  {Array.from({ length: 7 }).map((_, dayIndex) => {
                    const day = week[dayIndex];
                    if (!day) {
                      return (
                        <div
                          key={dayIndex}
                          className="activity-heatmap-cell activity-heatmap-cell-empty"
                        />
                      );
                    }

                    const level = getLevel(day.score, maxScore);

                    return (
                      <div
                        key={day.key}
                        className={`activity-heatmap-cell level-${level}`}
                        title={`${day.key} • score: ${day.score.toFixed(2)}`}
                        aria-label={`${day.key} score ${day.score.toFixed(2)}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="activity-heatmap-footer">
          <div className="activity-heatmap-note">
            Full training history
          </div>

          <div className="activity-heatmap-legend">
            <span>Less</span>
            <div className="activity-heatmap-cell level-0" />
            <div className="activity-heatmap-cell level-1" />
            <div className="activity-heatmap-cell level-2" />
            <div className="activity-heatmap-cell level-3" />
            <div className="activity-heatmap-cell level-4" />
            <span>More</span>
          </div>
        </div>
      </div>


    </div>
  );
}
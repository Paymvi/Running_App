import React, { useMemo, useState } from "react";
import { parseLocalYMD, toYMD } from "../utils/dateUtils";

/*
  GitHub-style activity heatmap
  - 7 rows = days of week
  - columns = weeks
  - each square = one day
  - month labels shown across top
*/

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

  // Hiking has no agreed equivalence to the other sports, so it does not score.
  if (type === "hike") return 0;

  // Strength sessions keep the workout scoring they had when they were logged as workouts.
  if (type === "workout" || type === "strength") {
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
  // 0 = the window ending this week (or the latest logged week); each step goes weeksToShow further back.
  const [page, setPage] = useState(0);

  const { totalsByDay, earliestDate, latestDate, totalActiveDays } = useMemo(() => {
    const totals = {};
    let earliest = null;
    let latest = null;

    for (const activity of activities) {
      const d = parseLocalYMD(activity?.date);
      if (!d) continue;

      const score = getActivityScore(activity);
      if (!score || score <= 0) continue;

      if (!earliest || d < earliest) earliest = d;
      if (!latest || d > latest) latest = d;

      const key = toYMD(d);
      totals[key] = (totals[key] || 0) + score;
    }

    return {
      totalsByDay: totals,
      earliestDate: earliest,
      latestDate: latest,
      totalActiveDays: Object.keys(totals).length,
    };
  }, [activities]);

  const {
    weeks,
    monthLabels,
    maxScore,
    rangeLabel,
    hasEarlier,
  } = useMemo(() => {
    // Only a bounded window is rendered; older history is reached with "Earlier".
    const today = startOfDay(new Date());
    const anchor = latestDate && latestDate > today ? latestDate : today;
    const endDate = addDays(startOfWeekSunday(anchor), 6 - page * weeksToShow * 7);
    const startDate = addDays(startOfWeekSunday(endDate), -(weeksToShow - 1) * 7);

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

    let visibleMaxScore = 0;
    for (const d of allDays) visibleMaxScore = Math.max(visibleMaxScore, d.score);

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

    const fmt = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    return {
      weeks: weekColumns,
      monthLabels: labels,
      maxScore: visibleMaxScore,
      rangeLabel: `${fmt(startDate)} – ${fmt(endDate)}`,
      hasEarlier: Boolean(earliestDate && earliestDate < startDate),
    };
  }, [totalsByDay, earliestDate, latestDate, page, weeksToShow]);

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
            <button
              type="button"
              className="tertiary-btn"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasEarlier}
              aria-label="Show earlier year"
            >
              ‹ Earlier
            </button>{" "}
            <span aria-live="polite">{rangeLabel}</span>{" "}
            <button
              type="button"
              className="tertiary-btn"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Show later year"
            >
              Later ›
            </button>
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
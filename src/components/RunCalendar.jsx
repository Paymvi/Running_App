import React, { useMemo } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

const pad2 = (n) => String(n).padStart(2, "0");
const toYMD = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const clamp01 = (x) => Math.max(0, Math.min(1, x));

export default function RunCalendar({ activities }) {
  const milesByDay = useMemo(() => {
    const map = {};
    for (const a of activities || []) {
      // IMPORTANT: this assumes a.date is ISO-like: "YYYY-MM-DD..." or "YYYY-MM-DD"
      const d = new Date(a.date);
      const day = toYMD(d);

      if (!day) continue;

      const miles = Number(a.miles || 0);
      if (!Number.isFinite(miles)) continue;

      map[day] = (map[day] || 0) + miles;
    }
    return map;
  }, [activities]);

  const maxMiles = useMemo(() => {
    const vals = Object.values(milesByDay);
    const max = vals.length ? Math.max(...vals) : 0;
    return Math.max(5, max);
  }, [milesByDay]);

  const tileContent = ({ date, view }) => {
    if (view !== "month") return null;

    const key = toYMD(date);
    const miles = milesByDay[key] || 0;
    if (miles <= 0) return null;

    const t = clamp01(miles / maxMiles);
    const alpha = 0.15 + t * 0.85;

    return (
      <>
        {/* heat background */}
        <div
          className="tile-heat"
          style={{ backgroundColor: `rgba(252, 76, 2, ${alpha})` }}
        />

        {/* miles label */}
        <div className="tile-miles" style={{ fontSize: 10, marginTop: 2, opacity: 0.9, fontWeight: 700 }}>
          {miles.toFixed(miles >= 10 ? 0 : 1)} mi
        </div>
      </>
    );
  };

  return (
    <div className="run-calendar-card">
      <div className="run-calendar-header">
        <h2 className="run-calendar-title">Training Calendar</h2>
        <div className="run-calendar-sub">
          Brighter = longer run (scaled to your max day)
        </div>
      </div>

      <Calendar tileContent={tileContent} value={null} />

      <div className="run-calendar-legend">
        <span className="legend-item">
          <span className="legend-dot low" /> short
        </span>
        <span className="legend-item">
          <span className="legend-dot mid" /> medium
        </span>
        <span className="legend-item">
          <span className="legend-dot high" /> long
        </span>
      </div>
    </div>
  );
}
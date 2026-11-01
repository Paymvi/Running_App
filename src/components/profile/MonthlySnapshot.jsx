import React from "react";
import { getEasyZone, formatTime } from "../../utils/profileHelpers";
import { distLabel, formatDistance, toDisplay } from "../../utils/units";

// Completed runs per calendar month (see stats.js monthlySnapshot):
// - Easy % = easy run distance ÷ run distance with a known effort (unknown effort is excluded and shown).
// - Avg easy pace = total easy-run time ÷ total easy-run distance (runs missing either are left out).
// - The current month is compared with the same days of the previous month.
export default function MonthlySnapshot({
  monthlySnapshot,
  showTrends,
  setShowTrends,
  unit = "mi",
}) {
  const dl = distLabel(unit);
  return (
    <div className="profile-section">

        <h2 className="section-title">
            <button
                type="button"
                className="section-title-btn clickable"
                aria-pressed={showTrends}
                title="Show or hide changes vs. the previous month"
                onClick={() => setShowTrends((prev) => !prev)}
            >
                Monthly snapshot
            </button>
        </h2>

        <div className="month-snap-row">
        {monthlySnapshot.map((m) => {
            const zone = m.share.pct === null ? null : getEasyZone(m.share.pct);
            const delta = m.mileageDelta === null ? null : toDisplay(m.mileageDelta, unit);

            return (
                <div key={m.key} className="month-card">
                <div className="month-title">{m.label}{m.partial ? " (so far)" : ""}</div>

                {/* HERO METRIC */}
                <div className="month-hero">
                {formatDistance(m.miles, unit)}

                {showTrends && delta !== null && (
                <div
                    className={`trend ${
                    delta > 0.05 ? "trend-up" : delta < -0.05 ? "trend-down" : "trend-neutral"
                    }`}
                >
                    {delta > 0.05 && "▲ "}
                    {delta < -0.05 && "▼ "}
                    {Math.abs(delta) > 0.05 ? `${Math.abs(delta).toFixed(1)} ${dl} ${m.comparedWith}` : `No change ${m.comparedWith}`}
                </div>
                )}
                </div>

                {/* Easy % with color meaning */}
                {zone ? (
                <div className={`easy-pill ${zone.className}`} title="Easy run distance ÷ run distance with a known effort">
                    <span className="easy-percent">{m.share.pct}% easy (by {dl})</span>
                    <span className="easy-label">{zone.label}</span>
                </div>
                ) : (
                <div className="easy-pill" title="No runs with a known effort this month">
                    <span className="easy-percent">Easy %: no effort data</span>
                </div>
                )}

                <div className="month-secondary">
                    <div className="metric-row">
                    <span>Avg easy pace</span>
                    <span>{m.avgEasyPace === null ? "-" : `${formatTime(m.avgEasyPace / toDisplay(1, unit))} /${dl}`}</span>
                    </div>

                    <div className="metric-row">
                    <span>Longest run</span>
                    <span>{formatDistance(m.longest, unit)}</span>
                    </div>

                    {m.share.unknownMiles > 0 && (
                    <div className="metric-row">
                    <span>Effort unknown</span>
                    <span>{formatDistance(m.share.unknownMiles, unit)}</span>
                    </div>
                    )}
                </div>
                </div>
            );
            })}
        </div>
    </div>

);

}

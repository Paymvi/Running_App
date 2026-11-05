import React from "react";
import { formatDate, daysAgo } from "../../utils/profileHelpers";
import { formatDuration } from "../../utils/activityModel";
import { PR_EVENTS } from "../../utils/prDetection";
import { speedLabel, toDisplay } from "../../utils/units";

// Whole-activity records: the fastest completed run that is at least the event
// distance and no more than 3% longer, timed by its full recorded duration.
export default function PRPanel({
  prs,
  selectedPR,
  setSelectedPR,
  unit = "mi",
}) {
  // Average speed over the whole activity (its own distance, not the event distance).
  const speed = (pr) => {
    if (!pr.time || !Number.isFinite(pr.time)) return null;
    return `${(toDisplay(pr.miles, unit) / (pr.time / 60)).toFixed(1)} ${speedLabel(unit)}`;
  };

  return (
    <div className="profile-panel pr-panel">
    <div className="panel-title">🎖️ PRs</div>
    <div className="pr-note">Whole-activity times</div>
    {selectedPR && selectedPR.date && (
      <div className="pr-selected-date" aria-live="polite">
        {selectedPR.label} PR: {formatDate(selectedPR.date)}
        {selectedPR.speed && <> • {selectedPR.speed}</>}
      </div>
    )}

    <div className="pr-table">
      {PR_EVENTS.map((event) => {
        const pr = prs[event.key];
        return (
          <div className="pr-row" key={event.key}>
            <div className="pr-cell label">{event.label}</div>
            <button
              type="button"
              className="pr-cell value clickable"
              aria-pressed={selectedPR?.label === event.label}
              aria-label={`${event.label} whole-activity PR: ${Number.isFinite(pr.time) ? formatDuration(pr.time) : "none yet"}`}
              onClick={() =>
                setSelectedPR(
                  selectedPR?.label === event.label
                    ? null
                    : { label: event.label, date: pr.date, speed: speed(pr) }
                )
              }
            >
              {formatDuration(pr.time)}
            </button>
          </div>
        );
      })}
    </div>

    {prs.latestPRDate && (
        <div className="pr-latest">
            Last PR: {daysAgo(prs.latestPRDate)} days ago
        </div>
        )}

    </div>

  );

}

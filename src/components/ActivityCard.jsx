import React, { useState } from "react";
import { FiEdit2 } from "react-icons/fi";
import { formatDisplayDate } from "../utils/dateUtils";
import { getDefaultImage } from "../utils/activityHelpers";
import { activityAverages, activityMiles, activityMinutes, formatDuration, isPlanned, isUnconfirmed, splitRows } from "../utils/activityModel";
import { distLabel, formatDistance, toDisplay, useUnit } from "../utils/units";
import usePhoto, { photoErrorText } from "../hooks/usePhoto";

// Recorded splits only. Totals give an average, so they are never spread into fake per-mile rows.
function SplitsSection({ a, unit }) {
  const rows = a.mode === "splits" ? splitRows(a.splits).filter(Boolean) : [];
  if (!rows.length) {
    if (a.type === "strength" || isPlanned(a)) return null;
    return (
      <div className="expanded-section splits-section">
        <strong>Splits</strong>
        <p className="splits-note">
          No splits recorded. Use Edit to add each split's speed and distance.
        </p>
      </div>
    );
  }

  return (
    <div className="expanded-section splits-section">
      <strong>Splits</strong>
      <p className="splits-note">Time is that split alone. Elapsed is the running total.</p>
      <table className="splits-table">
        <thead>
          <tr>
            <th scope="col">Split</th>
            <th scope="col">Pace</th>
            <th scope="col">Time</th>
            <th scope="col">Elapsed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const avg = activityAverages({ miles: row.distance, duration: row.minutes }, unit);
            return (
              <tr key={i}>
                <th scope="row">
                  {i + 1}
                  <small>{formatDistance(row.distance, unit, 2)}</small>
                </th>
                <td>
                  {avg.pace}
                  <small>{avg.speed}</small>
                </td>
                <td className="split-time">{formatDuration(row.minutes)}</td>
                <td>{formatDuration(row.elapsed)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ActivityCard({
  a,
  expanded,
  onToggle,
  prIds,
  onEdit
}) {
  const unit = useUnit();
  const photo = usePhoto(a?.photoId);
  const [photoBroken, setPhotoBroken] = useState(false);

  if (!a) return null;

  const miles = activityMiles(a);
  const duration = activityMinutes(a);
  const averages = activityAverages(a, unit); // null without both distance and time: "no pace", not zero
  const shownDistance = toDisplay(miles, unit);

  const isPR = prIds.has(a.id);
  const photoSrc = photo.src || a.photo || null;

  return (
      <div
          onClick={onToggle}
          className={`
              activity-card
              ${expanded ? "expanded" : ""}
              ${isPR ? "pr-gold" : ""}
              ${isPlanned(a) || isUnconfirmed(a) ? "activity-planned" : ""}
          `}
      >
      <div className="card-left">

          {isPR && (
              <div className="pr-badge" title="Fastest whole-activity time at this event distance">🏆 PR · whole activity</div>
          )}

          <div className="meta-row">


              <span className="meta-date">
                  {formatDisplayDate(a.date) || String(a.date || "")}
              </span>
              {isPlanned(a) && <span className="planned-badge">Planned</span>}
              {isUnconfirmed(a) && (
                  <span className="needs-review-badge" title="Dated in the future when plans were introduced. Edit it to mark it planned or completed.">
                      Planned or done?
                  </span>
              )}
              {a.needsReview?.some((f) => f !== "status") && (
                  <span className="needs-review-badge" title={`Couldn't read: ${a.needsReview.filter((f) => f !== "status").join(", ")}`}>
                      Needs review
                  </span>
              )}
          </div>

          <h3 className="card-title" style={{ fontWeight: "bold" }}>
              <button
                  type="button"
                  className="card-toggle"
                  aria-expanded={expanded}
                  onClick={(e) => {
                      e.stopPropagation();
                      onToggle();
                  }}
              >
                  {a.title || "Untitled Activity"}
              </button>
          </h3>

          {a.description && (
              <p
                  className="description-preview"
                  style={{ whiteSpace: "pre-line" }}
              >
                  {a.description}
              </p>
          )}



          <div className="stats-row">
          <div className="stat">
              <span className="stat-label">Distance</span>
              <span className="stat-value">
              {miles > 0 ? `${Number(shownDistance.toFixed(2))} ${distLabel(unit)}` : `- ${distLabel(unit)}`}
              </span>
          </div>

          <div className="stat">
              <span className="stat-label">Time</span>
              <span className="stat-value">
              {duration > 0 ? formatDuration(duration) : "-"}
              </span>
          </div>

          <div className="stat">
              <span className="stat-label">Avg Pace</span>
              <span className="stat-value" title={averages ? undefined : "Needs both distance and time"}>
              {averages?.pace || "-"}
              </span>
          </div>

          {averages && (
              <div className="stat">
                  <span className="stat-label">Avg Speed</span>
                  <span className="stat-value stat-accent">{averages.speed}</span>
              </div>
          )}
          </div>
      </div>

      <div className="card-right">
          {photoSrc && !photoBroken ? (
          <img src={photoSrc} alt={`Photo for ${a.title || "activity"}`} onError={() => setPhotoBroken(true)} />
          ) : photo.error || photoBroken ? (
          <div className="image-placeholder photo-error" role="note">
              {photoBroken ? "This photo couldn't be displayed (the image data is damaged)." : photoErrorText(photo.error)}
          </div>
          ) : (
          <div className="image-placeholder">

              <img
                  src={getDefaultImage(a.type, a.intensity)}
                  alt=""
              />

          </div>
          )}
      </div>

      {expanded && (
      <div className="card-details">
          {a.notes && (
          <div className="expanded-section private-notes">
              <strong>Notes</strong>
              <p style={{ whiteSpace: "pre-line" }}>{a.notes}</p>
          </div>
          )}

          <SplitsSection a={a} unit={unit} />

          <div className="edit-row" style={{ marginTop: 6 }}>
              <button
                type="button"
                className="tertiary-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(a);
                }}
              >
                  <FiEdit2 /> Edit
              </button>
          </div>
      </div>
      )}
      </div>
  );
}

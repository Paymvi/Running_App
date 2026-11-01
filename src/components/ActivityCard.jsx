import React, { useState } from "react";
import { FiEdit2 } from "react-icons/fi";
import { formatDisplayDate } from "../utils/dateUtils";
import { getDefaultImage } from "../utils/activityHelpers";
import { activityMiles, activityMinutes, activityPaceParts, isPlanned, isUnconfirmed } from "../utils/activityModel";
import { formatTime } from "../utils/profileHelpers";
import { distLabel, speedLabel, toDisplay, useUnit } from "../utils/units";
import usePhoto, { photoErrorText } from "../hooks/usePhoto";

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
  const pace = activityPaceParts(a);
  const shownDistance = toDisplay(miles, unit);

  // Pace needs both distance and time; a missing time means "no pace", not zero.
  let avgPace = null;
  let speed = null;
  if (pace) {
      avgPace = `${formatTime(pace.minutes / toDisplay(pace.miles, unit))} /${distLabel(unit)}`;
      speed = (toDisplay(pace.miles, unit) / (pace.minutes / 60)).toFixed(1);
  }

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
              {duration > 0 ? `${Number(duration.toFixed(2))} min` : "- min"}
              </span>
          </div>

          <div className="stat">
              <span className="stat-label">Avg Pace</span>
              <span className="stat-value" title={pace ? undefined : "Needs both distance and time"}>
              {avgPace || "-"}
              </span>
          </div>
          </div>

          {speed && <div className="mph-badge">{speed} {speedLabel(unit)}</div>}

          {expanded && (
          <div style={{ marginTop: 16 }}>


          {a.notes && (
          <div className="expanded-section private-notes">
              <strong>Notes</strong>
              <p style={{ whiteSpace: "pre-line" }}>{a.notes}</p>
          </div>
          )}

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
      </div>
  );
}

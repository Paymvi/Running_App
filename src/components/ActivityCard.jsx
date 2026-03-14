import React from "react";
import { FiEdit2 } from "react-icons/fi";
import { parseLocalYMD } from "../utils/dateUtils";
import { getDefaultImage } from "../utils/activityHelpers";

export default function ActivityCard({
  a,
  index,
  expandedIndex,
  setExpandedIndex,
  prIds,
  onEdit
}) {

  if (!a) return null;

  const miles = parseFloat(a.miles || 0);
  const duration = parseFloat(a.duration || 0);

  let avgPace = null;
  let mph = null;

  if (miles > 0 && duration > 0) {
      const pace = duration / miles; // minutes per mile
      const paceMin = Math.floor(pace);
      const paceSec = Math.round((pace - paceMin) * 60);
      avgPace = `${paceMin}:${paceSec.toString().padStart(2, "0")}`;
      mph = (miles / (duration / 60)).toFixed(1);
  }

  return (
      <div
          onClick={() =>
              setExpandedIndex(expandedIndex === index ? null : index)
          }
          className={`
              activity-card
              ${expandedIndex === index ? "expanded" : ""}
              ${prIds.has(a.id) ? "pr-gold" : ""}
          `}
      >
      <div className="card-left">

          {prIds.has(a.id) && (
              <div className="pr-badge">🏆 PR</div>
          )}

          <div className="meta-row">

              
              <span className="meta-date">
                  {a.date
                  ? (() => {
                      const d = parseLocalYMD(a.date);
                      if (!d || isNaN(d)) return "";
                      return d.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                      });
                      })() : ""}
              </span>
          </div>

          <h3 className="card-title" style={{ fontWeight: "bold" }}>
              {a.title || "Untitled Activity"}
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
              {a.miles || "-"} mi
              </span>
          </div>

          <div className="stat">
              <span className="stat-label">Time</span>
              <span className="stat-value">
              {a.duration || "-"} min
              </span>
          </div>

          <div className="stat">
              <span className="stat-label">Avg Pace</span>
              <span className="stat-value">
              {avgPace || "-"}
              </span>
          </div>
          </div>

          {mph && <div className="mph-badge">{mph} mph</div>}

          {expandedIndex === index && (
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
          {a.photo ? (
          <img src={a.photo} alt="activity" />
          ) : (
          <div className="image-placeholder">
              
              <img
                  src={getDefaultImage(a.type, a.intensity)}
                  alt="activity"
              />
              
          </div>
          )}
      </div>
      </div>
  );
}
import React, { useEffect } from "react";

export default function CalendarSettingsModal({
  open,
  onClose,
  triathleteMode,
  setTriathleteMode,
  hybridMode,
  setHybridMode,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Calendar Settings</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="toggle-row">
          <div>
            <div className="toggle-label">Triathlete mode</div>
            <div className="toggle-sub">Show bike (yellow) + swim (blue) on calendar</div>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={triathleteMode}
              onChange={(e) => setTriathleteMode(e.target.checked)}
            />
            <span className="slider" />
          </label>
        </div>

        <div className="toggle-row">
          <div>
            <div className="toggle-label">Hybrid Athlete</div>
            <div className="toggle-sub">Show workouts (pink) on calendar</div>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={hybridMode}
              onChange={(e) => setHybridMode(e.target.checked)}
            />
            <span className="slider" />
          </label>
        </div>


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

        <div className="modal-foot">
          <button className="secondary-btn" onClick={onClose}>Done</button>
        </div>


      </div>
    </div>
  );
}
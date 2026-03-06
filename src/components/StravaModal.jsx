import React from "react";

export default function StravaModal({
  isOpen,
  onClose,
  stravaToken,
  onConnect,
  onImport,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="strava-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="strava-modal-header">
          <div className="strava-modal-title-row">
            <img
              src="/strava-logo.png"
              alt="Strava"
              className="strava-modal-logo"
            />
            <h2 className="strava-modal-title">Strava</h2>
          </div>

          <button
            className="strava-modal-close"
            onClick={onClose}
            aria-label="Close Strava modal"
          >
            ×
          </button>
        </div>

        <div className="strava-modal-body">
          <p className="strava-modal-text">
            You can import your activities from Strava!
          </p>

          <div className="strava-modal-actions">
            <button
              onClick={onConnect}
              className="strava-action-btn strava-connect-btn"
            >
              {stravaToken ? "Strava Connected ✅" : "Connect Strava"}
            </button>

            <button
              onClick={onImport}
              className={`strava-action-btn strava-import-btn ${!stravaToken ? "is-disabled" : ""}`}
              disabled={!stravaToken}
            >
              Import from Strava
            </button>
          </div>

          <div className="strava-modal-fyi">
            <div><strong>For the other import/export buttons:</strong></div>
            <div>- Import accepts .csv, .xlsx, and .xls files.</div>
            <div>- Export downloads a .csv file.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
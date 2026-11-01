import React from "react";
import useDialog from "../hooks/useDialog";

export default function StravaModal({
  isOpen,
  onClose,
  connected,
  status,
  busy,
  onConnect,
  onImport,
  onDisconnect,
}) {
  const dialogRef = useDialog(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="strava-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="strava-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="strava-modal-header">
          <div className="strava-modal-title-row">
            <img
              src="/strava-logo.png"
              alt=""
              className="strava-modal-logo"
            />
            <h2 className="strava-modal-title" id="strava-modal-title">Strava</h2>
          </div>

          <button
            type="button"
            className="strava-modal-close"
            onClick={onClose}
            aria-label="Close Strava modal"
          >
            ×
          </button>
        </div>

        <div className="strava-modal-body">
          <p className="strava-modal-text">
            Import your Strava history (runs, rides, swims, hikes, workouts and strength). Imports run only when
            you press Import; nothing syncs in the background. Velo asks Strava only for permission to read your
            activities.
          </p>

          {status && (
            <p className="strava-modal-text" role="status">
              {status}
            </p>
          )}

          <div className="strava-modal-actions">
            <button
              type="button"
              onClick={onConnect}
              className="strava-action-btn strava-connect-btn"
            >
              {connected ? "Strava Connected ✅" : "Connect Strava"}
            </button>

            <button
              type="button"
              onClick={onImport}
              className={`strava-action-btn strava-import-btn ${!connected || busy ? "is-disabled" : ""}`}
              disabled={!connected || busy}
            >
              {busy ? "Importing…" : "Import from Strava"}
            </button>

            {connected && (
              <button
                type="button"
                onClick={onDisconnect}
                className="strava-action-btn"
              >
                Disconnect
              </button>
            )}
          </div>

          <div className="strava-modal-fyi">
            <div><strong>For the other import/export buttons:</strong></div>
            <div>- Import accepts .csv, .xlsx, and .xls files.</div>
            <div>- Export downloads Excel (.xlsx) or CSV; pick the format next to the Export button.</div>
            <div>- Activities already in Velo are skipped on re-import, so your edits to them are kept.</div>
            <div>- Strava doesn’t say whether a run was easy, so imports have “unknown” effort: no jar balls and no easy/hard coaching until you set it.</div>
            <div>- Disconnecting keeps imported activities.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

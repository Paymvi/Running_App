import React from "react";
import useDialog from "../hooks/useDialog";

export default function ActivitySettingsModal({ open, onClose, simpleForm, setSimpleForm }) {
  const dialogRef = useDialog(open, onClose);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div className="modal-title" id="activity-settings-title">Activity Settings</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="toggle-row">
          <div>
            <div className="toggle-label">Simple activity form</div>
            <div className="toggle-sub">Hide limiter, feel, tags and completed/planned when adding or editing</div>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              aria-label="Simple activity form"
              checked={simpleForm}
              onChange={(e) => setSimpleForm(e.target.checked)}
            />
            <span className="slider" />
          </label>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import useDialog from "../../hooks/useDialog";

const OPTIONS = [
  { id: "jar", name: "Easy Run Jar", counts: "One ball for each completed run you mark Easy. Imported runs count once you set their effort to Easy." },
  { id: "constellations", name: "Constellations", counts: "One star for each day with any completed workout, strength included. Several workouts on one day still make one star." },
];

// Choose the Profile motivation module and its settings. Nothing changes until Save.
// `summaries` maps a module id to a short "where you are now" line.
export default function CustomizeMotivationModal({ settings, summaries, onSave, onClose }) {
  const [draft, setDraft] = useState(settings);
  const [error, setError] = useState("");
  const dialogRef = useDialog(true, onClose);
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    const failure = onSave(draft);
    if (failure) setError(`Not saved: ${failure}`);
    else onClose();
  };

  return (
    <div className="jar-modal-backdrop" onClick={onClose}>
      <div
        className="edit-profile-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="customize-motivation-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="jar-modal-head">
          <div className="jar-modal-title" id="customize-motivation-title">Customize motivation</div>
          <button type="button" className="jar-close" aria-label="Close customize" onClick={onClose}>✕</button>
        </div>

        <div className="edit-profile-body">
          <fieldset className="motivation-options">
            <legend className="edit-profile-label">Show on Profile</legend>
            {OPTIONS.map((o) => (
              <label key={o.id} className={`motivation-option${draft.module === o.id ? " selected" : ""}`}>
                <input type="radio" name="motivation-module" value={o.id} checked={draft.module === o.id} onChange={() => set("module", o.id)} />
                <span>
                  <b>{o.name}</b>
                  <span className="field-hint">{o.counts}</span>
                  <span className="motivation-now">{summaries[o.id]}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {draft.module === "constellations" && (
            <>
              <label className="edit-profile-label" htmlFor="motivation-star-colors">Star colours</label>
              <select id="motivation-star-colors" className="edit-profile-input" value={draft.starColors} onChange={(e) => set("starColors", e.target.value)}>
                <option value="type">By activity type</option>
                <option value="white">All white</option>
              </select>
            </>
          )}

          <div className="edit-profile-label">Display</div>
          <label className="settings-toggle">
            <input type="checkbox" checked={draft.animations} onChange={(e) => set("animations", e.target.checked)} />
            Animations
          </label>
          <div className="field-hint">Your device's reduce-motion setting turns them off too.</div>
          <label className="settings-toggle">
            <input type="checkbox" checked={draft.hidden} onChange={(e) => set("hidden", e.target.checked)} />
            Hide this section
          </label>
          <div className="field-hint">Show it again any time from Edit Profile. Your progress is kept either way.</div>
          {error && <div className="field-error" role="alert">{error}</div>}
        </div>

        <div className="edit-profile-actions">
          <button type="button" className="avatar-btn secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="avatar-btn" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}

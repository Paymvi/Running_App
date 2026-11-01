import React, { useState } from "react";
import useDialog from "../../hooks/useDialog";
import { getFeedbackPrefs, setFeedbackPrefs } from "../../utils/feedback";

export default function EditProfileModal({
  showEditProfile,
  setShowEditProfile,
  profileName,
  setProfileName,
  weeklyScaleMode,
  setWeeklyScaleMode,
  unit,
  setUnit,
  saveError,
}) {

  const close = () => setShowEditProfile(false);
  const dialogRef = useDialog(showEditProfile, close);
  const [feedback, setFeedback] = useState(getFeedbackPrefs);

  const [feedbackError, setFeedbackError] = useState("");

  // The checkbox only changes when the preference was saved.
  const toggleFeedback = (key) => {
    const next = { ...feedback, [key]: !feedback[key] };
    if (setFeedbackPrefs(next)) {
      setFeedback(next);
      setFeedbackError("");
    } else {
      setFeedbackError("Couldn't save this preference (browser storage refused it).");
    }
  };

  if (!showEditProfile) return null;

  return (
    <div
        className="jar-modal-backdrop"
        onClick={() => setShowEditProfile(false)}
    >
        <div
        className="edit-profile-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        onClick={(e) => e.stopPropagation()}
        >
        <div className="jar-modal-head">
            <div className="jar-modal-title" id="edit-profile-title">Edit Profile</div>
            <button
            type="button"
            className="jar-close"
            aria-label="Close edit profile"
            onClick={close}
            >
            ✕
            </button>
        </div>

        <div className="edit-profile-body">
          <label className="edit-profile-label" htmlFor="edit-profile-name">Name</label>
          <input
            id="edit-profile-name"
            type="text"
            className="edit-profile-input"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="Enter your name"
            maxLength={30}
          />

          <label className="edit-profile-label" htmlFor="edit-profile-scale">Weekly Mileage Scale</label>
          <select
            id="edit-profile-scale"
            className="edit-profile-input"
            value={weeklyScaleMode}
            onChange={(e) => setWeeklyScaleMode(e.target.value)}
          >
            <option value="dynamic">Dynamic (changes while scrolling)</option>
            <option value="max">Fixed scale (highest week)</option>
          </select>

          <label className="edit-profile-label" htmlFor="edit-profile-unit">Distance unit</label>
          <select
            id="edit-profile-unit"
            className="edit-profile-input"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="mi">Miles</option>
            <option value="km">Kilometers</option>
          </select>
          <div className="field-hint">Only changes how distances are typed and shown; recorded distances never change.</div>

          <div className="edit-profile-label">Feedback</div>
          <label className="settings-toggle">
            <input type="checkbox" checked={feedback.sound} onChange={() => toggleFeedback("sound")} />
            Sounds
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={feedback.vibration} onChange={() => toggleFeedback("vibration")} />
            Vibration
          </label>
          {feedbackError && <div className="field-error" role="alert">{feedbackError}</div>}
          {saveError && <div className="field-error" role="alert">{saveError}</div>}
        </div>

        <div className="edit-profile-actions">
            <button
            type="button"
            className="avatar-btn secondary"
            onClick={close}
            >
            Done
            </button>
        </div>
        </div>
    </div>
  );
}
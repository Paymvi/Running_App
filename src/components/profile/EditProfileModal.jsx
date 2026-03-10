import React from "react";

export default function EditProfileModal({
  showEditProfile,
  setShowEditProfile,
  profileName,
  setProfileName,
  weeklyScaleMode,
  setWeeklyScaleMode,
}) {

  if (!showEditProfile) return null;

  return (
    <div
        className="jar-modal-backdrop"
        onClick={() => setShowEditProfile(false)}
    >
        <div
        className="edit-profile-modal"
        onClick={(e) => e.stopPropagation()}
        >
        <div className="jar-modal-head">
            <div className="jar-modal-title">Edit Profile</div>
            <button
            className="jar-close"
            onClick={() => setShowEditProfile(false)}
            >
            ✕
            </button>
        </div>

        <div className="edit-profile-body">
          <label className="edit-profile-label">Name</label>
          <input
            type="text"
            className="edit-profile-input"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="Enter your name"
            maxLength={30}
          />

          <label className="edit-profile-label">Weekly Mileage Scale</label>
          <select
            className="edit-profile-input"
            value={weeklyScaleMode}
            onChange={(e) => setWeeklyScaleMode(e.target.value)}
          >
            <option value="dynamic">Dynamic (changes while scrolling)</option>
            <option value="max">Fixed scale (highest week)</option>
          </select>
        </div>

        <div className="edit-profile-actions">
            <button
            className="avatar-btn secondary"
            onClick={() => setShowEditProfile(false)}
            >
            Done
            </button>
        </div>
        </div>
    </div>
  );
}
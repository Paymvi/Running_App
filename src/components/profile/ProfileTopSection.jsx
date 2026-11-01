import React from "react";
import { formatDistance } from "../../utils/units";


export default function ProfileTopSection({
  avatar,
  fileInputRef,
  handleAvatarChange,
  removeAvatar,
  jarCount,
  setShowJarHistory,
  displayName,
  setShowEditProfile,
  stats,
  unit = "mi",
  tag,
  setTag,
  TAG_OPTIONS,
}) {
  return (

  <div className="profile-top"> {/* TOP AREA (matches sketch) */}

      {/* LEFT COLUMN */}
      <div className="profile-left">
        <button
          type="button"
          className="profile-avatar-lg clickable"
          onClick={() => fileInputRef.current?.click()}
          aria-label={avatar ? "Change profile photo" : "Add profile photo"}
        >
          {avatar ? (
            <img
              className="profile-avatar-img"
              src={avatar}
              alt="Profile avatar"
            />
          ) : (
            <span className="profile-avatar-emoji">🏃</span>
          )}

        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="avatar-file"
        />

      <div className="avatar-actions">

          <button type="button" className="avatar-btn" onClick={() => setShowJarHistory(true)}>
              Past Jars 🫙
          </button>

          {avatar && (
              <button type="button" className="avatar-btn secondary" onClick={removeAvatar}>
                  Remove photo
              </button>
          )}

          <div className="avatar-metric">
              <div className="avatar-metric-value">{jarCount}</div>
              <div className="avatar-metric-label">Jars Completed</div>
          </div>

      </div>


      </div>

      {/* RIGHT COLUMN */}
      <div className="profile-top-right">

      {/* name */}
      <div className="profile-name-row">

          <div className="profile-identity-block">
              <h2 className="profile-name">{displayName}</h2>
              {/* <div className="profile-country-label">{selectedCountryLabel}</div> */}
          </div>

          <button
              type="button"
              className="profile-edit-btn"
              onClick={() => setShowEditProfile(true)}
          >
              Edit
          </button>

      </div>

      {/* Stat boxes */}
      <div className="profile-stat-row">
          <div className="profile-stat">
          <div className="profile-stat-title">Total run distance</div>
          <div className="profile-stat-value">{formatDistance(stats.totalMiles, unit)}</div>
          </div>

          <div className="profile-stat">
          <div className="profile-stat-title">Run distance this month</div>
          <div className="profile-stat-value">{formatDistance(stats.thisMonthMiles, unit)}</div>
          </div>

      </div>

      {/* second row: funny tag */}
      <div className="profile-pill">
        <div className="pill-title">Today’s Energy</div>
          <select
              className="tag-select"
              aria-label="Today's energy"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
          >
              {TAG_OPTIONS.map((option) => (
              <option key={option} value={option}>
                  {option}
              </option>
              ))}
          </select>
        </div>

      </div> {/* profile-top-right */}
  </div>  

  ); 
      
}
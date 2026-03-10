import React from "react";
import ReactCountryFlag from "react-country-flag";


export default function ProfileTopSection({
  avatar,
  fileInputRef,
  handleAvatarChange,
  jarCount,
  setShowJarHistory,
  displayName,
  setShowEditProfile,
  stats,
  tag,
  setTag,
  TAG_OPTIONS,
}) {
  return (

  <div className="profile-top"> {/* TOP AREA (matches sketch) */}

      {/* LEFT COLUMN */}
      <div className="profile-left">

      <div
      className="profile-avatar-lg clickable"
      onClick={() => fileInputRef.current?.click()}
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

      <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="avatar-file"
      />
      </div>

      <div className="avatar-actions">

          <button className="avatar-btn" onClick={() => setShowJarHistory(true)}>
              Past Jars 🫙
          </button>

          <div className="avatar-metric">
              <div className="avatar-metric-value">{jarCount}</div>
              <div className="avatar-metric-label">Jars Completed</div>
          </div>

      </div>


      </div>

      {/* RIGHT COLUMN */}
      <div className="profile-top-right">

      {/* flag + name */}
      <div className="profile-name-row">
          <span className="profile-flag">
              <ReactCountryFlag
                  countryCode="US"
                  svg
                  style={{
                      width: "28px",
                      height: "20px",
                      borderRadius: "4px"
                  }}
              />
          </span>

          <div className="profile-identity-block">
              <h2 className="profile-name">{displayName}</h2>
              {/* <div className="profile-country-label">{selectedCountryLabel}</div> */}
          </div>

          <button
              className="profile-edit-btn"
              onClick={() => setShowEditProfile(true)}
          >
              Edit
          </button>

      </div>

      {/* 3 stat boxes */}
      <div className="profile-stat-row">
          <div className="profile-stat">
          <div className="profile-stat-title">Total Distance</div>
          <div className="profile-stat-value">{stats.totalMiles.toFixed(1)} mi</div>
          </div>

          <div className="profile-stat">
          <div className="profile-stat-title">This month</div>
          <div className="profile-stat-value">{stats.thisMonthMiles.toFixed(1)} mi</div>
          </div>

      </div>

      {/* second row: funny tag */}
      <div className="profile-pill">
      <div className="pill-title">Today’s Energy</div>

      <select
          className="tag-select"
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
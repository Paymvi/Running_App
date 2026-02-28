import React, { useState, useEffect } from "react";
import FloatingButton from "../components/FloatingButton";
import AddActivityModal from "../components/AddActivityModal";

export default function Activity() {
  const [activities, setActivities] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("activities");
    if (saved) setActivities(JSON.parse(saved));
  }, []);

  const saveActivity = (activity) => {
    const updated = [...activities, activity];
    setActivities(updated);
    localStorage.setItem("activities", JSON.stringify(updated));
  };

  return (
    <div className="page">
      <h1>Activity</h1>

      {activities.map((a, index) => (
        <div key={index} className="activity-card">
            <div className="card-left">
                <h3 className="card-title">{a.title}</h3>

                <div className="stats-row">
                <div className="stat">
                    <span className="stat-label">Distance</span>
                    <span className="stat-value">{a.miles || "4.06"} mi</span>
                </div>

                <div className="stat">
                    <span className="stat-label">Pace</span>
                    <span className="stat-value">10:30</span>
                </div>

                <div className="stat">
                    <span className="stat-label">Time</span>
                    <span className="stat-value">{a.duration || "40"} min</span>
                </div>
                </div>

                <div className="mph-badge">6.0 mph</div>
            </div>

            <div className="card-right">
                {a.photo ? (
                <img src={a.photo} alt="activity" />
                ) : (
                <div className="image-placeholder"></div>
                )}
            </div>
            </div>

      ))}


    </div>
  );
}
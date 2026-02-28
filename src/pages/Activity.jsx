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
        <div key={index} className="card">
          <h3>{a.title}</h3>
          <p>{a.description}</p>
          <small>{a.date}</small>
        </div>
      ))}


    </div>
  );
}
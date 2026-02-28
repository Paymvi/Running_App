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

    const runImages = {
        easy: "Run-Easy.png",
        long: "Run-Long.png",
        tempo: "Run-Tempo.png",
        intervals: "Run-Intervals.png",
        };

    const getDefaultImage = (type, intensity) => {
        if (type === "run") {
            return runImages[intensity] || "Run-Default.png";
        }
        return "Run-Default.png";
    };

  return (
    <div className="page">
      <h1>Activity</h1>



      {activities.map((a, index) => {
        const miles = parseFloat(a.miles);
        const duration = parseFloat(a.duration);

        let avgPace = null;
        let mph = null;

        if (miles && duration) {
            const pace = duration / miles; // minutes per mile
            const paceMin = Math.floor(pace);
            const paceSec = Math.round((pace - paceMin) * 60);
            avgPace = `${paceMin}:${paceSec.toString().padStart(2, "0")}`;
            mph = (miles / (duration / 60)).toFixed(1);
        }

        return (
            <div key={index} className="activity-card">
            <div className="card-left">


                <div className="meta-row">
                    <span className="meta-date">
                        {a.date
                        ? new Date(a.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            })
                        : ""}
                    </span>
                </div>

                <h3 className="card-title" style={{ fontWeight: "bold" }}>
                    {a.title || "Untitled Activity"}
                </h3>
                
                
                {a.notes && (
                    <p className="notes-preview">{a.notes}</p>
                )}
                

                <div className="stats-row">
                <div className="stat">
                    <span className="stat-label">Distance</span>
                    <span className="stat-value">
                    {a.miles || "-"} mi
                    </span>
                </div>

                <div className="stat">
                    <span className="stat-label">Time</span>
                    <span className="stat-value">
                    {a.duration || "-"} min
                    </span>
                </div>

                <div className="stat">
                    <span className="stat-label">Avg Pace</span>
                    <span className="stat-value">
                    {avgPace || "-"}
                    </span>
                </div>
                </div>

                {mph && <div className="mph-badge">{mph} mph</div>}


            </div>

            <div className="card-right">
                {a.photo ? (
                <img src={a.photo} alt="activity" />
                ) : (
                <div className="image-placeholder">
                    
                    <img
                        src={getDefaultImage(a.type, a.intensity)}
                        alt="activity"
                    />
                    
                </div>
                )}
            </div>
            </div>
        );
        })}

        <FloatingButton onClick={() => setOpen(true)} />

        <AddActivityModal
            isOpen={open}
            onClose={() => setOpen(false)}
            onSave={saveActivity}
        />



    </div>
  );
}
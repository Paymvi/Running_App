import React, { useState, useEffect, useMemo } from "react";
import FloatingButton from "../components/FloatingButton";
import AddActivityModal from "../components/AddActivityModal";
import { generateCoachAlert } from "../utils/coachAlert";
import { FiEdit2 } from "react-icons/fi";
import Papa from "papaparse";

export default function Activity() {
  const [activities, setActivities] = useState([]);
  const [open, setOpen] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [editingActivity, setEditingActivity] = useState(null);

    useEffect(() => {
    const saved = localStorage.getItem("activities");
    if (saved) {
        const parsed = JSON.parse(saved);
        parsed.sort((a, b) => new Date(b.date) - new Date(a.date));
        setActivities(parsed);
    }
    }, []);

    const saveActivity = (activity) => {
        // If it has an id, we UPDATE. If not, we CREATE.
        const isEditing = !!activity.id;

        let updated;
        if (isEditing) {
            updated = activities.map((a) => (a.id === activity.id ? activity : a));
        } else {
            const newActivity = { ...activity, id: Date.now() };
            updated = [newActivity, ...activities];
        }

        updated.sort((a, b) => new Date(b.date) - new Date(a.date));

        setActivities(updated);
        localStorage.setItem("activities", JSON.stringify(updated));
    };

    const clearAllActivities = () => {
        const confirmDelete = window.confirm(
            "Are you sure you want to delete all activity history?"
        );

        if (confirmDelete) {
            setActivities([]);
            localStorage.removeItem("activities"); 
            // OR localStorage.setItem("activities", JSON.stringify([]));
        }
    };

    const activityImages = {
        run: {
            easy: "Run-Easy-2.png",
            long: "Run-Long-2.png",
            tempo: "Run-Tempo-2.png",
            intervals: "Run-SprintsHills-2.png",
            default: "Run-Default.png",
        },
        bike: {
            easy: "Bike-Easy.png",
            long: "Bike-Long.png",
            tempo: "Bike-Tempo.png",
            intervals: "Bike-SprintsHills.png",
            default: "Bike-Default.png",
        },
        swim: {
            easy: "Swim-Easy.png",
            long: "Swim-Long.png",
            tempo: "Swim-Tempo.png",
            intervals: "Swim-Sprints.png",
            default: "Swim-Default.png",
        },
    };
    const coachAlert = useMemo(() => {
        return generateCoachAlert(activities);
    }, [activities]);

    const handleCSVImport = (file) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function (results) {
            const importedActivities = results.data.map((row) => {
                return {
                id: Date.now() + Math.random(),
                title: row.title || "",
                description: row.description || "",
                type: row.type || "run",
                intensity: row.intensity || "easy",
                feel: row.feel || "medium",
                date: row.date,
                time: row.time || "",
                mode: "timeMiles",
                duration: row.duration || "",
                miles: row.miles || "",
                splits: [{ mph: "", distance: "" }],
                notes: row.notes || "",
                photo: null,
                };
            });

            const updated = [...importedActivities, ...activities];
            updated.sort((a, b) => new Date(b.date) - new Date(a.date));

            setActivities(updated);
            localStorage.setItem("activities", JSON.stringify(updated));
            },
        });
    };

    const getDefaultImage = (type, intensity) => {
        const typeImages = activityImages[type];

        if (!typeImages) return "Run-Default.png";

        return typeImages[intensity] || typeImages.default;
    };

    
    const handleExportCSV = () => {
        if (!activities.length) {
            alert("No activities to export.");
            return;
        }

        // Define headers
        const headers = [
            "title",
            "description",
            "type",
            "intensity",
            "feel",
            "date",
            "time",
            "miles",
            "duration",
            "notes"
        ];

        // Convert activities to CSV rows
        const rows = activities.map((activity) => [
            activity.title || "",
            activity.description || "",
            activity.type || "",
            activity.intensity || "",
            activity.feel || "",
            activity.date || "",
            activity.time || "",
            activity.miles || "",
            activity.duration || "",
            activity.notes || ""
        ]);

        // Combine header + rows
        const csvContent =
            [headers, ...rows]
            .map((row) =>
                row
                .map((field) =>
                    `"${String(field).replace(/"/g, '""')}"` // escape quotes
                )
                .join(",")
            )
            .join("\n");

        // Create downloadable file
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = "my_running_data.csv";
        link.click();

        URL.revokeObjectURL(url);
    };

  return (
    <div className="page">
        <h1>Activity</h1>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <label className="import-btn">
                Import CSV
                <input
                    type="file"
                    accept=".csv"
                    hidden
                    onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) handleCSVImport(file);
                    }}
                />
            </label>

            <button
                onClick={handleExportCSV}
                style={{
                    backgroundColor: "#1f2937",
                    color: "white",
                    border: "none",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    marginBottom: "10px"
                }}
                >
                Export CSV
            </button>

            <button 
                onClick={clearAllActivities} 
                style={{
                    backgroundColor: "#ff4d4d",
                    color: "white",
                    border: "none",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    marginBottom: "10px"
                }}
                >
                Delete All Activities
            </button>

        </div>
        

        <div className={`coach-alert ${coachAlert.toneClass}`}>
            <div className="coach-alert-title">{coachAlert.title}</div>
            {coachAlert.detail && <div className="coach-alert-detail">{coachAlert.detail}</div>}
        </div>



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
            <div
                key={a.id}
                className={`activity-card ${expandedIndex === index ? "expanded" : ""}`}
                onClick={() =>
                    setExpandedIndex(expandedIndex === index ? null : index)
                }
            >
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

                {a.description && (
                    <p className="description-preview">{a.description}</p>
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

                {expandedIndex === index && (
                <div style={{ marginTop: 16 }}>
                    

                    {a.notes && (
                    <div className="expanded-section private-notes" >
                        <strong>Notes</strong>
                        <p>{a.notes}</p>
                    </div>
                    )}

                    <div className="edit-row" style={{ marginTop: 6 }}>
                        <button
                            type="button"
                            className="tertiary-btn"
                            onClick={(e) => {
                            e.stopPropagation();
                            setEditingActivity(a);
                            setOpen(true);
                            }}
                        >
                            <FiEdit2 /> Edit
                        </button>
                    </div>

                </div>
                )}
                


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

        <FloatingButton
            onClick={() => {
                setEditingActivity(null);
                setOpen(true);
            }}
        />

        <AddActivityModal
        isOpen={open}
        initialActivity={editingActivity}
        onClose={() => {
            setOpen(false);
            setEditingActivity(null);
        }}
        onSave={saveActivity}
        />



    </div>
  );
}
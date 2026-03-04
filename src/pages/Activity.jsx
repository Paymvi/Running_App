import React, { useState, useEffect, useMemo, useRef } from "react";
import FloatingButton from "../components/FloatingButton";
import AddActivityModal from "../components/AddActivityModal";
import { generateCoachAlert } from "../utils/coachAlert";
import { FiEdit2 } from "react-icons/fi";
import Papa from "papaparse";


// Fix for YYYY-MM-DD timezone shift bug
function parseLocalYMD(input) {
  if (!input) return null;

  if (input instanceof Date) return input;

  // Remove time if present
  const clean = String(input).split("T")[0];

  // Case 1: YYYY-MM-DD
  if (clean.includes("-")) {
    const [y, m, d] = clean.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  // Case 2: M/D/YYYY or MM/DD/YYYY
  if (clean.includes("/")) {
    const [m, d, y] = clean.split("/").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  return null;
}

export default function Activity() {
  const [activities, setActivities] = useState([]);
  const [open, setOpen] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [editingActivity, setEditingActivity] = useState(null);

  // Lazy render (infinite scroll style)
  const PAGE_SIZE = 40; // how many cards to add per batch
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
 const loadMoreRef = useRef(null);

    useEffect(() => {
    const saved = localStorage.getItem("activities");
    if (saved) {
        const parsed = JSON.parse(saved);
        parsed.sort((a, b) => parseLocalYMD(b.date) - parseLocalYMD(a.date));
        setActivities(parsed);
    }
    }, []);

    // For lazy load
    useEffect(() => {
        // When the dataset changes (import/delete), restart the visible window
        setVisibleCount(PAGE_SIZE);
        setExpandedIndex(null);
    }, [activities.length]);


    useEffect(() => {
        const el = loadMoreRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
        (entries) => {
            const first = entries[0];
            if (first.isIntersecting) {
            setVisibleCount((v) => Math.min(v + PAGE_SIZE, activities.length));
            }
        },
        {
            root: null,       // viewport
            rootMargin: "600px", // start loading before user hits bottom
            threshold: 0,
        }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [activities.length]);
    

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

        updated.sort((a, b) => parseLocalYMD(b.date) - parseLocalYMD(a.date));

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

    // -------------------------
    // PR Detection (official-distance only)
    // -------------------------

    const prs = useMemo(() => {

    let bestMile = { time: Infinity, id: null };
    let best5k = { time: Infinity, id: null };
    let best10k = { time: Infinity, id: null };

    for (const a of activities) {

        if (a.type !== "run") continue;

        const miles = Number(a.miles);
        const duration = Number(a.duration);

        if (!Number.isFinite(miles) || !Number.isFinite(duration)) continue;
        if (miles <= 0 || duration <= 0) continue;

        // Allow small GPS drift tolerance
        if (Math.abs(miles - 1.0) <= 0.1) {
        if (duration < bestMile.time) {
            bestMile = { time: duration, id: a.id };
        }
        }

        if (Math.abs(miles - 3.1) <= 0.25) {
        if (duration < best5k.time) {
            best5k = { time: duration, id: a.id };
        }
        }

        if (Math.abs(miles - 6.2) <= 0.45) {
        if (duration < best10k.time) {
            best10k = { time: duration, id: a.id };
        }
        }
    }

    return { mile: bestMile, fiveK: best5k, tenK: best10k };

    }, [activities]);

    useEffect(() => {
        console.log("PRS:", prs);
    }, [prs]);

    const prIds = useMemo(() => {
        return new Set([prs.mile.id, prs.fiveK.id, prs.tenK.id].filter(Boolean));
    }, [prs]);

    const handleCSVImport = (file) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function (results) {
            const importedActivities = results.data.map((row) => {
                return {
                id: crypto.randomUUID(),
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
            updated.sort((a, b) => parseLocalYMD(b.date) - parseLocalYMD(a.date));

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

    const deleteActivity = (id) => {
        const confirmDelete = window.confirm(
            "Delete this activity? This cannot be undone."
        );

        if (!confirmDelete) return;

        const updated = activities.filter((a) => a.id !== id);

        setActivities(updated);
        localStorage.setItem("activities", JSON.stringify(updated));

        setOpen(false);
        setEditingActivity(null);
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



        {activities.slice(0, visibleCount).map((a, index) => {
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
                    onClick={() =>
                        setExpandedIndex(expandedIndex === index ? null : index)
                    }
                    className={`
                        activity-card
                        ${expandedIndex === index ? "expanded" : ""}
                        ${prIds.has(a.id) ? "pr-gold" : ""}
                    `}
                >
                <div className="card-left">

                    {prIds.has(a.id) && (
                        <div className="pr-badge">🏆 PR</div>
                    )}

                    <div className="meta-row">

                        
                        <span className="meta-date">
                            {a.date
                            ? (() => {
                                const d = parseLocalYMD(a.date);
                                if (!d || isNaN(d)) return "";
                                return d.toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                });
                                })() : ""}
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

            {/* Sentinel: when this becomes visible, load more */}
            <div
              ref={loadMoreRef}
              style={{ height: 1 }}
            />

            {/* Optional: small hint */}
            {visibleCount < activities.length && (
              <div style={{ opacity: 0.7, fontSize: 12, marginTop: 10 }}>
                Loading more…
              </div>
            )}

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
                onDelete={deleteActivity}
            />



        </div>
  );
}
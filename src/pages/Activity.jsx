import React, { useState, useEffect, useMemo, useRef } from "react";
import FloatingButton from "../components/FloatingButton";
import AddActivityModal from "../components/AddActivityModal";
import { FiEdit2, FiFilter } from "react-icons/fi";
import Papa from "papaparse";
import * as XLSX from "xlsx";

import { generateCoachAlerts } from "../utils/coachAlert";

import CoachHelpModal from "../components/CoachHelpModal";
import StravaModal from "../components/StravaModal";
import ActivityFilterModal from "../components/ActivityFilterModal";


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
  const [coachAlertCount, setCoachAlertCount] = useState(1); // user-controlled
  const [coachHelpOpen, setCoachHelpOpen] = useState(false);
  const [stravaModalOpen, setStravaModalOpen] = useState(false);
  const [stravaToken, setStravaToken] = useState(
    localStorage.getItem("strava_access_token") || ""
  );
  const [stravaStatus, setStravaStatus] = useState("");
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  const [filters, setFilters] = useState({
    searchName: "",
    searchDate: "",
    types: [],
    intensities: [],
    prOnly: false,
    sortBy: "newest",
  });

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


    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const connected = params.get("strava");
        const token = params.get("access_token");

        if (connected === "connected" && token) {
            localStorage.setItem("strava_access_token", token);
            setStravaToken(token);
            setStravaStatus("Connected ✅");

            // clean the URL (removes token from address bar)
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (connected === "error") {
            setStravaStatus("Connection failed ❌");
            window.history.replaceState({}, document.title, window.location.pathname);
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
        workout: {
            easy: "Workout-2.png",
            long: "Workout-2.png",
            tempo: "Workout-2.png",
            intervals: "Workout-2.png",
            default: "Workout-2.png",
        },
    };
    const coachAlerts = useMemo(() => {
        return generateCoachAlerts(activities, coachAlertCount);
    }, [activities, coachAlertCount]);

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

    const resetFilters = () => {
      setFilters({
        searchName: "",
        searchDate: "",
        types: [],
        intensities: [],
        prOnly: false,
        sortBy: "newest",
      });
    };

    const filteredActivities = useMemo(() => {
      let result = [...activities];

      // Search by title/name
      if (filters.searchName.trim()) {
        const query = filters.searchName.toLowerCase().trim();
        result = result.filter((a) =>
          String(a.title || "").toLowerCase().includes(query)
        );
      }

      // Search by exact date
      if (filters.searchDate) {
        result = result.filter((a) => a.date === filters.searchDate);
      }

      // Filter by activity type
      if (filters.types.length > 0) {
        result = result.filter((a) => filters.types.includes(a.type));
      }

      // Filter by intensity
      if (filters.intensities.length > 0) {
        result = result.filter((a) => filters.intensities.includes(a.intensity));
      }

      // PR only
      if (filters.prOnly) {
        result = result.filter((a) => prIds.has(a.id));
      }

      // Sorting
      if (filters.sortBy === "fastestPace") {
        result.sort((a, b) => {
          const aMiles = Number(a.miles);
          const aDuration = Number(a.duration);
          const bMiles = Number(b.miles);
          const bDuration = Number(b.duration);

          const aValid = aMiles > 0 && aDuration > 0;
          const bValid = bMiles > 0 && bDuration > 0;

          if (!aValid && !bValid) return 0;
          if (!aValid) return 1;
          if (!bValid) return -1;

          const aPace = aDuration / aMiles;
          const bPace = bDuration / bMiles;

          return aPace - bPace; // lower pace = faster
        });
      } else if (filters.sortBy === "longestDistance") {
        result.sort((a, b) => Number(b.miles || 0) - Number(a.miles || 0));
      } else if (filters.sortBy === "longestTime") {
        result.sort((a, b) => Number(b.duration || 0) - Number(a.duration || 0));
      } else {
        result.sort((a, b) => parseLocalYMD(b.date) - parseLocalYMD(a.date));
      }

      return result;
    }, [activities, filters, prIds]);

    // For lazy load
    useEffect(() => {
        // When filters or dataset change, restart the visible window
        setVisibleCount(PAGE_SIZE);
        setExpandedIndex(null);
    }, [filteredActivities.length]);

    const rowsToActivities = (rows) => {
      const normalizeExcelDate = (value) => {
          if (!value) return "";

          // If already looks like YYYY-MM-DD, keep it
          if (typeof value === "string" && value.includes("-")) {
              return value.split("T")[0];
          }

          // If looks like M/D/YYYY, keep it
          if (typeof value === "string" && value.includes("/")) {
              return value;
          }

          // If Excel stored it as a serial number
          if (typeof value === "number") {
              const jsDate = XLSX.SSF.parse_date_code(value);
              if (!jsDate) return "";
              const yyyy = jsDate.y;
              const mm = String(jsDate.m).padStart(2, "0");
              const dd = String(jsDate.d).padStart(2, "0");
              return `${yyyy}-${mm}-${dd}`;
          }

          return String(value);
      };

      return rows.map((row) => {
          return {
              id: crypto.randomUUID(),
              title: row.title || "",
              description: (row.description || "").replace(/\\n|;/g, "\n"),
              type: row.type || "run",
              intensity: row.intensity || "easy",
              feel: row.feel || "medium",
              date: normalizeExcelDate(row.date),
              time: row.time || "",
              mode: "timeMiles",
              duration: row.duration || "",
              miles: row.miles || "",
              splits: [{ mph: "", distance: "" }],
              notes: (row.notes || "").replace(/\\n|;/g, "\n"),
              photo: null,
          };
      });
    };


    const handleCSVImport = (file) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function (results) {
                const importedActivities = rowsToActivities(results.data);

                const updated = [...importedActivities, ...activities];
                updated.sort((a, b) => parseLocalYMD(b.date) - parseLocalYMD(a.date));

                setActivities(updated);
                localStorage.setItem("activities", JSON.stringify(updated));
            },
        });
    };


    useEffect(() => {
        const el = loadMoreRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
          (entries) => {
            const first = entries[0];
            if (first.isIntersecting) {
              setVisibleCount((v) =>
                Math.min(v + PAGE_SIZE, filteredActivities.length)
              );
            }
          },
          {
            root: null,
            rootMargin: "600px",
            threshold: 0,
          }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [filteredActivities.length]);

    
    const handleExcelImport = async (file) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: "array" });

            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            const rows = XLSX.utils.sheet_to_json(worksheet, {
                defval: "", // fills empty cells with ""
            });

            const importedActivities = rowsToActivities(rows);

            const updated = [...importedActivities, ...activities];
            updated.sort((a, b) => parseLocalYMD(b.date) - parseLocalYMD(a.date));

            setActivities(updated);
            localStorage.setItem("activities", JSON.stringify(updated));

            alert(`Imported ${importedActivities.length} activities from Excel ✅`);
        } catch (error) {
            console.error(error);
            alert("Failed to import Excel file.");
        }
    };

    const handleImportFile = async (file) => {
        if (!file) return;

        const lowerName = file.name.toLowerCase();

        if (lowerName.endsWith(".csv")) {
            handleCSVImport(file);
            return;
        }

        if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
            await handleExcelImport(file);
            return;
        }

        alert("Unsupported file type. Please upload a CSV or Excel file.");
    };


    const mapStravaTypeToYourType = (stravaType) => {
        const t = String(stravaType || "").toLowerCase();
        if (t.includes("run")) return "run";
        if (t.includes("ride") || t.includes("bike")) return "bike";
        if (t.includes("swim")) return "swim";
        return "run";
    };

    const metersToMiles = (meters) => {
        const m = Number(meters);
        if (!Number.isFinite(m)) return "";
        return (m / 1609.34).toFixed(2);
    };

    const secondsToMinutes = (seconds) => {
        const s = Number(seconds);
        if (!Number.isFinite(s)) return "";
        return Math.round(s / 60);
    };

    const isoToDateTimeParts = (iso) => {
        // Strava often provides start_date_local like "2026-03-05T12:34:56Z" or with offset
        if (!iso) return { date: "", time: "" };
        const d = new Date(iso);
        if (isNaN(d)) return { date: "", time: "" };

        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");

        const hh = String(d.getHours()).padStart(2, "0");
        const min = String(d.getMinutes()).padStart(2, "0");

        return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
    };

    const stravaActivityToYourActivity = (s) => {
        const { date, time } = isoToDateTimeParts(s.start_date_local || s.start_date);

        return {
            id: crypto.randomUUID(),
            title: s.name || "Strava Activity",
            description: s.description || "",
            type: mapStravaTypeToYourType(s.type || s.sport_type),
            intensity: "easy",   // you can get fancy later (keywords / heart rate / etc.)
            feel: "medium",
            date,
            time,
            mode: "timeMiles",
            duration: secondsToMinutes(s.elapsed_time || s.moving_time),
            miles: metersToMiles(s.distance),
            splits: [{ mph: "", distance: "" }],
            notes: "Imported from Strava",
            photo: null,
        };
    };

    const fetchStravaActivities = async () => {
        if (!stravaToken) {
            alert("Not connected to Strava yet. Click Connect first.");
            return;
        }

        try {
        // Pull first 200 activities (you can add pagination later)
        const resp = await fetch(
            `http://localhost:5050/api/strava/activities?access_token=${encodeURIComponent(
            stravaToken
            )}&per_page=200&page=1`
        );

        const data = await resp.json();
        if (!resp.ok || data.error) {
            console.log(data);
            alert("Failed to fetch Strava activities.");
            return;
        }

        const imported = (data.activities || []).map(stravaActivityToYourActivity);

        // Merge with existing, then sort by date
        const updated = [...imported, ...activities];
        updated.sort((a, b) => parseLocalYMD(b.date) - parseLocalYMD(a.date));

            setActivities(updated);
            localStorage.setItem("activities", JSON.stringify(updated));
            alert(`Imported ${imported.length} activities from Strava ✅`);
        } catch (e) {
            console.error(e);
            alert("Error fetching from Strava server. Is npm run server running?");
        }
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

            <div className="page-spacer"></div>

            <div className="controls-row">

                <label className="import-btn">
                Import
                <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    hidden
                    onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) handleImportFile(file);
                    }}
                />
                </label>

                <button
                    onClick={handleExportCSV}
                    className="control-btn btn-secondary"
                >
                Export CSV
                </button>

                {/* For Strava modal */}
                <button
                    type="button"
                    onClick={() => setStravaModalOpen(true)}
                    className="strava-icon-btn"
                    aria-label="Open Strava options"
                    title="Open Strava options"
                >
                <img
                    src="/strava-logo.png"
                    alt="Strava"
                    className="strava-icon-img"
                />
                </button>

                <button
                    onClick={clearAllActivities}
                    className="control-btn btn-danger"
                >
                Delete All
                </button>

                <button
                    type="button"
                    onClick={() => setFilterModalOpen(true)}
                    className="filter-icon-btn"
                    aria-label="Open activity filters"
                    title="Open activity filters"
                >
                    <FiFilter />
                </button>

            </div>

            <div className="coach-controls">

                <span className="coach-label">
                    Coach alerts shown:
                </span>

                <div className="coach-dropdown-row">

                <select
                    value={coachAlertCount}
                    onChange={(e) => setCoachAlertCount(Number(e.target.value))}
                    className="coach-select"
                >
                    <option value={0}>0 (Off)</option>
                    <option value={1}>1 (Top priority)</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                </select>

                <button
                    type="button"
                    onClick={() => setCoachHelpOpen(true)}
                    aria-label="What are coach alerts?"
                    title="What are coach alerts?"
                    className="coach-help-btn"
                >
                    ?
                </button>

                </div>

            </div>

            <CoachHelpModal
                isOpen={coachHelpOpen}
                onClose={() => setCoachHelpOpen(false)}
            />

            <StravaModal
                isOpen={stravaModalOpen}
                onClose={() => setStravaModalOpen(false)}
                stravaToken={stravaToken}
                onConnect={() => {
                    window.location.href = "http://localhost:5050/auth/strava";
                }}
                onImport={fetchStravaActivities}
            />

            <ActivityFilterModal
                isOpen={filterModalOpen}
                onClose={() => setFilterModalOpen(false)}
                filters={filters}
                setFilters={setFilters}
                onReset={resetFilters}
            />

            {coachAlertCount > 0 &&
                coachAlerts.map((alert, i) => (
                <div key={alert.key || i} className={`coach-alert ${alert.toneClass}`}>
                    <div className="coach-alert-title">{alert.title}</div>
                    {alert.detail && (
                    <div className="coach-alert-detail">{alert.detail}</div>
                    )}
                </div>
                ))}



            <div className="activity-results-count">
                Showing {filteredActivities.length}{" "}
                {filteredActivities.length === 1 ? "activity" : "activities"}
            </div>

        {filteredActivities.slice(0, visibleCount).map((a, index) => {
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
                        <p
                            className="description-preview"
                            style={{ whiteSpace: "pre-line" }} 
                        >
                            {a.description}
                        </p>
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
                    <div className="expanded-section private-notes">
                        <strong>Notes</strong>
                        <p style={{ whiteSpace: "pre-line" }}>{a.notes}</p>
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
            {visibleCount < filteredActivities.length && (
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
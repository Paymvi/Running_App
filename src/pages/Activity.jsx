import React, { useState, useEffect, useMemo, useRef } from "react";
import FloatingButton from "../components/FloatingButton";
import AddActivityModal from "../components/AddActivityModal";
import { FiEdit2, FiFilter } from "react-icons/fi";


import { generateCoachAlerts } from "../utils/coachAlert";

import CoachHelpModal from "../components/CoachHelpModal";
import StravaModal from "../components/StravaModal";
import ActivityFilterModal from "../components/ActivityFilterModal";

import { parseLocalYMD } from "../utils/dateUtils";
import { getDefaultImage } from "../utils/activityHelpers";
import { detectPRs } from "../utils/prDetection";
import {
  mapStravaTypeToYourType,
  metersToMiles,
  secondsToMinutes
} from "../utils/stravaHelpers";

import {
  rowsToActivities,
  handleCSVImport,
  handleExcelImport
} from "../utils/importHelpers";

import useLazyLoad from "../hooks/useLazyLoad";
import ActivityCard from "../components/ActivityCard";

import { formatDateMDY } from "../utils/dateUtils";


export default function Activity() {
  const [activities, setActivities] = useState([]);

  const loadActivitiesFromStorage = () => {
    const saved = localStorage.getItem("activities");
    if (!saved) return;

    const parsed = JSON.parse(saved).map((a) => ({
      ...a,
      id: a.id || crypto.randomUUID(),
    }));

    parsed.sort((a, b) => {
      const dateDiff = parseLocalYMD(b.date) - parseLocalYMD(a.date);
      if (dateDiff !== 0) return dateDiff;
      return String(b.time || "").localeCompare(String(a.time || ""));
    });

    setActivities(parsed);

    // also rewrite storage to ensure ids persist
    localStorage.setItem("activities", JSON.stringify(parsed));
  };

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


    // Advanced Settings
    distanceMin: "",
    distanceMax: "",

    durationMin: "",
    durationMax: "",

    paceMin: "",
    paceMax: "",

    feels: [],

    dateStart: "",
    dateEnd: "",

    notesSearch: "",
  });

  // Lazy render (infinite scroll style)
  const PAGE_SIZE = 40; // how many cards to add per batch
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef(null);

    useEffect(() => {
      loadActivitiesFromStorage();
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
      setActivities((prevActivities) => {

        // ensure the activity always has a real id
        const activityId = activity.id || crypto.randomUUID();

        // check if this id already exists
        const exists = prevActivities.some((a) => a.id === activityId);

        let updated;

        if (exists) {
          // editing
          updated = prevActivities.map((a) =>
            a.id === activityId ? { ...a, ...activity, id: activityId } : a
          );
        } else {
          // new activity
          const newActivity = {
            ...activity,
            id: activityId,
          };
          updated = [newActivity, ...prevActivities];
        }

        updated.sort((a, b) => {
          const dateDiff = parseLocalYMD(b.date) - parseLocalYMD(a.date);
          if (dateDiff !== 0) return dateDiff;
          return String(b.time || "").localeCompare(String(a.time || ""));
        });

        localStorage.setItem("activities", JSON.stringify(updated));

        return updated;
      });

      // close modal after save
      setOpen(false);
      setEditingActivity(null);
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

    
    const coachAlerts = useMemo(() => {
        return generateCoachAlerts(activities, coachAlertCount);
    }, [activities, coachAlertCount]);

    const prs = useMemo(() => detectPRs(activities), [activities]);

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

        // Advanced Settings
        distanceMin: "",
        distanceMax: "",

        durationMin: "",
        durationMax: "",

        paceMin: "",
        paceMax: "",

        feels: [],

        dateStart: "",
        dateEnd: "",

        notesSearch: "",
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

      // Search inside notes / description
      if ((filters.notesSearch || "").trim()) {
        const query = filters.notesSearch.toLowerCase().trim();
        result = result.filter((a) => {
          const text = `${a.notes || ""} ${a.description || ""}`.toLowerCase();
          return text.includes(query);
        });
      }

      // Search by exact date
      if (filters.searchDate) {
        result = result.filter((a) => a.date === filters.searchDate);
      }

      // Filter by date range
      if (filters.dateStart) {
        result = result.filter(
          (a) => parseLocalYMD(a.date) >= parseLocalYMD(filters.dateStart)
        );
      }

      if (filters.dateEnd) {
        result = result.filter(
          (a) => parseLocalYMD(a.date) <= parseLocalYMD(filters.dateEnd)
        );
      }

      // Filter by activity type
      if (filters.types.length > 0) {
        result = result.filter((a) => filters.types.includes(a.type));
      }

      // Filter by intensity
      if (filters.intensities.length > 0) {
        result = result.filter((a) => filters.intensities.includes(a.intensity));
      }

      // Filter by feel
      if (filters.feels.length > 0) {
        result = result.filter((a) =>
          filters.feels.includes(String(a.feel || "").toLowerCase())
        );
      }

      // Filter by distance range
      if (filters.distanceMin || filters.distanceMax) {
        const min = Number(filters.distanceMin);
        const max = Number(filters.distanceMax);

        result = result.filter((a) => {
          const miles = Number(a.miles || 0);

          if (filters.distanceMin && miles < min) return false;
          if (filters.distanceMax && miles > max) return false;

          return true;
        });
      }

      // Filter by duration range
      if (filters.durationMin || filters.durationMax) {
        const min = Number(filters.durationMin);
        const max = Number(filters.durationMax);

        result = result.filter((a) => {
          const duration = Number(a.duration || 0);

          if (filters.durationMin && duration < min) return false;
          if (filters.durationMax && duration > max) return false;

          return true;
        });
      }

      // Filter by pace range
      if (filters.paceMin || filters.paceMax) {
        const min = Number(filters.paceMin);
        const max = Number(filters.paceMax);

        result = result.filter((a) => {
          const miles = Number(a.miles);
          const duration = Number(a.duration);

          if (!(miles > 0 && duration > 0)) return false;

          const pace = duration / miles;

          if (filters.paceMin && pace < min) return false;
          if (filters.paceMax && pace > max) return false;

          return true;
        });
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

    useLazyLoad(loadMoreRef, () => {
      setVisibleCount((v) =>
        Math.min(v + PAGE_SIZE, filteredActivities.length)
      );
    });

    // For lazy load
    useEffect(() => {
        // When filters or dataset change, restart the visible window
        setVisibleCount(PAGE_SIZE);
        setExpandedIndex(null);
    }, [filteredActivities.length]);


    const handleImportFile = async (file) => {
      if (!file) return;

      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith(".csv")) {
          handleCSVImport(file, activities, setActivities);
          return;
      }

      if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
          await handleExcelImport(file, activities, setActivities);
          return;
      }

      alert("Unsupported file type. Please upload a CSV or Excel file.");
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
    
    const handleExportCSV = () => {
        if (!activities.length) {
            alert("No activities to export.");
            return;
        }

        // Define headers
        const headers = [
            "id",
            "title",
            "description",
            "type",
            "intensity",
            "feel",
            "limiter",
            "tags",
            "date",
            "time",
            "miles",
            "duration",
            "notes"
        ];

        // Convert activities to CSV rows
        const rows = activities.map((activity) => [
            activity.id || "",
            activity.title || "",
            activity.description || "",
            activity.type || "",
            activity.intensity || "",
            activity.feel || "",
            activity.limiter || "",
            (activity.tags || []).join("|"),
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

      setActivities((prevActivities) => {
        const updated = prevActivities.filter((a) => a.id !== id);
        localStorage.setItem("activities", JSON.stringify(updated));
        return updated;
      });

      setOpen(false);
      setEditingActivity(null);
    };

    console.log("Activities:", activities.length);
    console.log("Filtered:", filteredActivities.length);
    console.log("visibleCount:", visibleCount);

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

            {filteredActivities.slice(0, visibleCount).map((a, index) => (
              <ActivityCard
                key={a.id}
                a={a}
                index={index}
                expandedIndex={expandedIndex}
                setExpandedIndex={setExpandedIndex}
                prIds={prIds}
                onEdit={(activity) => {
                  setEditingActivity({ ...activity });
                  setOpen(true);
                }}
              />
            ))}

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
                loadActivitiesFromStorage();
              }}
              onSave={saveActivity}
              onDelete={deleteActivity}
            />

        </div>
  );
}
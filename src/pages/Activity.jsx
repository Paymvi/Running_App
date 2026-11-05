import React, { useState, useEffect, useMemo, useRef } from "react";
import { FiFilter } from "react-icons/fi";


import { generateCoachAlerts } from "../utils/coachAlert";

import CoachHelpModal from "../components/CoachHelpModal";
import StravaModal from "../components/StravaModal";
import ActivityFilterModal from "../components/ActivityFilterModal";
import BackupModal from "../components/BackupModal";

import { parseLocalYMD, normalizeYMD } from "../utils/dateUtils";
import { activityMiles, activityMinutes, formatDuration } from "../utils/activityModel";
import { detectPRs } from "../utils/prDetection";
import {
  useActivities,
  previewImport,
  mergeImported,
  deleteAllActivities,
} from "../utils/activityStore";
import { saveBackup } from "../utils/backups";
import { snapshotAll } from "../utils/storage";
import { toDisplay, useUnit } from "../utils/units";
import { vibrate } from "../utils/feedback";
import {
  connectUrl,
  getStravaStatus,
  disconnectStrava,
  fetchAllStravaActivities,
  mapStravaActivities,
} from "../utils/stravaClient";

import {
  parseCSVFile,
  parseExcelFile,
  handleExportCSV,
  handleExportExcel
} from "../utils/importHelpers";

import useLazyLoad from "../hooks/useLazyLoad";
import ActivityCard from "../components/ActivityCard";

const DEFAULT_FILTERS = {
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
};

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function initialStravaStatus() {
  const result = new URLSearchParams(window.location.search).get("strava");
  if (result === "connected") return "Connected to Strava ✅";
  if (result === "error") return "Strava connection failed or was cancelled ❌";
  return "";
}

const COACH_KEY = "velo_coach_alerts";
function readCoachCount() {
  try {
    const raw = localStorage.getItem(COACH_KEY);
    const n = Number(raw);
    return raw !== null && Number.isInteger(n) && n >= 0 && n <= 4 ? n : 1;
  } catch {
    return 1;
  }
}

export default function Activity({ onEditActivity, onDeleted }) {
  const { activities } = useActivities();
  const unit = useUnit();

  const [expandedId, setExpandedId] = useState(null);
  const [coachAlertCount, setCoachAlertCount] = useState(readCoachCount); // 0 hides coaching
  const [coachSaveError, setCoachSaveError] = useState("");
  const [coachHelpOpen, setCoachHelpOpen] = useState(false);
  const [stravaModalOpen, setStravaModalOpen] = useState(false);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaStatus, setStravaStatus] = useState(initialStravaStatus);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("xlsx");
  const [busy, setBusy] = useState(""); // label of the running import, "" when idle
  const fileInputRef = useRef(null);

  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  // Lazy render (infinite scroll style)
  const PAGE_SIZE = 40; // how many cards to add per batch
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef(null);

  // Restart the visible window whenever the filters change (even if the count doesn't).
  const filterKey = JSON.stringify(filters);
  const [windowKey, setWindowKey] = useState(filterKey);
  if (windowKey !== filterKey) {
    setWindowKey(filterKey);
    setVisibleCount(PAGE_SIZE);
  }

  // Remove the OAuth result from the address bar once read.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("strava")) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!stravaModalOpen) return;
    let cancelled = false;
    getStravaStatus().then((s) => {
      if (cancelled) return;
      setStravaConnected(s.connected);
      if (s.offline) setStravaStatus("Can't reach the Velo server. Is `npm run server` running?");
    });
    return () => {
      cancelled = true;
    };
  }, [stravaModalOpen]);

    // Moves every activity to Recently deleted (kept 30 days, restorable). Notes, profile
    // and settings are untouched; resetting the whole app is under Backup & recovery.
    const clearAllActivities = async () => {
        const confirmDelete = window.confirm(
            `Move all ${activities.length} activities to Recently deleted? You can restore them for 30 days from Backup & recovery. Notes, profile and settings are not affected.`
        );
        if (!confirmDelete) return;

        try {
          await saveBackup({ reason: "before Delete All", ...(await snapshotAll()) });
        } catch {
          if (!window.confirm("Velo couldn't save an automatic backup first. Continue? (They still go to Recently deleted.)")) return;
        }

        const ids = activities.map((a) => a.id);
        const result = deleteAllActivities();
        if (!result.ok) alert(result.error);
        else {
          vibrate(120);
          onDeleted?.(ids, `${result.count} activities moved to Recently deleted.`);
        }
    };

    const changeCoachCount = (n) => {
      setCoachAlertCount(n);
      try {
        localStorage.setItem(COACH_KEY, String(n));
        setCoachSaveError("");
      } catch {
        setCoachSaveError("This setting couldn't be saved and will reset when you reload.");
      }
    };

    const coachAlerts = useMemo(() => {
        return generateCoachAlerts(activities, coachAlertCount, { unit });
    }, [activities, coachAlertCount, unit]);

    const prs = useMemo(() => detectPRs(activities), [activities]);

    const prIds = useMemo(() => {
        return new Set([prs.mile.id, prs.fiveK.id, prs.tenK.id].filter(Boolean));
    }, [prs]);

    const resetFilters = () => setFilters(DEFAULT_FILTERS);

    const rangeWarning = useMemo(() => {
      const inverted = (min, max) => min !== "" && max !== "" && Number(min) > Number(max);
      if (filters.dateStart && filters.dateEnd && filters.dateStart > filters.dateEnd) return "Date range start is after its end.";
      if (inverted(filters.distanceMin, filters.distanceMax)) return "Distance minimum is above the maximum.";
      if (inverted(filters.durationMin, filters.durationMax)) return "Duration minimum is above the maximum.";
      if (inverted(filters.paceMin, filters.paceMax)) return "Pace minimum is above the maximum.";
      return "";
    }, [filters]);

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

      // Search by exact date (stored dates may be legacy M/D/YYYY)
      if (filters.searchDate) {
        result = result.filter((a) => normalizeYMD(a.date) === filters.searchDate);
      }

      // Filter by date range
      if (filters.dateStart) {
        const start = parseLocalYMD(filters.dateStart);
        result = result.filter((a) => parseLocalYMD(a.date) >= start);
      }

      if (filters.dateEnd) {
        const end = parseLocalYMD(filters.dateEnd);
        result = result.filter((a) => {
          const d = parseLocalYMD(a.date);
          return d && d <= end;
        });
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
          const miles = toDisplay(activityMiles(a), unit);

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
          const duration = activityMinutes(a);

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
          const miles = activityMiles(a);
          const duration = activityMinutes(a);

          if (!(miles > 0 && duration > 0)) return false;

          const pace = duration / toDisplay(miles, unit); // minutes per display unit

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
          const aMiles = activityMiles(a);
          const aDuration = activityMinutes(a);
          const bMiles = activityMiles(b);
          const bDuration = activityMinutes(b);

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
        result.sort((a, b) => activityMiles(b) - activityMiles(a));
      } else if (filters.sortBy === "longestTime") {
        result.sort((a, b) => activityMinutes(b) - activityMinutes(a));
      }
      // "newest" keeps the store's order (date, then time, newest first)

      return result;
    }, [activities, filters, prIds, unit]);

    useLazyLoad(loadMoreRef, () => {
      setVisibleCount((v) =>
        Math.min(v + PAGE_SIZE, filteredActivities.length)
      );
    });


    // Parses, previews (new / duplicate / rejected), then merges into the current list.
    const runImport = async (label, getParsed) => {
      if (busy) return;
      setBusy(label);
      try {
        const { accepted, rejected = [], warnings = [], idlessIds } = await getParsed();
        const { added, duplicates, possible } = previewImport(accepted, idlessIds);

        const lines = [`${added.length} new ${added.length === 1 ? "activity" : "activities"} ready to import.`];
        if (duplicates) lines.push(`${duplicates} already in Velo will be skipped.`);
        if (rejected.length) {
          lines.push(`${plural(rejected.length, "row")} rejected:`);
          rejected.slice(0, 8).forEach((r) => lines.push(`  Row ${r.row}: ${r.errors.join("; ")}`));
          if (rejected.length > 8) lines.push(`  …and ${rejected.length - 8} more`);
        }
        lines.push(...warnings);

        if (!added.length) {
          alert(lines.join("\n"));
          return;
        }
        if (!window.confirm(`${lines.join("\n")}\n\nImport now?`)) return;

        // Rows without an id that match an existing activity are never merged; the user chooses.
        let skip = new Set();
        if (possible.length) {
          const sample = possible.slice(0, 5).map((a) => `  ${a.date} ${a.type} ${a.miles || "-"} mi ${a.duration ? formatDuration(activityMinutes(a)) : "-"}`).join("\n");
          const skipThem = window.confirm(
            `${plural(possible.length, "row")} look like activities already in Velo (same date, sport, distance and time):\n${sample}${possible.length > 5 ? "\n  …" : ""}\n\nOK = skip these possible duplicates. Cancel = import them too.`
          );
          if (skipThem) skip = new Set(possible.map((a) => a.id));
        }

        const result = mergeImported(accepted, skip);
        alert(result.ok ? `Imported ${result.added} ✅` : result.error);
      } catch (e) {
        alert(`Import failed: ${e.message || e}`);
      } finally {
        setBusy("");
      }
    };

    const handleImportFile = (file) => {
      if (!file) return;

      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith(".csv")) {
          return runImport("Importing CSV…", () => parseCSVFile(file));
      }

      if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
          return runImport("Importing Excel…", () => parseExcelFile(file));
      }

      alert("Unsupported file type. Please upload a CSV or Excel file.");
    };

    const fetchStravaActivities = () =>
      runImport("Importing from Strava…", async () => {
        const { raw, error, partial } = await fetchAllStravaActivities((n) =>
          setBusy(`Importing from Strava… ${n} fetched`)
        );
        if (error && !partial) throw new Error(error);
        const { activities: mapped, unsupported } = mapStravaActivities(raw);
        const warnings = [];
        const skipped = Object.entries(unsupported);
        if (skipped.length) {
          warnings.push(`Skipped unsupported Strava types: ${skipped.map(([t, n]) => `${t} (${n})`).join(", ")}.`);
        }
        if (error) warnings.push(`Partial import: ${error}`);
        return { accepted: mapped, warnings };
      });

    const handleDisconnect = async () => {
      if (!window.confirm("Disconnect Strava? Already-imported activities stay in Velo.")) return;
      try {
        await disconnectStrava();
        setStravaConnected(false);
        setStravaStatus("Disconnected from Strava.");
      } catch (e) {
        setStravaStatus(e.message);
      }
    };

    const handleExport = async () => {
      if (!activities.length) {
        alert("No activities to export.");
        return;
      }
      try {
        if (exportFormat === "xlsx") await handleExportExcel(activities);
        else handleExportCSV(activities);
      } catch (e) {
        alert(`Export failed: ${e.message || e}`);
      }
    };

    return (
        <div className="page">
          <div className="page-spacer"></div>
            <div className="controls-row">

                <button
                    type="button"
                    className="import-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={Boolean(busy)}
                >
                Import
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    hidden
                    onChange={(e) => {
                        const file = e.target.files[0];
                        e.target.value = ""; // allow choosing the same file again
                        if (file) handleImportFile(file);
                    }}
                />

                <span className="export-group">
                  <button
                      type="button"
                      onClick={handleExport}
                      className="control-btn btn-secondary"
                  >
                  Export
                  </button>
                  <select
                      className="export-format"
                      aria-label="Export format"
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value)}
                  >
                      <option value="xlsx">Excel</option>
                      <option value="csv">CSV</option>
                  </select>
                </span>

                <button
                    type="button"
                    onClick={() => setBackupModalOpen(true)}
                    className="control-btn btn-secondary"
                >
                Backup
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
                    alt=""
                    className="strava-icon-img"
                />
                </button>

                <button
                    type="button"
                    onClick={clearAllActivities}
                    className="control-btn btn-danger"
                    disabled={!activities.length}
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

            {busy && (
              <div className="activity-results-count" role="status">
                {busy}
              </div>
            )}

            <div className="coach-controls">

              <label className="coach-label" htmlFor="coach-alert-count">
                  Coach alerts shown:
              </label>

              <div className="coach-dropdown-row">
                <select
                    id="coach-alert-count"
                    value={coachAlertCount}
                    onChange={(e) => changeCoachCount(Number(e.target.value))}
                    className="coach-select"
                >
                    <option value={0}>Hidden</option>
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
              {coachSaveError && <div className="field-error" role="alert">{coachSaveError}</div>}
            </div>

            <CoachHelpModal
                isOpen={coachHelpOpen}
                onClose={() => setCoachHelpOpen(false)}
            />

            <StravaModal
                isOpen={stravaModalOpen}
                onClose={() => setStravaModalOpen(false)}
                connected={stravaConnected}
                status={stravaStatus}
                busy={Boolean(busy)}
                onConnect={() => {
                    window.location.href = connectUrl();
                }}
                onImport={fetchStravaActivities}
                onDisconnect={handleDisconnect}
            />

            <ActivityFilterModal
                isOpen={filterModalOpen}
                onClose={() => setFilterModalOpen(false)}
                filters={filters}
                setFilters={setFilters}
                onReset={resetFilters}
                unit={unit}
            />

            <BackupModal
                isOpen={backupModalOpen}
                onClose={() => setBackupModalOpen(false)}
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



            <div className="activity-results-count" aria-live="polite">
                Showing {filteredActivities.length}{" "}
                {filteredActivities.length === 1 ? "activity" : "activities"}
                {rangeWarning && <span className="field-error"> · {rangeWarning}</span>}
            </div>

            {filteredActivities.slice(0, visibleCount).map((a) => (
              <ActivityCard
                key={a.id}
                a={a}
                expanded={expandedId === a.id}
                onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)}
                prIds={prIds}
                onEdit={(activity) => onEditActivity?.({ ...activity })}
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

        </div>
  );
}

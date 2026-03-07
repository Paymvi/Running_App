import React, { useMemo, useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { FiSettings } from "react-icons/fi";
import CalendarSettingsModal from "./CalendarSettingsModal"; // adjust path


/*
┌─────────────────┬──────────────────────────────────────────────┐
│ Calendar Rule   │ Behavior                                     │
├─────────────────┼──────────────────────────────────────────────┤
│ Run/Bike/Swim   │ Opacity is based on distance relative to     │
│ Opacity         │ that activity type's max distance.           │
├─────────────────┼──────────────────────────────────────────────┤
│ Workout Opacity │ Opacity is based on feel, not minutes.       │
│                 │ easy = light, medium = medium, hard = dark   │
├─────────────────┼──────────────────────────────────────────────┤
│ Tile Priority   │ If multiple activities happen on one day,    │
│                 │ the label priority is:                       │
│                 │ run -> bike -> swim -> workout               │
├─────────────────┼──────────────────────────────────────────────┤
│ Workout Label   │ Workout tiles show a short label from the    │
│                 │ title when possible: Push, Back, Legs,       │
│                 │ Upper, or Lower.                             │
└─────────────────┴──────────────────────────────────────────────┘
*/

// This looks for the type of workout to put in the calendar later
function getWorkoutCalendarLabel(activity) {
  const rawTitle = String(activity?.title || "").toLowerCase().trim();

  if (!rawTitle) return "Workout";

  if (rawTitle.includes("push") || rawTitle.includes("chest") || rawTitle.includes("shoulder") || rawTitle.includes("tricep")) {
    return "Push";
  }

  if (rawTitle.includes("back") || rawTitle.includes("pull") || rawTitle.includes("lat") || rawTitle.includes("row") || rawTitle.includes("bicep")) {
    return "Back";
  }

  if (rawTitle.includes("legs") || rawTitle.includes("leg") || rawTitle.includes("quad") || rawTitle.includes("hamstring") || rawTitle.includes("glute")) {
    return "Legs";
  }

  if (rawTitle.includes("upper")) return "Upper";
  if (rawTitle.includes("lower")) return "Lower";

  return "Workout";
}

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

const pad2 = (n) => String(n).padStart(2, "0");
const toYMD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

const COLORS = {
  run: [252, 76, 2],       // orange
  bike: [255, 214, 0],     // yellow
  swim: [120, 200, 255],   // light blue
  workout: [255, 90, 200], // pink
};

// pick a “value” for each type (you can refine later)
// run/swim: miles
// bike: miles or minutes
// workout: minutes or a "load" if you add it later
function getActivityValue(a, bikeScaleMode = "time") {
  const type = (a.type || a.sport || a.activityType || "run").toLowerCase();

  if (type === "workout") {
    const mins = Number(a.minutes ?? a.duration ?? a.durationMin ?? a.durationMinutes ?? 0);
    if (Number.isFinite(mins) && mins > 0) return { type, value: mins };
    return { type, value: 1 };
  }

  if (type === "bike") {
    if (bikeScaleMode === "time") {
      const mins = Number(a.minutes ?? a.duration ?? a.durationMin ?? a.durationMinutes ?? 0);
      if (Number.isFinite(mins) && mins > 0) return { type, value: mins };
      return { type, value: 0 };
    }

    const miles = Number(a.miles ?? 0);
    if (!Number.isFinite(miles) || miles <= 0) return { type, value: 0 };
    return { type, value: miles };
  }

  const miles = Number(a.miles ?? 0);
  if (!Number.isFinite(miles) || miles <= 0) return { type, value: 0 };
  return { type, value: miles };
}

function getWorkoutFeelIntensity(activity) {
  const feel = String(activity?.feel || "").toLowerCase();

  if (feel === "easy") return 0.35;
  if (feel === "medium") return 0.65;
  if (feel === "hard") return 1.0;

  return 0.5; // fallback
}

// convert intensity (0..1) into alpha that looks good
function intensityToAlpha(t) {
  // base visibility + scaling
  return 0.12 + t * 0.5; // Fix to make it not too bright
}

// Create a split gradient if multiple sports exist that day
function buildHeatBackground(parts) {
  // parts: [{ type, alpha }]
  if (!parts.length) return null;
  if (parts.length === 1) {
    const { type, alpha } = parts[0];
    const [r, g, b] = COLORS[type];
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Split vertically into equal segments
  const seg = 100 / parts.length;
  const stops = parts.map((p, i) => {
    const [r, g, b] = COLORS[p.type];
    const c = `rgba(${r}, ${g}, ${b}, ${p.alpha})`;
    const start = (i * seg).toFixed(3);
    const end = ((i + 1) * seg).toFixed(3);
    return `${c} ${start}% ${end}%`;
  });

  return `linear-gradient(90deg, ${stops.join(", ")})`;
}


export default function RunCalendar({ activities }) {

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [runScaleMode, setRunScaleMode] = useState("auto"); 
  // "auto" = scale to your highest run
  // "custom" = scale to user input

  const [runCustomMax, setRunCustomMax] = useState(6.2);

  // toggles (persisted)
  const [triathleteMode, setTriathleteMode] = useState(false);
  const [hybridMode, setHybridMode] = useState(false);

  // bike heatmap mode
  // "distance" = use miles
  // "time" = use minutes
  const [bikeScaleMode, setBikeScaleMode] = useState("time");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("calendar_settings_v1");
      if (!raw) return;

      const s = JSON.parse(raw);

      setTriathleteMode(!!s.triathleteMode);
      setHybridMode(!!s.hybridMode);

      setRunScaleMode(s.runScaleMode || "auto");
      setRunCustomMax(Number(s.runCustomMax || 6.2));

      setBikeScaleMode(s.bikeScaleMode || "time");

    } catch {}
  }, []);




  useEffect(() => {
    try {
      localStorage.setItem(
        "calendar_settings_v1",
        JSON.stringify({
          triathleteMode,
          hybridMode,
          runScaleMode,
          runCustomMax,
          bikeScaleMode
        })
      );
    } catch {}
  }, [triathleteMode, hybridMode, runScaleMode, runCustomMax, bikeScaleMode]);



  const enabledTypes = useMemo(() => {
    const types = new Set(["run"]); // always show runs
    if (triathleteMode) {
      types.add("bike");
      types.add("swim");
    }
    if (hybridMode) {
      types.add("workout");
    }
    return types;
  }, [triathleteMode, hybridMode]);

  // day -> { run, bike, swim, workout }
  const totalsByDay = useMemo(() => {
    const map = {};

    for (const a of activities || []) {
      const d = parseLocalYMD(a.date);
      if (!d || isNaN(d)) continue;
      const day = toYMD(d);

      const { type, value } = getActivityValue(a, bikeScaleMode);
      if (!enabledTypes.has(type)) continue;
      if (!value || value <= 0) continue;

      if (!map[day]) {
        map[day] = {
          run: 0,
          bike: 0,
          swim: 0,
          workout: 0,
          workoutLabel: null,
          workoutIntensity: 0,
        };
      }

      if (map[day][type] == null) map[day][type] = 0;
      map[day][type] += value;

      // Save a readable workout label for calendar display
      if (type === "workout" && !map[day].workoutLabel) {
        map[day].workoutLabel = getWorkoutCalendarLabel(a);
      }
      if (type === "workout") {
        const intensity = getWorkoutFeelIntensity(a);
        map[day].workoutIntensity = Math.max(map[day].workoutIntensity, intensity);
      }
    }

    return map;
  }, [activities, enabledTypes, bikeScaleMode]);

  // separate max per type for fair scaling
  const maxByType = useMemo(() => {

    const max = {
      run: 0,
      bike: bikeScaleMode === "time" ? 60 : 10,
      swim: 1,
      workout: 30
    };

    for (const day of Object.keys(totalsByDay)) {
      const t = totalsByDay[day];

      for (const k of Object.keys(max)) {

        const v = Number(t?.[k] ?? 0);
        if (!Number.isFinite(v)) continue;

        if (k === "run") {

          // AUTO MODE
          if (runScaleMode === "auto") {
            max.run = Math.max(max.run, v);
          }

        } else {
          max[k] = Math.max(max[k], v);
        }
      }
    }

    // CUSTOM MODE
    if (runScaleMode === "custom") {
      max.run = Math.max(0.1, Number(runCustomMax) || 0.1);
    }

    return max;

  }, [totalsByDay, runScaleMode, runCustomMax, bikeScaleMode]);

  const tileContent = ({ date, view }) => {
    if (view !== "month") return null;

    const key = toYMD(date);
    const t = totalsByDay[key];
    if (!t) return null;

    const present = [];
    for (const type of ["run", "bike", "swim", "workout"]) {
      const v = Number(t[type] ?? 0);
      if (v > 0 && enabledTypes.has(type)) {
        let intensity;

        if (type === "workout") {
          intensity = t.workoutIntensity || 0.5;
        } else {
          const maxVal = Math.max(0.1, maxByType[type] || 0.1);
          intensity = clamp01(v / maxVal);
        }

        present.push({ type, value: v, alpha: intensityToAlpha(intensity) });
      }
    }
    if (!present.length) return null;

    const bg = buildHeatBackground(present);

    // Priority order for label display
    const priority = ["run", "bike", "swim", "workout"];

    // pick the highest priority activity that exists that day
    let top = null;
    for (const p of priority) {
      const found = present.find(x => x.type === p);
      if (found) {
        top = found;
        break;
      }
    }

    // fallback (should rarely happen)
    if (!top) {
      top = present[0];
    }

    let tileLabel = "";

    if (top.type === "workout") {
      tileLabel = t.workoutLabel || "Workout";
    } else if (top.type === "bike" && bikeScaleMode === "time") {
      tileLabel = `${Math.round(top.value)} min`;
    } else {
      tileLabel = `${top.value.toFixed(top.value >= 10 ? 0 : 1)} mi`;
    }

    return (
      <>
        <div className="tile-heat" style={{ background: bg }} />

        <div className="tile-miles">
          {tileLabel}
        </div>
      </>
    );
  };

  return (
    <div className="run-calendar-card">
      <div className="run-calendar-header">
        <div className="run-calendar-title-row">
          <h2 className="run-calendar-title">Training Calendar</h2>

          <button
            className="icon-btn"
            onClick={() => setSettingsOpen(true)}
            aria-label="Calendar settings"
            title="Calendar settings"
          >
            <FiSettings />
          </button>

        </div>

        <div className="run-calendar-sub">{/* optional subtitle */}</div>
      </div>

      {/* Force Sunday-start in the simplest way */}
      <Calendar
        tileContent={tileContent}
        value={null}
        locale="en-US"
      />

      <div className="run-calendar-legend">
        <span className="legend-item">
          <span className="legend-dot run" /> run
        </span>

        {triathleteMode && (
          <>
            <span className="legend-item">
              <span className="legend-dot bike" /> bike
            </span>
            <span className="legend-item">
              <span className="legend-dot swim" /> swim
            </span>
          </>
        )}

        {hybridMode && (
          <span className="legend-item">
            <span className="legend-dot workout" /> workout
          </span>
        )}
      </div>

      <CalendarSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        triathleteMode={triathleteMode}
        setTriathleteMode={setTriathleteMode}
        hybridMode={hybridMode}
        setHybridMode={setHybridMode}
        runScaleMode={runScaleMode}
        setRunScaleMode={setRunScaleMode}
        runCustomMax={runCustomMax}
        setRunCustomMax={setRunCustomMax}
        bikeScaleMode={bikeScaleMode}
        setBikeScaleMode={setBikeScaleMode}
      />
    </div>
    
  );
}
import React, { useEffect, useState, useMemo, useRef } from "react";
import ReactCountryFlag from "react-country-flag";

const TAG_OPTIONS = [
  "Slow is smooth... smooth is fast",
  "Zone 5 enthusiast",
  "Suffering Efficiently",
  "Powered by Delusion",
  "New Pace Who Dis",
  "Pace Questionable",
  "Sub-35 loading...",
  "Sub-30 loading...",
  "Sub-25 loading...",
  "Sub-20 loading...",
  "Sub-whatever",
  "Elite (Locally)",
  "Consistently Mid",
  "Optimizing… Probably",
  "DOMS Specialist",
  "Breathing Optional",
  "Fueling: Vibes",
  "Built Different (Unfortunately)",
  "Mentally at Mile 20",
  "Succumbed to the zone 2 propaganda",
  "Carb Loading Daily",
  "Why Am I Like This",
  "No Plan Just Miles",
  "Fasted & Confused",
  "Perpetually Tired",
  "Soft Launching a PR",
  "Negative Split Era",
  "Hill Trauma Survivor",
];



function formatTime(min) {
  if (!isFinite(min)) return "-";
  const m = Math.floor(min);
  const s = Math.round((min - m) * 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// -------------------------
// SAFE DATE PARSER (handles M/D/YYYY and ISO)
// -------------------------
function parseDateSafe(dateStr) {
  if (!dateStr) return null;

  // Try normal parsing first (ISO format)
  const iso = new Date(dateStr);
  if (!isNaN(iso)) return iso;

  // Try M/D/YYYY format
  const match = String(dateStr)
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (match) {
    const month = Number(match[1]) - 1;
    const day = Number(match[2]);
    const year = Number(match[3]);
    const d = new Date(year, month, day);
    return isNaN(d) ? null : d;
  }

  return null;
}

// -------------------------
// SAFE DURATION PARSER (handles mm:ss or decimal minutes)
// -------------------------
function parseDurationMinutes(val) {
  if (val == null) return 0;

  if (typeof val === "number") return val;

  const s = String(val).trim();

  // mm:ss or hh:mm:ss
  if (s.includes(":")) {
    const parts = s.split(":").map((p) => p.trim());

    if (parts.length === 2) {
      const [m, sec] = parts.map(Number);
      return m + sec / 60;
    }

    if (parts.length === 3) {
      const [h, m, sec] = parts.map(Number);
      return h * 60 + m + sec / 60;
    }

    return 0;
  }

  const n = Number(s);
  return isFinite(n) ? n : 0;
}

// -------------------------
// WEEK HELPERS (Mon -> Sun)
// -------------------------
function startOfWeekMonday(dateObj) {
  const d = new Date(dateObj);
  d.setHours(0, 0, 0, 0);

  // JS: Sun=0, Mon=1, ... Sat=6
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // move back to Monday
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(dateObj, days) {
  const d = new Date(dateObj);
  d.setDate(d.getDate() + days);
  return d;
}

function weeksBetween(startWeek, endWeek) {
  const ms = endWeek.getTime() - startWeek.getTime();
  return Math.round(ms / (7 * 24 * 60 * 60 * 1000));
}

function formatWeekRange(startDateObj) {
  const end = addDays(startDateObj, 6);
  const sameMonth = startDateObj.getMonth() === end.getMonth();
  const sameYear = startDateObj.getFullYear() === end.getFullYear();

  const startStr = startDateObj.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  const endStr = end.toLocaleDateString("en-US", {
    month: sameMonth ? undefined : "long",
    day: "numeric",
  });

  // Optional: if weeks can span years (rare), add year
  const yearStr = sameYear ? "" : `, ${end.getFullYear()}`;

  return `${startStr} - ${endStr}${yearStr}`;
}

function formatHoursMinsFromMinutes(totalMinutes) {
  if (!isFinite(totalMinutes)) return "-";
  const mins = Math.round(totalMinutes);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}




function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function hashString(str) {
  // deterministic hash for colors/positions
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  // deterministic PRNG
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}



function EasyJar({ runs = [], title = "Easy Jar", subtitle }) {
  // SVG coordinate system
  const W = 240;
  const H = 220;

  // jar interior bounds (where balls can be placed)
    const inner = {
        x: 40,
        y: 45,
        w: 160,
        h: 150,
    };

  // compute max duration for brightness scaling
  const durations = runs.map((r) => r.duration || 0).filter(Boolean);
  const maxDur = Math.max(30, ...durations); // at least 30 so it doesn't blow out

  // place circles with a simple deterministic packing attempt
  const circles = useMemo(() => {
    const placed = [];

    if (!runs.length) return placed;

    const rowGap = 4;

    // scale radius based on duration
    const radii = runs.map((r) => {
        const dur = r.duration || 0;
        const t = Math.min(1, dur / 75);
        return 7 + t * 4;
    });

    const bottomY = inner.y + inner.h - 4;
    let currentY = bottomY;

    let row = [];
    let rowWidth = 0;

    for (let i = 0; i < runs.length; i++) {
        const r = runs[i];
        const rad = radii[i];

        if (row.length === 0) {
        row.push({ r, rad });
        rowWidth = rad * 2;
        continue;
        }

        const nextWidth = rowWidth + rowGap + rad * 2;

        // prevent overflow near jar shoulders
        if (nextWidth > inner.w - 24) {
        const startX = inner.x + (inner.w - rowWidth) / 2;
        let xCursor = startX;

        for (const item of row) {
            placed.push({
            cx: xCursor + item.rad,
            cy: currentY - item.rad,
            r: item.rad,
            data: item.r,
            });

            xCursor += item.rad * 2 + rowGap;
        }

        currentY -= Math.max(...row.map((x) => x.rad)) * 2 + rowGap;

        row = [{ r, rad }];
        rowWidth = rad * 2;
        } else {
        row.push({ r, rad });
        rowWidth = nextWidth;
        }
    }

    // render last row
    if (row.length > 0) {
        const startX = inner.x + (inner.w - rowWidth) / 2;
        let xCursor = startX;

        for (const item of row) {
        placed.push({
            cx: xCursor + item.rad,
            cy: currentY - item.rad,
            r: item.rad,
            data: item.r,
        });

        xCursor += item.rad * 2 + rowGap;
        }
    }

    return placed.map((p) => {
        const dur = p.data.duration || 0;
        const tDur = Math.max(0, Math.min(1, dur / maxDur));
        const alpha = 0.25 + tDur * 0.75;

        return {
        cx: p.cx,
        cy: p.cy,
        r: p.r,
        fill: `rgba(252,76,2,${alpha})`,
        glow: tDur,
        key: p.data.key,
        label: p.data.label,
        dur,
        miles: p.data.miles,
        date: p.data.date,
        };
    });
    }, [runs, maxDur]);

  return (
    <div className="jar-card">
      <div className="jar-head">
        <div className="jar-title">{title}</div>
        <div className="jar-sub">{subtitle}</div>
      </div>

      <div className="jar-wrap" aria-label="Easy Run Jar">
        <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            className="jar-svg">
          {/* Glow filter */}
          <defs>
            <filter id="ballGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Glass gradient */}
            <linearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.20)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
            </linearGradient>
          </defs>

          {/* Jar outline */}
          <path
            className="jar-glass"
            d="
            M70 35
            Q70 25 80 25
            L160 25
            Q170 25 170 35
            L170 45
            Q170 55 180 60
            Q200 70 200 95
            L200 185
            Q200 205 180 205
            L60 205
            Q40 205 40 185
            L40 95
            Q40 70 60 60
            Q70 55 70 45
            Z
            "
          />

          {/* Glass highlight */}
          <path
            className="jar-highlight"
            d="M110 78 Q105 120 110 175"
          />

          {/* Balls */}
          {circles.map((c) => (
            <g key={c.key} filter={c.glow > 0.75 ? "url(#ballGlow)" : undefined}>
              <circle
                cx={c.cx}
                cy={c.cy}
                r={c.r}
                fill={c.fill}
                className="jar-ball"
              />
              {/* tiny specular highlight */}
              <circle
                cx={c.cx - c.r * 0.25}
                cy={c.cy - c.r * 0.25}
                r={Math.max(1.6, c.r * 0.25)}
                fill="rgba(255,255,255,0.35)"
              />
            </g>
          ))}

          {/* Base shadow */}
          <ellipse cx="170" cy="208" rx="95" ry="10" className="jar-shadow" />
        </svg>

        {runs.length === 0 && (
          <div className="jar-empty">
            Add an <b>EASY</b> run to drop a ball 🫙
          </div>
        )}
      </div>
    </div>
  );
}


function WeeklyMileage({ weeks = [], selectedIndex = 0, onSelect }) {
  const scrollerRef = useRef(null);
  const [visibleMax, setVisibleMax] = useState(4); // y-axis max for visible window
  // SVG coord system
    const H = 220;
    const pad = { l: 42, r: 18, t: 18, b: 34 };
    const axisW = pad.l; // fixed y-axis column width

    const innerH = H - pad.t - pad.b;

    // spacing per week (controls how wide the chart is)
    const slot = 20; // px per week (tweak to taste)
    const visibleWeeks = 4; // about 3 months
    // const W = Math.max(520, pad.l + pad.r + (weeks.length - 1) * slot);
    const W = pad.l + pad.r + weeks.length * slot;

  const points = useMemo(() => {
    if (!weeks.length) return [];

    return weeks.map((w, i) => {
        const x = pad.l + i * slot;
        // y uses visibleMax (dynamic)
        const safeMax = Math.max(visibleMax, 1);
        const y = pad.t + (1 - (w.miles || 0) / safeMax) * innerH;
        return { x, y, miles: w.miles || 0, i };
    });
    }, [weeks, slot, pad.l, pad.t, innerH, visibleMax]);

  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    const bottomY = pad.t + innerH;
    const start = points[0];
    const end = points[points.length - 1];
    return `
      M ${start.x.toFixed(1)} ${bottomY.toFixed(1)}
      L ${start.x.toFixed(1)} ${start.y.toFixed(1)}
      ${points
        .slice(1)
        .map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(" ")}
      L ${end.x.toFixed(1)} ${bottomY.toFixed(1)}
      Z
    `;
  }, [points, innerH, pad.t]);

  const selectedPoint = points[selectedIndex] || null;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !weeks.length) return;

    const computeVisible = () => {
        const scrollLeft = el.scrollLeft;
        const viewW = el.clientWidth;

        const startX = scrollLeft;           // visible left (in px of the SVG container)
        const endX = scrollLeft + viewW;     // visible right

        // Convert visible pixel window to index window
        const firstIdx = Math.max(0, Math.floor((startX - pad.l) / slot));
        const lastIdx = Math.min(
        weeks.length - 1,
        Math.ceil((endX - pad.l) / slot)
        );

        let max = 0;
        for (let i = firstIdx; i <= lastIdx; i++) {
        max = Math.max(max, weeks[i]?.miles || 0);
        }

        // nice rounding: at least 4, round up to nearest 1
        // const next = Math.max(4, Math.ceil(max) || 4);
        const next = Math.max(4, Math.ceil(max), 1);
        setVisibleMax(next);
    };

    computeVisible();

    el.addEventListener("scroll", computeVisible, { passive: true });
    window.addEventListener("resize", computeVisible);

    return () => {
        el.removeEventListener("scroll", computeVisible);
        window.removeEventListener("resize", computeVisible);
    };
  }, [weeks, pad.l, slot]);

    useEffect(() => {
    const el = scrollerRef.current;
        if (!el) return;

        if (selectedIndex == null) return;

        const newestX = pad.l + selectedIndex * slot;

        // show the last ~3 months by default
        const scrollTarget = newestX - visibleWeeks * slot + slot * 2;

        el.scrollTo({
            left: Math.max(0, scrollTarget),
            behavior: "smooth",
        });
    }, [selectedIndex, pad.l, slot, visibleWeeks]);

  return (
    <div className="weekly-card">
      <div className="weekly-top">
        {/* <div className="weekly-title">Weekly mileage</div> */}
      </div>

        
    <div className="weekly-chart-row">
        {/* LEFT: sticky Y axis */}
        <div className="weekly-yaxis">
            <svg
            width={axisW}
            height={H}
            viewBox={`0 0 ${axisW} ${H}`}
            className="weekly-axis-svg"
            aria-hidden="true"
            >
            {/* top label */}
            <text x="8" y={pad.t} className="weekly-axis">
                {Math.round(visibleMax)} mi
            </text>

            {/* bottom label */}
            <text
                x="12"
                y={pad.t + innerH - 2}
                className="weekly-axis"
                dominantBaseline="middle"
            >
            0 mi
            </text>

            </svg>
        </div>

        {/* RIGHT: scrolling chart */}
        <div className="weekly-chart-scroll" ref={scrollerRef}>
            <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            className="weekly-svg"
            shapeRendering="geometricPrecision"
            role="img"
            aria-label="Weekly mileage chart"
            >
            <defs>
                <linearGradient id="weeklyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(252,76,2,0.40)" />
                <stop offset="100%" stopColor="rgba(252,76,2,0.06)" />
                </linearGradient>
            </defs>

            {/* area */}
            {points.length > 0 && (
                <path
                    d={areaPath}
                    fill="url(#weeklyFill)"
                    className="weekly-area"
                />
            )}

            {/* line */}
            {points.length > 0 && (
                <path
                d={linePath}
                fill="none"
                stroke="rgb(252,76,2)"
                strokeWidth="2.5"
                className="weekly-line"
                />
            )}

            {/* selected marker */}
            {selectedPoint && (
                <line
                className="weekly-marker"
                x1="0"
                x2="0"
                y1={pad.t}
                y2={pad.t + innerH}
                transform={`translate(${selectedPoint.x},0)`}
                stroke="rgba(252,76,2,0.85)"
                strokeWidth="2"
                />
            )}

            {/* dots */}
            {points.map((p) => {
                const isSel = p.i === selectedIndex;
                return (
                <g
                    key={p.i}
                    className="weekly-dot clickable"
                    onClick={() => onSelect?.(p.i)}
                >
                    <circle
                    cx={p.x}
                    cy={p.y}
                    r={isSel ? 6 : 4}
                    className="weekly-circle weekly-dot-anim"
                    fill={isSel ? "rgb(252,76,2)" : "rgba(252,76,2,0.35)"}
                    stroke="rgb(252,76,2)"
                    strokeWidth={isSel ? 2 : 1.5}
                    />
                </g>
                );
            })}

            {/* Month labels */}
            {weeks.map((w, i) => {
                const prev = weeks[i - 1];
                const wDate = w.weekStart;
                const prevDate = prev?.weekStart;

                const isNewMonth =
                !prevDate ||
                wDate.getMonth() !== prevDate.getMonth() ||
                wDate.getFullYear() !== prevDate.getFullYear();

                if (!isNewMonth) return null;

                const x = pad.l + i * slot;
                const label = wDate
                .toLocaleString("en-US", { month: "short" })
                .toUpperCase();

                return (
                <text
                    key={`m-${i}`}
                    x={x}
                    y={H - 8}
                    textAnchor="middle"
                    className="weekly-month"
                >
                    {label}
                </text>
                );
            })}
            </svg>
        </div>
    </div>



        
    </div>
  );
}



function getEasyZone(pct) {
  if (pct < 50) {
    return {
      label: "Workout Heavy",
      className: "easy-zone-red",
    };
  }
  if (pct < 70) {
    return {
      label: "Workout Leaning",
      className: "easy-zone-yellow",
    };
  }
  if (pct <= 85) {
    return {
      label: "Balanced Aerobic",
      className: "easy-zone-green",
    };
  }
  return {
    label: "Recovery / Base",
    className: "easy-zone-blue",
  };
}



export default function Profile() {
  const [activities, setActivities] = useState([]);
  const [avatar, setAvatar] = useState(() => localStorage.getItem("profileAvatar") || "");
  const [tag, setTag] = useState(
    () => localStorage.getItem("profileTag") || "Built Different (Unfortunately)"
  );
  const fileInputRef = useRef(null);
  const [showJarHistory, setShowJarHistory] = useState(false);
  const [selectedPR, setSelectedPR] = useState(null);
  const [showTrends, setShowTrends] = useState(true);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(null);
  


  useEffect(() => {
    localStorage.setItem("profileTag", tag);
    }, [tag]);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // optional: limit size so localStorage doesn’t explode
    if (file.size > 2 * 1024 * 1024) {
        alert("Please choose an image under 2MB.");
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = reader.result; // base64 string
        setAvatar(dataUrl);
        localStorage.setItem("profileAvatar", dataUrl);
    };
    reader.readAsDataURL(file);
};

const removeAvatar = () => {
  setAvatar("");
  localStorage.removeItem("profileAvatar");
};

  useEffect(() => {
    const saved = localStorage.getItem("activities");
    if (saved) setActivities(JSON.parse(saved));
  }, []);

  // -------------------------
  // TOTAL / MONTH / YEAR
  // -------------------------
  const stats = useMemo(() => {
    let totalMiles = 0;
    let thisMonthMiles = 0;
    let thisYearMiles = 0;

    const now = new Date();

    activities.forEach((a) => {

    if (a.type && a.type !== "run") return;
      const miles = parseFloat(a.miles) || 0;
      totalMiles += miles;

      if (a.date) {
        const d = new Date(a.date);

        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
          thisMonthMiles += miles;
        }
        if (d.getFullYear() === now.getFullYear()) {
          thisYearMiles += miles;
        }
      }
    });

    return {
      totalMiles,
      thisMonthMiles,
      thisYearMiles,
    };
  }, [activities]);

  // -------------------------
  // PRs (min time at distance)
  // -------------------------
    const prs = useMemo(() => {
    let bestMile = { time: Infinity, date: null };
    let best5k = { time: Infinity, date: null };
    let best10k = { time: Infinity, date: null };

    activities.forEach((a) => {
        const miles = parseFloat(a.miles);
        const duration = parseFloat(a.duration);
        if (!miles || !duration) return;

        const date = a.date || null;

        if (miles >= 1 && duration < bestMile.time) {
        bestMile = { time: duration, date };
        }

        if (miles >= 3.1 && duration < best5k.time) {
        best5k = { time: duration, date };
        }

        if (miles >= 6.2 && duration < best10k.time) {
        best10k = { time: duration, date };
        }
    });

    // Find most recent PR date
    const dates = [bestMile.date, best5k.date, best10k.date]
        .filter(Boolean)
        .map((d) => new Date(d));

    const latestPRDate =
        dates.length > 0
        ? new Date(Math.max(...dates.map((d) => d.getTime())))
        : null;

    return {
        mile: bestMile,
        fiveK: best5k,
        tenK: best10k,
        latestPRDate,
    };
    }, [activities]);

    function daysAgo(dateObj) {
        if (!dateObj) return null;
        const diff = new Date() - dateObj;
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }


  // -------------------------
  // “5K box” value (use PR 5k)
  // -------------------------
  const fiveKDisplay = prs.fiveK;

    // -------------------------
    // EASY RUN JAR (25 easy runs per jar)
    // -------------------------
    const easyRuns = useMemo(() => {
    return activities
        .filter((a) => a.intensity === "easy")
        .filter((a) => parseFloat(a.miles) && parseFloat(a.duration))
        .map((a, idx) => {
        const dateStr = a.date || "";
        // stable key: date+miles+duration+idx (good enough for local demo)
        const key = `${dateStr}|${a.miles}|${a.duration}|${idx}`;
        return {
            key,
            date: dateStr,
            miles: parseFloat(a.miles),
            duration: parseFloat(a.duration), // minutes
            label: "Easy Run",
        };
        })
        .sort((x, y) => new Date(x.date || 0) - new Date(y.date || 0));
    }, [activities]);

    const jarGroups = useMemo(() => chunkArray(easyRuns, 25), [easyRuns]);

    const currentJarIndex = Math.max(0, jarGroups.length - 1);
    const currentJar = jarGroups[currentJarIndex] || [];
    const completedJars = jarGroups.length > 1 ? jarGroups.slice(0, -1) : [];
    const jarCount = completedJars.length;
  

    // -------------------------
    // Monthly snapshot:
    // mileage, avg easy, % easy, longest
    // -------------------------
    const monthlySnapshot = useMemo(() => {
    const map = new Map();

    activities.forEach((a) => {
        const d = parseDateSafe(a.date);
        if (!d) return;

        const key = `${d.getFullYear()}-${d.getMonth()}`;

        if (!map.has(key)) {
        map.set(key, {
            label:
            d.toLocaleString("en-US", { month: "short" }) +
            " " +
            d.getFullYear(),
            mileage: 0,
            longest: 0,
            easyMiles: 0,
            totalMiles: 0,
            easyPaceSum: 0,
            easyPaceCount: 0,
            sortKey: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
        });
        }

        const m = map.get(key);

        const miles = Number(a.miles) || 0;
        const duration = parseDurationMinutes(a.duration);

        m.mileage += miles;
        m.totalMiles += miles;

        if (miles > m.longest) m.longest = miles;

        if (a.intensity === "easy" && miles > 0 && duration > 0) {
        m.easyMiles += miles;
        m.easyPaceSum += duration / miles;
        m.easyPaceCount += 1;
        }
    });

    const arr = Array.from(map.values())
        .sort((a, b) => b.sortKey - a.sortKey)
        // .slice(0, 12);

    return arr.map((m, index) => {
        const avgEasy = m.easyPaceCount
        ? formatTime(m.easyPaceSum / m.easyPaceCount)
        : "-";

        const pctEasy = m.totalMiles
        ? Math.round((m.easyMiles / m.totalMiles) * 100)
        : 0;

        const prev = arr[index + 1];

        let mileageDelta = null;
        let easyDelta = null;

        if (prev) {
        mileageDelta = m.mileage - prev.mileage;

        const prevPct = prev.totalMiles
            ? Math.round((prev.easyMiles / prev.totalMiles) * 100)
            : 0;

        easyDelta = pctEasy - prevPct;
        }

        return {
        month: m.label,
        mileage: m.mileage.toFixed(1),
        avgEasy,
        pctEasy,
        longest: m.longest.toFixed(1),
        mileageDelta,
        easyDelta,
        };
    });
    }, [activities]);

    
    // -------------------------
    // Weekly snapshot (Mon -> Sun) INCLUDING 0-mile weeks
    // builds all weeks from first run -> current week
    // -------------------------
    const weeklySnapshot = useMemo(() => {
        // 1) aggregate only the weeks that actually have runs
        const map = new Map();
        let earliestDate = null;

        activities.forEach((a) => {
            if (a.type && a.type !== "run") return;

            const d = parseDateSafe(a.date);
            if (!d) return;

            if (!earliestDate || d < earliestDate) earliestDate = d;

            const weekStart = startOfWeekMonday(d);
            const key = weekStart.toISOString().slice(0, 10);

            if (!map.has(key)) {
            map.set(key, {
                weekStart,
                miles: 0,
                minutes: 0,
                elevationFt: 0,
            });
            }

            const w = map.get(key);
            const miles = Number(a.miles) || 0;
            const minutes = parseDurationMinutes(a.duration);
            const elevation =
            Number(a.elevationGainFt ?? a.elevation_ft ?? a.elevationFt ?? a.elevation_gain_ft) || 0;

            w.miles += miles;
            w.minutes += minutes;
            w.elevationFt += elevation;
    });

    

    // 2) determine range (first week -> current week)
    const now = new Date();
    const endWeek = startOfWeekMonday(now);

    // If no runs yet, still return a single current week with 0s
    const startWeek = earliestDate ? startOfWeekMonday(earliestDate) : endWeek;

    // 3) generate EVERY week in the range (including zeros)
    const totalWeeks = weeksBetween(startWeek, endWeek);

    const out = [];
    for (let i = 0; i <= totalWeeks; i++) {
        const ws = addDays(startWeek, i * 7);
        const key = ws.toISOString().slice(0, 10);

        const found = map.get(key);

        out.push({
        label: formatWeekRange(ws),
        weekStart: ws,
        miles: found ? Number(found.miles.toFixed(1)) : 0,
        minutes: found ? Math.round(found.minutes) : 0,
        elevationFt: found ? Math.round(found.elevationFt) : 0,
        });
    }

    return out; // ascending by time
    }, [activities]);



    const selectedWeek =
    selectedWeekIndex != null ? weeklySnapshot[selectedWeekIndex] : null;

    const isThisWeek = useMemo(() => {
        if (!selectedWeek?.weekStart) return false;

        const now = new Date();
        const thisWeekStart = startOfWeekMonday(now);

        return (
            selectedWeek.weekStart.toISOString().slice(0, 10) ===
            thisWeekStart.toISOString().slice(0, 10)
        );
    }, [selectedWeek]);

    useEffect(() => {
        if (!weeklySnapshot.length) {
            setSelectedWeekIndex(null);
            return;
        }

        setSelectedWeekIndex(weeklySnapshot.length - 1);
    }, [weeklySnapshot]);


  return (
    <div className="profile-page">

      {/* TOP AREA (matches sketch) */}
      <div className="profile-top">

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
            <h1 className="profile-name">Your Name</h1>
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
            </div>   {/* profile-top */}

      {/* MIDDLE AREA: graph left + PR panel right */}
      <div className="profile-mid">

        {/* EASY JAR */}
        <div className="profile-panel">
        <EasyJar
            title="Easy Run Jar"
            subtitle={`${currentJar.length}/25 balls`}
            runs={currentJar}
        />

        {currentJar.length === 25 && (
            <div className="jar-complete">
            Jar complete! You’re officially annoying (in a good way). 🏆
            </div>
        )}
        </div>

        {/* PRs panel (matches sketch box) */}
        <div className="profile-panel pr-panel">
          <div className="panel-title">🎖️ PRs</div>
          {selectedPR && selectedPR.date && (
            <div className="pr-selected-date">
                {selectedPR.label} PR: {formatDate(selectedPR.date)}
            </div>
            )}

          <div className="pr-table">
            <div className="pr-row">
              <div className="pr-cell label">Mile</div>
                <div
                className="pr-cell value clickable"
                onClick={() => {
                    if (selectedPR?.label === "Mile") {
                        setSelectedPR(null);
                    } else {
                        setSelectedPR({
                        label: "Mile",
                        date: prs.mile.date,
                        });
                    }
                }}
                >
                {formatTime(prs.mile.time)}
                </div>
            </div>
            <div className="pr-row">
              <div className="pr-cell label">5K</div>
                <div
                className="pr-cell value clickable"
                onClick={() => {
                    if (selectedPR?.label === "5K") {
                        setSelectedPR(null);
                    } else {
                        setSelectedPR({
                        label: "5K",
                        date: prs.fiveK.date,
                        });
                    }
                }}
                >
                {formatTime(prs.fiveK.time)}
                </div>
            </div>
            <div className="pr-row">
              <div className="pr-cell label">10K</div>
                <div
                className="pr-cell value clickable"
                    onClick={() => {
                        if (selectedPR?.label === "10K") {
                        setSelectedPR(null);
                    } else {
                        setSelectedPR({
                        label: "10K",
                        date: prs.tenK.date,
                        });
                    }
                }}
                >
                {formatTime(prs.tenK.time)}
                </div>
            </div>
          </div>

          {prs.latestPRDate && (
            <div className="pr-latest">
                Last PR: {daysAgo(prs.latestPRDate)} days ago
            </div>
            )}

        </div>

      </div>

    {/* MONTHLY SNAPSHOT */}
        <div className="profile-section">

            <h2
                className="section-title clickable"
                onClick={() => setShowTrends((prev) => !prev)}
            >
                Monthly snapshot
            </h2>

            <div className="month-snap-row">
            {monthlySnapshot.map((m, i) => {
                const zone = getEasyZone(m.pctEasy);

                return (
                    <div key={i} className="month-card">
                    <div className="month-title">{m.month}</div>

                    {/* HERO METRIC */}
                    <div className="month-hero">
                    {m.mileage} mi

                    {showTrends && m.mileageDelta !== null && (
                    <div
                        className={`trend ${
                        m.mileageDelta > 0
                            ? "trend-up"
                            : m.mileageDelta < 0
                            ? "trend-down"
                            : "trend-neutral"
                        }`}
                    >
                        {m.mileageDelta > 0 && "▲ "}
                        {m.mileageDelta < 0 && "▼ "}
                        {m.mileageDelta !== 0 && `${Math.abs(m.mileageDelta).toFixed(1)} mi`}
                        {m.mileageDelta === 0 && "No change"}
                    </div>
                    )}
                    </div>

                    {/* Easy % with color meaning */}
                    <div className={`easy-pill ${zone.className}`}>
                        <span className="easy-percent">{m.pctEasy}% Easy</span>
                        <span className="easy-label">{zone.label}</span>
                    </div>

                        {/* {showTrends && m.easyDelta !== null && (
                        <div
                            className={`trend-small ${
                            m.easyDelta > 0
                                ? "trend-up"
                                : m.easyDelta < 0
                                ? "trend-down"
                                : "trend-neutral"
                            }`}
                        >
                            {m.easyDelta > 0 && "▲ "}
                            {m.easyDelta < 0 && "▼ "}
                            {m.easyDelta !== 0 && `${Math.abs(m.easyDelta)}% vs last month`}
                        </div>
                        )} */}

                    <div className="month-secondary">
                        <div className="metric-row">
                        <span>Avg Easy Pace</span>
                        <span>{m.avgEasy}</span>
                        </div>

                        <div className="metric-row">
                        <span>Longest Run</span>
                        <span>{m.longest} mi</span>
                        </div>
                    </div>
                    </div>
                );
                })}
            </div>
        </div>

        <br></br>

        {/* WEEKLY MILEAGE */}
        <div className="profile-section">
        <div className="weekly-header">
            <div className="weekly-header-title">
            {isThisWeek ? "This week" : selectedWeek?.label || "Weekly"}
            </div>

            <div className="weekly-stats-row">
            <div className="weekly-stat">
                <div className="weekly-stat-label">Distance</div>
                <div className="weekly-stat-value">{selectedWeek ? `${selectedWeek.miles} mi` : "-"}</div>
            </div>

            <div className="weekly-stat">
                <div className="weekly-stat-label">Time</div>
                <div className="weekly-stat-value">
                {selectedWeek ? formatHoursMinsFromMinutes(selectedWeek.minutes) : "-"}
                </div>
            </div>

            <div className="weekly-stat">
                <div className="weekly-stat-label">Elevation Gain</div>
                <div className="weekly-stat-value">
                {selectedWeek ? `${selectedWeek.elevationFt} ft` : "0 ft"}
                </div>
            </div>
            </div>
        </div>

        <WeeklyMileage
            weeks={weeklySnapshot}
            selectedIndex={selectedWeekIndex}
            onSelect={(idx) => setSelectedWeekIndex(idx)}
        />
        </div>



    {showJarHistory && (
    <div className="jar-modal-backdrop" onClick={() => setShowJarHistory(false)}>
        <div className="jar-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jar-modal-head">
            <div className="jar-modal-title">Past Jars</div>
            <button className="jar-close" onClick={() => setShowJarHistory(false)}>
            ✕
            </button>
        </div>

        {completedJars.length === 0 ? (
            <div className="jar-modal-empty">
            No completed jars yet. Fill your first one 😈
            </div>
        ) : (
            <div className="jar-grid">
            {completedJars
                .slice()
                .reverse()
                .map((jar, idx) => (
                <div key={idx} className="jar-thumb">
                    <EasyJar
                    title={`Jar #${completedJars.length - idx}`}
                    subtitle="25/25"
                    runs={jar}
                    />
                </div>
                ))}
            </div>
        )}
        </div>
    </div>
    )}

    </div>
  );
}

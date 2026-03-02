import React, { useEffect, useState, useMemo, useRef } from "react";


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

      <div className="jar-wrap" aria-label="Easy Jar">
        <svg viewBox={`0 0 ${W} ${H}`} className="jar-svg" role="img">
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




export default function Profile() {
  const [activities, setActivities] = useState([]);
  const [avatar, setAvatar] = useState(() => localStorage.getItem("profileAvatar") || "");
  const [tag, setTag] = useState(
    () => localStorage.getItem("profileTag") || "Built Different (Unfortunately)"
  );
  const fileInputRef = useRef(null);
  const [showJarHistory, setShowJarHistory] = useState(false);


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
    let bestMile = Infinity;
    let best5k = Infinity;
    let best10k = Infinity;

    activities.forEach((a) => {
      const miles = parseFloat(a.miles);
      const duration = parseFloat(a.duration);
      if (!miles || !duration) return;

      // if they ran at least the distance, treat the whole run as a "PR attempt" (simple version)
      if (miles >= 1 && duration < bestMile) bestMile = duration;
      if (miles >= 3.1 && duration < best5k) best5k = duration;
      if (miles >= 6.2 && duration < best10k) best10k = duration;
    });

    return {
      mile: formatTime(bestMile),
      fiveK: formatTime(best5k),
      tenK: formatTime(best10k),
    };
  }, [activities]);

  // -------------------------
  // “5K box” value (use PR 5k)
  // -------------------------
  const fiveKDisplay = prs.fiveK;

    // -------------------------
    // EASY JAR (25 easy runs per jar)
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
  

  // -------------------------
  // Monthly snapshot:
  // mileage, avg easy, % easy, longest
  // -------------------------
  const monthlySnapshot = useMemo(() => {
    const map = new Map();

    activities.forEach((a) => {
      if (!a.date) return;
      const d = new Date(a.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;

      if (!map.has(key)) {
        map.set(key, {
          label: d.toLocaleString("default", { month: "short" }),
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
      const miles = parseFloat(a.miles) || 0;
      const duration = parseFloat(a.duration) || 0;

      m.mileage += miles;
      m.totalMiles += miles;
      if (miles > m.longest) m.longest = miles;

      if (a.intensity === "easy" && miles > 0 && duration > 0) {
        m.easyMiles += miles;
        m.easyPaceSum += duration / miles; // min/mi
        m.easyPaceCount += 1;
      }
    });

    const arr = Array.from(map.values())
      .sort((a, b) => b.sortKey - a.sortKey)
      .slice(0, 4); // show latest 4

    return arr.map((m) => {
      const avgEasy = m.easyPaceCount ? formatTime(m.easyPaceSum / m.easyPaceCount) : "-";
      const pctEasy = m.totalMiles ? Math.round((m.easyMiles / m.totalMiles) * 100) : 0;

      return {
        month: m.label,
        mileage: m.mileage.toFixed(1),
        avgEasy,
        pctEasy,
        longest: m.longest.toFixed(1),
      };
    });
  }, [activities]);

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
        </div>


        </div>

        {/* RIGHT COLUMN */}
        <div className="profile-top-right">

          {/* flag + name */}
          <div className="profile-name-row">
            <span className="profile-flag">🇺🇸</span>
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
            title="Easy Jar"
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
          <div className="panel-title">PRs</div>

          <div className="pr-table">
            <div className="pr-row">
              <div className="pr-cell label">Mile</div>
              <div className="pr-cell value">{prs.mile}</div>
            </div>
            <div className="pr-row">
              <div className="pr-cell label">5K</div>
              <div className="pr-cell value">{prs.fiveK}</div>
            </div>
            <div className="pr-row">
              <div className="pr-cell label">10K</div>
              <div className="pr-cell value">{prs.tenK}</div>
            </div>
          </div>
        </div>

      </div>

      {/* MONTHLY SNAPSHOT */}
      <div className="profile-section">
        <h2 className="section-title">Monthly snapshot</h2>

        <div className="month-snap-row">
          {monthlySnapshot.map((m, i) => (
            <div key={i} className="month-card">
              <div className="month-title">{m.month}</div>

              <div className="month-metric">
                <div className="metric-label">Total Mileage</div>
                <div className="metric-value">{m.mileage} mi</div>
              </div>

              <div className="month-metric">
                <div className="metric-label">Avg Easy</div>
                <div className="metric-value">{m.avgEasy}</div>
              </div>

              <div className="month-metric">
                <div className="metric-label">% Easy</div>
                <div className="metric-value">{m.pctEasy}%</div>
              </div>

              <div className="month-metric">
                <div className="metric-label">Longest Run</div>
                <div className="metric-value">{m.longest} mi</div>
              </div>
            </div>
          ))}
        </div>
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

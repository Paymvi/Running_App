import React, { useEffect, useState, useMemo } from "react";


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

export default function Profile() {
  const [activities, setActivities] = useState([]);
  const [avatar, setAvatar] = useState(() => localStorage.getItem("profileAvatar") || "");
  const [tag, setTag] = useState(
    () => localStorage.getItem("profileTag") || "Built Different (Unfortunately)"
  );
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
  // Easy pace “graph”
  // (simple: last 6 easy runs pace)
  // -------------------------
  const easyPaces = useMemo(() => {
    const easyRuns = activities
      .filter((a) => a.intensity === "easy")
      .filter((a) => parseFloat(a.miles) && parseFloat(a.duration))
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    const last = easyRuns.slice(-6);

    return last.map((a) => {
      const miles = parseFloat(a.miles);
      const duration = parseFloat(a.duration);
      const pace = duration / miles; // min/mi
      return pace;
    });
  }, [activities]);

  // convert pace array -> SVG points
  const pacePath = useMemo(() => {
    if (easyPaces.length < 2) return "";

    const W = 520;
    const H = 160;
    const pad = 18;

    const minP = Math.min(...easyPaces);
    const maxP = Math.max(...easyPaces);

    const scaleX = (i) =>
      pad + (i * (W - pad * 2)) / (easyPaces.length - 1);

    const scaleY = (p) => {
      if (maxP === minP) return H / 2;
      // lower pace = faster = higher line (invert)
      const t = (p - minP) / (maxP - minP);
      return pad + t * (H - pad * 2);
    };

    return easyPaces
      .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(i)} ${scaleY(p)}`)
      .join(" ");
  }, [easyPaces]);

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

        <div className="profile-avatar-lg">
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
            id="avatarUpload"
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="avatar-file"
            />
        </div>

        <div className="avatar-actions">
            <label htmlFor="avatarUpload" className="avatar-btn">
            {avatar ? "Change" : "Upload"}
            </label>

            {avatar && (
            <button
                className="avatar-btn subtle"
                onClick={removeAvatar}
            >
                Remove
            </button>
            )}
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

        {/* easy pace graph */}
        <div className="profile-panel">
          <div className="panel-title">Easy Pace graph</div>

          <div className="pace-graph">
            <svg viewBox="0 0 520 180" className="pace-svg" aria-label="Easy pace graph">
              {/* axes */}
              <line x1="30" y1="20" x2="30" y2="160" className="axis" />
              <line x1="30" y1="160" x2="500" y2="160" className="axis" />

              {/* line */}
              {pacePath ? (
                <path d={pacePath} className="pace-line" />
              ) : (
                <text x="40" y="90" className="pace-empty">
                  Add a couple EASY runs to see the graph
                </text>
              )}
            </svg>
          </div>
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

    </div>
  );
}

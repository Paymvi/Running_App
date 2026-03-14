import React, { useEffect, useState, useMemo, useRef } from "react";
import LargeHeatmap from "../components/LargeHeatmap";
import EasyJar from "../components/profile/EasyJar";
import WeeklyMileage from "../components/profile/WeeklyMileage";
import ProfileTopSection from "../components/profile/ProfileTopSection";
import PRPanel from "../components/profile/PRPanel";
import MonthlySnapshot from "../components/profile/MonthlySnapshot";
import PastJarsModal from "../components/profile/PastJarsModal";
import EditProfileModal from "../components/profile/EditProfileModal";
import TAG_OPTIONS from "../utils/tags";

import {
  formatTime,
  formatDate,
  parseDateSafe,
  parseDurationMinutes,
  startOfWeekSunday,
  addDays,
  weeksBetween,
  formatWeekRange,
  formatHoursMinsFromMinutes,
  chunkArray,
  getEasyZone,
  daysAgo,
} from "../utils/profileHelpers";



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



export default function Profile() {
  const [activities, setActivities] = useState([]);
  const [avatar, setAvatar] = useState(() => localStorage.getItem("profileAvatar") || "");
  const [tag, setTag] = useState(
    () => localStorage.getItem("profileTag") || "Built Different (Unfortunately)"
  );
  const [profileName, setProfileName] = useState(
    () => localStorage.getItem("profileName") || "Your Name"
  );
  const fileInputRef = useRef(null);
  const [showJarHistory, setShowJarHistory] = useState(false);
  const [selectedPR, setSelectedPR] = useState(null);
  const [showTrends, setShowTrends] = useState(true);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [weeklyScaleMode, setWeeklyScaleMode] = useState(
  () => localStorage.getItem("weeklyScaleMode") || "dynamic"
);


  useEffect(() => {
    localStorage.setItem("profileTag", tag);
  }, [tag]);

  useEffect(() => {
      localStorage.setItem("profileName", profileName);
  }, [profileName]);

  useEffect(() => {
    localStorage.setItem("weeklyScaleMode", weeklyScaleMode);
  }, [weeklyScaleMode]);

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
            if (a.type && a.type !== "run") return;

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




  // -------------------------
  // “5K box” value (use PR 5k)
  // -------------------------
  const fiveKDisplay = prs.fiveK;

    // -------------------------
    // EASY RUN JAR (25 easy runs per jar)
    // -------------------------
    const easyRuns = useMemo(() => {
        return activities
            .filter((a) => !a.type || a.type === "run")
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
        if (a.type && a.type !== "run") return;

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

            const weekStart = startOfWeekSunday(d);
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
    const endWeek = startOfWeekSunday(now);

    // If no runs yet, still return a single current week with 0s
    const startWeek = earliestDate ? startOfWeekSunday(earliestDate) : endWeek;

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
        const thisWeekStart = startOfWeekSunday(now);

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

    const displayName = profileName.trim() || "Your Name";




    return (
      <div className="profile-page">

        <ProfileTopSection
          avatar={avatar}
          fileInputRef={fileInputRef}
          handleAvatarChange={handleAvatarChange}
          jarCount={jarCount}
          setShowJarHistory={setShowJarHistory}
          displayName={displayName}
          setShowEditProfile={setShowEditProfile}
          stats={stats}
          tag={tag}
          setTag={setTag}
          TAG_OPTIONS={TAG_OPTIONS}
        />
        

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

            <PRPanel
              prs={prs}
              selectedPR={selectedPR}
              setSelectedPR={setSelectedPR}
            />

        </div>

            <MonthlySnapshot
              monthlySnapshot={monthlySnapshot}
              showTrends={showTrends}
              setShowTrends={setShowTrends}
            />

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
                </div>
            </div>

            <WeeklyMileage
              weeks={weeklySnapshot}
              selectedIndex={selectedWeekIndex}
              onSelect={(idx) => setSelectedWeekIndex(idx)}
              scaleMode={weeklyScaleMode}
            />
            </div>

        {showJarHistory && (
          <PastJarsModal
            showJarHistory={showJarHistory}
            setShowJarHistory={setShowJarHistory}
            completedJars={completedJars}
          />
        )}
        
        
        {showEditProfile && (
          <EditProfileModal
              showEditProfile={showEditProfile}
              setShowEditProfile={setShowEditProfile}
              profileName={profileName}
              setProfileName={setProfileName}
              weeklyScaleMode={weeklyScaleMode}
              setWeeklyScaleMode={setWeeklyScaleMode}
            />
        )}

        <LargeHeatmap activities={activities}/>

        </div>
    );
}

// Make sure to make it "export function" so that react can import them


export function formatTime(min) {
  if (!isFinite(min)) return "-";
  const m = Math.floor(min);
  const s = Math.round((min - m) * 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDate(dateStr) {
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
export function parseDateSafe(dateStr) {
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
export function parseDurationMinutes(val) {
  if (val == null) return 0;

  if (typeof val === "number") return val;

  const s = String(val).trim();

  // mm:ss or hh:mm:ss
  if (s.includes(":")) {
    const parts = s.split(":").map((p) => Number(p.trim()));

    if (parts.length === 2) {
      const [m, sec] = parts;
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
export function startOfWeekMonday(dateObj) {
  const d = new Date(dateObj);
  d.setHours(0, 0, 0, 0);

  // JS: Sun=0, Mon=1, ... Sat=6
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // move back to Monday
  d.setDate(d.getDate() + diff);
  return d;
}

export function addDays(dateObj, days) {
  const d = new Date(dateObj);
  d.setDate(d.getDate() + days);
  return d;
}

export function weeksBetween(startWeek, endWeek) {
  const ms = endWeek.getTime() - startWeek.getTime();
  return Math.round(ms / (7 * 24 * 60 * 60 * 1000));
}

export function formatWeekRange(startDateObj) {
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

export function formatHoursMinsFromMinutes(totalMinutes) {
  if (!isFinite(totalMinutes)) return "-";
  const mins = Math.round(totalMinutes);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}


export function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}



export function getEasyZone(pct) {
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


export function daysAgo(dateObj) {
    if (!dateObj) return null;
    const diff = new Date() - dateObj;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

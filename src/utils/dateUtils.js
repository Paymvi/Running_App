// Calendar dates are stored as "YYYY-MM-DD" strings and always parsed as LOCAL dates.
// Legacy/imported "M/D/YYYY" is still accepted (that is what Velo's own exports write).

const pad2 = (n) => String(n).padStart(2, "0");

// Years outside this range are treated as typos (they would also make history views enormous).
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

function buildDate(y, m, d) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < MIN_YEAR || y > MAX_YEAR) return null;
  const date = new Date(y, m - 1, d);
  // Reject impossible dates such as Feb 31 instead of letting Date roll them forward.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

export function parseLocalYMD(input) {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input) ? null : input;

  const value = String(input).trim();

  // YYYY-MM-DD, optionally followed by a time part ("T..." or " ...")
  let m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  if (m) return buildDate(Number(m[1]), Number(m[2]), Number(m[3]));

  // M/D/YYYY
  m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return buildDate(Number(m[3]), Number(m[1]), Number(m[2]));

  return null;
}

export const toYMD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Canonical "YYYY-MM-DD" for any accepted input, or null.
export function normalizeYMD(input) {
  const d = parseLocalYMD(input);
  return d ? toYMD(d) : null;
}

export const todayYMD = () => toYMD(new Date());

export const formatDateMDY = (input) => {
  if (!input) return "";
  const d = parseLocalYMD(input);
  // Unparseable legacy values are exported unchanged rather than mangled.
  if (!d) return String(input);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
};

// "Mar 5, 2026"
export function formatDisplayDate(input) {
  const d = parseLocalYMD(input);
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Whole calendar days from a to b (DST-safe).
export function calendarDaysBetween(a, b) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

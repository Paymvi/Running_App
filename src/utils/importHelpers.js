// Spreadsheet exchange (CSV / Excel). This is a portable activity table, not a full
// backup: photos, notes cards and settings are only in the JSON backup (see storage.js).
// The parsers are loaded on demand so they are not part of the initial page load.
// Distances are always in miles here, whatever the display-unit preference is.

import { formatDateMDY, normalizeYMD, todayYMD } from "./dateUtils.js";
import { TYPES, INTENSITIES, FEELS, STATUSES, parseDistance, parseDuration, computeSplitTotals } from "./activityModel.js";

export const EXPORT_COLUMNS = [
  "id", "title", "description", "type", "intensity", "feel", "limiter", "tags",
  "date", "time", "status", "miles", "duration", "mode", "splits", "elevationGainFt",
  "movingMinutes", "elapsedMinutes", "source", "sourceId", "notes",
];
const KNOWN_COLUMNS = new Set(EXPORT_COLUMNS);
const TEXT_COLUMNS = new Set(["title", "description", "limiter", "tags", "notes"]);
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

// Spreadsheet apps treat text starting with = + - @ tab or CR as a formula; a leading '
// keeps it text. Text that already starts with apostrophes before such a character gets
// one more, so import (which strips exactly one) gives back the original text:
// unescapeFormula(escapeFormula(s)) === s for every s.
const NEEDS_ESCAPE = /^'*[=+\-@\t\r]/;
export const escapeFormula = (s) => (NEEDS_ESCAPE.test(s) ? `'${s}` : s);
export const unescapeFormula = (s) => (s.startsWith("'") && NEEDS_ESCAPE.test(s.slice(1)) ? s.slice(1) : s);

const cell = (v) => (v == null ? "" : String(v));

// "6@1|6.5@0.5" = 1 mi at 6 mph, then 0.5 mi at 6.5 mph.
export const formatSplitsCell = (splits) =>
  (Array.isArray(splits) ? splits : [])
    .filter((s) => s && (s.mph !== "" || s.distance !== ""))
    .map((s) => `${s.mph}@${s.distance}`)
    .join("|");

function parseSplitsCell(text) {
  if (!text.trim()) return [];
  const splits = text.split("|").map((part) => {
    const [mph, distance] = part.split("@").map((x) => (x || "").trim());
    return { mph, distance };
  });
  return computeSplitTotals(splits).invalidRows.length ? null : splits.map((s) => ({ mph: Number(s.mph), distance: Number(s.distance) }));
}

// Converts parsed rows into activities. Returns { accepted, rejected: [{ row, errors }], idlessIds }.
// Row numbers are spreadsheet rows (header = row 1). Text is kept verbatim.
// Blank intensity imports as "unknown" (never assumed easy). Blank status means completed,
// except rows dated after today, which are flagged for review instead of guessed.
// `csv`: strip the formula-guard apostrophe that activitiesToCSV adds. Excel cells are
// written as plain text (no guard), so their text is taken exactly as stored.
export function rowsToActivities(rows, { today = todayYMD(), csv = false } = {}) {
  const accepted = [];
  const rejected = [];
  const idlessIds = new Set();

  rows.forEach((row, i) => {
    const r = {};
    for (const [k, v] of Object.entries(row)) {
      const key = String(k).trim();
      if (!KNOWN_COLUMNS.has(key)) continue;
      r[key] = TEXT_COLUMNS.has(key) ? (csv ? unescapeFormula(cell(v)) : cell(v)) : cell(v).trim();
    }

    const errors = [];
    const type = (r.type || "run").toLowerCase();
    const intensity = (r.intensity || "unknown").toLowerCase();
    const feel = (r.feel || "medium").toLowerCase();
    if (!TYPES.includes(type)) errors.push(`unknown type "${r.type}"`);
    if (!INTENSITIES.includes(intensity)) errors.push(`unknown intensity "${r.intensity}"`);
    if (!FEELS.includes(feel)) errors.push(`unknown feel "${r.feel}"`);

    const date = normalizeYMD(r.date);
    if (!date) errors.push(r.date ? `invalid date "${r.date}"` : "missing date");

    const status = (r.status || "").toLowerCase();
    if (status && !STATUSES.includes(status)) errors.push(`unknown status "${r.status}"`);
    if (status === "completed" && date && date > today) errors.push("completed activity dated in the future");

    let time = r.time || "";
    if (/^\d:\d\d$/.test(time)) time = `0${time}`;
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) errors.push(`invalid time "${r.time}"`);

    let miles = r.miles ? parseDistance(r.miles) : null;
    let duration = r.duration ? parseDuration(r.duration) : null;
    if (r.miles && miles === null) errors.push(`invalid miles "${r.miles}"`);
    if (r.duration && duration === null) errors.push(`invalid duration "${r.duration}"`);

    const splits = parseSplitsCell(r.splits || "");
    if (splits === null) errors.push(`invalid splits "${r.splits}"`);
    const mode = r.mode === "splits" && splits?.length ? "splits" : "timeMiles";
    if (mode === "splits") {
      const totals = computeSplitTotals(splits);
      miles ??= totals.miles;
      duration ??= totals.minutes;
    }

    // Strength sessions may have neither; everything else needs one of them.
    if (!errors.length && type !== "strength" && !(miles > 0) && !(duration > 0)) errors.push("needs a distance or a duration");

    let elevationGainFt;
    if (r.elevationGainFt) {
      elevationGainFt = parseDistance(r.elevationGainFt);
      if (elevationGainFt === null) errors.push(`invalid elevationGainFt "${r.elevationGainFt}"`);
    }

    const extra = {};
    for (const k of ["movingMinutes", "elapsedMinutes"]) {
      if (!r[k]) continue;
      extra[k] = parseDuration(r[k]);
      if (extra[k] === null) errors.push(`invalid ${k} "${r[k]}"`);
    }

    if (errors.length) {
      rejected.push({ row: i + 2, errors });
      return;
    }

    const id = r.id || crypto.randomUUID();
    if (!r.id) idlessIds.add(id);
    accepted.push({
      id,
      title: r.title || "",
      description: r.description || "",
      type,
      intensity,
      feel,
      limiter: r.limiter || "",
      tags: (r.tags || "").split("|").map((t) => t.trim()).filter(Boolean),
      date,
      time,
      ...(status ? { status } : date > today && { needsReview: ["status"] }),
      mode,
      miles: miles ?? "",
      duration: duration ?? "",
      splits: splits || [],
      ...(elevationGainFt != null && { elevationGainFt }),
      ...extra,
      ...(r.source && r.sourceId && { source: r.source, sourceId: r.sourceId }),
      notes: r.notes || "",
    });
  });

  return { accepted, rejected, idlessIds };
}

function headerWarnings(fields) {
  const warnings = [];
  const unknown = fields.filter((f) => !KNOWN_COLUMNS.has(String(f).trim()));
  if (unknown.length) warnings.push(`Ignored unknown columns: ${unknown.join(", ")}.`);
  return warnings;
}

function checkFile(file) {
  if (file.size > MAX_IMPORT_BYTES) throw new Error("File is larger than 5 MB.");
}

// Resolves to { accepted, rejected, idlessIds, warnings }; rejects with a readable Error.
export async function parseCSVFile(file) {
  checkFile(file);
  const { default: Papa } = await import("papaparse");
  const results = await new Promise((resolve, reject) =>
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: resolve, error: reject })
  );
  return csvResultsToActivities(results);
}

export function csvResultsToActivities(results) {
  const fields = (results.meta?.fields || []).map((f) => String(f).trim());
  if (!fields.includes("date")) throw new Error('The file needs a "date" column (see README for the format).');
  const { accepted, rejected, idlessIds } = rowsToActivities(results.data, { csv: true });
  for (const err of results.errors || []) {
    if (err.row != null) rejected.push({ row: err.row + 2, errors: [err.message] });
  }
  return { accepted, rejected, idlessIds, warnings: headerWarnings(fields) };
}

// Workbook bytes -> rows of the "Activities" sheet (or the first sheet). Exported for tests.
export function workbookToRows(XLSX, data) {
  const workbook = XLSX.read(data, { type: "array" });
  // Prefer the sheet Velo exports; otherwise the first one.
  const sheetName = workbook.SheetNames.includes("Activities") ? "Activities" : workbook.SheetNames[0];
  if (!sheetName) throw new Error("The workbook has no sheets.");
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

  const fields = rows.length ? Object.keys(rows[0]).map((f) => String(f).trim()) : [];
  if (!fields.includes("date")) throw new Error(`Sheet "${sheetName}" needs a "date" column (see README for the format).`);

  for (const row of rows) {
    // Excel date cells arrive as serial numbers.
    if (typeof row.date === "number") {
      const d = XLSX.SSF.parse_date_code(row.date);
      row.date = d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : String(row.date);
    }
  }
  const others = workbook.SheetNames.filter((n) => n !== sheetName);
  return { rows, fields, sheetName, others };
}

export async function parseExcelFile(file) {
  checkFile(file);
  const XLSX = await import("xlsx");
  const { rows, fields, sheetName, others } = workbookToRows(XLSX, await file.arrayBuffer());
  const { accepted, rejected, idlessIds } = rowsToActivities(rows);
  const warnings = headerWarnings(fields);
  if (others.length) warnings.push(`Read sheet "${sheetName}" only; ignored: ${others.join(", ")}.`);
  return { accepted, rejected, idlessIds, warnings };
}

export function buildExportRows(activities) {
  return activities.map((a) => ({
    id: a.id || "",
    title: a.title || "",
    description: a.description || "",
    type: a.type || "",
    intensity: a.intensity || "",
    feel: a.feel || "",
    limiter: a.limiter || "",
    tags: (a.tags || []).join("|"),
    date: formatDateMDY(a.date),
    time: a.time || "",
    // Unconfirmed records export blank so a re-import flags them again instead of guessing.
    status: a.needsReview?.includes("status") ? "" : a.status || "completed",
    miles: a.miles ?? "",
    duration: a.duration ?? "",
    mode: a.mode || "timeMiles",
    splits: a.mode === "splits" ? formatSplitsCell(a.splits) : "",
    elevationGainFt: a.elevationGainFt ?? "",
    movingMinutes: a.movingMinutes ?? "",
    elapsedMinutes: a.elapsedMinutes ?? "",
    source: a.source || "",
    sourceId: a.sourceId || "",
    notes: a.notes || "",
  }));
}

export function activitiesToCSV(activities) {
  const rows = buildExportRows(activities).map((row) =>
    EXPORT_COLUMNS.map((col) => {
      const value = TEXT_COLUMNS.has(col) ? escapeFormula(cell(row[col])) : cell(row[col]);
      return `"${value.replace(/"/g, '""')}"`;
    }).join(",")
  );
  return [EXPORT_COLUMNS.join(","), ...rows].join("\n");
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function handleExportCSV(activities) {
  download(new Blob([activitiesToCSV(activities)], { type: "text/csv;charset=utf-8;" }), "my_running_data.csv");
}

// Workbook bytes (xlsx). Cells are written as plain strings/numbers, never formulas.
export function activitiesToWorkbook(XLSX, activities) {
  const worksheet = XLSX.utils.json_to_sheet(buildExportRows(activities), { header: EXPORT_COLUMNS });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Activities");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

export async function handleExportExcel(activities) {
  const XLSX = await import("xlsx");
  download(
    new Blob([activitiesToWorkbook(XLSX, activities)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "my_running_data.xlsx"
  );
}

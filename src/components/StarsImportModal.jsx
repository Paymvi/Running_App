import React, { useRef, useState } from "react";
import useDialog from "../hooks/useDialog";
import { mergeImported } from "../utils/activityStore";
import { editMaskedDuration, formatDuration, maskDuration } from "../utils/activityModel";
import { formatDisplayDate, todayYMD } from "../utils/dateUtils";
import { initialRunEntry, resolveRunEntry, starsRowToActivity } from "../utils/starsImport";
import { distLabel, formatDistance, speedLabel } from "../utils/units";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const round = (n, dp) => String(Math.round(n * 10 ** dp) / 10 ** dp);

// Preview of a Stars backup. `rows` come from classifyStarsRows. Nothing is saved until
// "Import"; closing (Cancel, ✕, Escape, backdrop) discards the preview and every edit.
export default function StarsImportModal({ rows, unit, onClose }) {
  const dialogRef = useDialog(true, onClose);
  const [today] = useState(todayYMD);
  const [selected, setSelected] = useState(() => new Set(rows.filter((r) => r.status === "new").map((r) => r.key)));
  // Kept per row whether or not it is selected, so unticking never loses edits.
  const [entries, setEntries] = useState(() =>
    Object.fromEntries(rows.filter((r) => r.kind === "run").map((r) => [r.key, initialRunEntry(r, unit)]))
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [result, setResult] = useState(null);
  const savingRef = useRef(false);

  const selectable = rows.filter((r) => r.status === "new" || r.status === "duplicate");
  const checks = Object.fromEntries(
    rows.filter((r) => selected.has(r.key)).map((r) => [r.key, starsRowToActivity(r, entries[r.key], { unit, today })])
  );
  const count = selected.size;
  const blocked = Object.values(checks).filter((c) => c.errors).length;
  const dupesSelected = rows.filter((r) => r.status === "duplicate" && selected.has(r.key)).length;

  const toggle = (key) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const setEntry = (key, field, value) => setEntries((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const handleImport = () => {
    if (savingRef.current || !count || blocked) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    const activities = Object.values(checks).map((c) => c.activity);
    const res = mergeImported(activities); // one atomic write; skips Stars ids already in Velo
    if (!res.ok) {
      savingRef.current = false;
      setSaving(false);
      setSaveError(`Nothing was imported: ${res.error}`);
      return;
    }
    setResult({
      added: res.added,
      alreadyThere: res.duplicates,
      notSelected: selectable.length - count,
      unavailable: rows.length - selectable.length,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="strava-modal stars-import-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stars-import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="strava-modal-header">
          <h2 className="strava-modal-title" id="stars-import-title">Import from Stars</h2>
          <button type="button" className="strava-modal-close" onClick={onClose} aria-label="Close Stars import">
            ×
          </button>
        </div>

        {result ? (
          <div className="strava-modal-body" role="status">
            <p className="strava-modal-text">
              Imported {plural(result.added, "workout")}.
            </p>
            <ul className="stars-summary">
              {result.notSelected > 0 && <li>Skipped {result.notSelected} you didn't select.</li>}
              {result.unavailable > 0 && <li>Skipped {result.unavailable} already imported or unreadable.</li>}
              {result.alreadyThere > 0 && <li>Skipped {result.alreadyThere} that were imported meanwhile (e.g. in another tab).</li>}
              <li>Failed: 0.</li>
            </ul>
            <button type="button" className="primary-btn" onClick={onClose} data-autofocus>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="stars-toolbar">
              <span aria-live="polite">
                {count} of {selectable.length} selected
                {dupesSelected > 0 && ` (incl. ${plural(dupesSelected, "possible duplicate")})`}
              </span>
              <span className="stars-toolbar-btns">
                <button type="button" className="secondary-btn" onClick={() => setSelected(new Set(selectable.map((r) => r.key)))}>
                  Select all
                </button>
                <button type="button" className="secondary-btn" onClick={() => setSelected(new Set())}>
                  Deselect all
                </button>
              </span>
            </div>

            <ul className="stars-list" aria-label="Workouts in this Stars backup">
              {rows.map((r) => (
                <StarsRow
                  key={r.key}
                  row={r}
                  unit={unit}
                  selected={selected.has(r.key)}
                  entry={entries[r.key]}
                  check={checks[r.key]}
                  onToggle={() => toggle(r.key)}
                  onEntry={(field, value) => setEntry(r.key, field, value)}
                />
              ))}
              {!rows.length && <li className="stars-row">This backup has no runs or workouts.</li>}
            </ul>

            <div className="stars-footer">
              {blocked > 0 && (
                <div className="field-error">
                  {plural(blocked, "selected workout")} {blocked === 1 ? "needs" : "need"} fixing or deselecting (see the red notes).
                </div>
              )}
              {saveError && <div className="field-error" role="alert">{saveError}</div>}
              <div className="stars-footer-btns">
                <button type="button" className="secondary-btn" onClick={onClose}>
                  Cancel
                </button>
                <button type="button" className="primary-btn" onClick={handleImport} disabled={saving || !count || blocked > 0}>
                  {saving ? "Importing…" : `Import ${plural(count, "workout")}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StarsRow({ row, unit, selected, entry, check, onToggle, onEntry }) {
  const canSelect = row.status === "new" || row.status === "duplicate";
  const id = `stars-${row.key}`;
  const showFields = row.kind === "run" && canSelect && selected;
  const resolved = showFields ? resolveRunEntry(entry, unit) : null;
  const errors = check?.errors || [];
  const date = row.date ? formatDisplayDate(row.date) : "Unknown date";
  const kindLabel = row.kind === "run" ? "Run" : `Strength · ${row.label || "?"}`;

  let missing = "";
  if (row.kind === "run" && !showFields) {
    missing = row.distanceMi ? `${formatDistance(row.distanceMi, unit, 2)} in Stars; no time.` : "No distance or time in Stars.";
  } else if (row.kind === "strength") {
    missing = "Imported as a Strength session (Stars has no sets or duration).";
  }

  return (
    <li className={`stars-row${selected ? " is-selected" : ""}${canSelect ? "" : " is-disabled"}`}>
      <label className="stars-row-head">
        <input
          type="checkbox"
          checked={selected}
          disabled={!canSelect}
          onChange={onToggle}
          aria-describedby={`${id}-info`}
        />
        <span className="stars-row-title">
          {date} · {kindLabel}
        </span>
      </label>
      <div id={`${id}-info`} className="stars-row-info">
        {row.reason && <div className={row.status === "duplicate" ? "stars-warn" : "field-hint"}>{row.reason}</div>}
        {row.notes && <div className="stars-notes">“{row.notes}”</div>}
        {missing && <div className="field-hint">{missing}</div>}
      </div>

      {showFields && (
        <>
          <div className="stars-fields">
            <label className="stars-field">
              <span className="entry-label">Distance ({distLabel(unit)})</span>
              <input
                inputMode="decimal"
                autoComplete="off"
                placeholder={resolved.derived === "distance" ? round(resolved.distance, 2) : "—"}
                value={entry.distance}
                onChange={(e) => onEntry("distance", e.target.value)}
                aria-invalid={Boolean(resolved.errors.distance)}
                aria-describedby={`${id}-calc ${id}-err`}
              />
            </label>
            <label className="stars-field">
              <span className="entry-label">Time (MM:SS)</span>
              <DurationInput
                digits={entry.duration}
                placeholder={resolved.derived === "duration" ? formatDuration(resolved.minutes) : "—"}
                onChange={(digits) => onEntry("duration", digits)}
                invalid={Boolean(resolved.errors.duration)}
                describedBy={`${id}-calc ${id}-err`}
              />
            </label>
            <label className="stars-field">
              <span className="entry-label">Avg ({speedLabel(unit)})</span>
              <input
                inputMode="decimal"
                autoComplete="off"
                placeholder={resolved.derived === "speed" ? round(resolved.speed, 1) : "—"}
                value={entry.speed}
                onChange={(e) => onEntry("speed", e.target.value)}
                aria-invalid={Boolean(resolved.errors.speed)}
                aria-describedby={`${id}-calc ${id}-err`}
              />
            </label>
          </div>
          <div id={`${id}-calc`} className="field-hint">
            {resolved.derived === "speed" && `Avg speed calculated: ${round(resolved.speed, 1)} ${speedLabel(unit)}.`}
            {resolved.derived === "duration" && `Time calculated: ${formatDuration(resolved.minutes)}.`}
            {resolved.derived === "distance" && `Distance calculated: ${round(resolved.distance, 2)} ${distLabel(unit)}.`}
            {!resolved.derived && !Object.keys(resolved.errors).length && !(resolved.distance && resolved.minutes) &&
              `No ${resolved.distance ? "time" : "distance"}, so no speed. Fill in any two of the three, or import as is.`}
          </div>
        </>
      )}

      {selected && errors.length > 0 && (
        <div id={`${id}-err`} className="field-error">
          {errors.join(" ")}
        </div>
      )}
    </li>
  );
}

// Same digits-only MM:SS / H:MM:SS entry as the activity form.
function DurationInput({ digits, placeholder, onChange, invalid, describedBy }) {
  return (
    <input
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      placeholder={placeholder}
      value={maskDuration(digits)}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      onChange={(e) => {
        const input = e.target;
        const next = editMaskedDuration(digits, input.value, input.selectionStart, e.nativeEvent.inputType === "deleteContentForward");
        if (next.digits === digits) input.value = maskDuration(digits);
        else onChange(next.digits);
        requestAnimationFrame(() => input.setSelectionRange(next.caret, next.caret));
      }}
    />
  );
}

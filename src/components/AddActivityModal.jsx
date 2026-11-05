import React, { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { FiImage } from "react-icons/fi";
import useDialog from "../hooks/useDialog";
import usePhoto, { photoErrorText } from "../hooks/usePhoto";
import { todayYMD } from "../utils/dateUtils";
import { activityToForm, validateActivityForm, computeSplitTotals, editMaskedDuration, formatDuration, maskDuration, parseDuration, readDurationInput } from "../utils/activityModel";
import { resizeImageFile } from "../utils/image";
import { distLabel, speedLabel, useUnit } from "../utils/units";


// Schema

/*
{
  "id": "string",
  "title": "string",
  "description": "string",
  "type": "run | bike | swim | hike | workout | strength",
  "intensity": "easy | tempo | intervals | long | unknown",
  "feel": "easy | medium | hard",
  "status": "completed | planned (missing = completed)",
  "limiter": "string",
  "tags": ["string"],
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "mode": "timeMiles | splits",
  "miles": "number (always miles; '' if not recorded)",
  "duration": "number (minutes; '' if not recorded)",
  "splits": [
    {
      "mph": "number",
      "distance": "number (miles)"
    }
  ],
  "notes": "string",
  "photoId": "key of the photo in IndexedDB (velo-media), if any",
  "source"/"sourceId": "provider identity, e.g. strava",
  "movingMinutes"/"elapsedMinutes"/"distanceMeters": "provider values, kept as imported",
  "legacy": "original values kept when a stored format was converted",
  "needsReview": "fields whose stored value couldn't be interpreted ('status' = planned or done not known)"
}
*/

const TAG_OPTIONS = [

  { value: "strides", label: "⚡ Strides" },
  { value: "drills", label: "🎯 Drills" },
  { value: "hills", label: "⛰️ Hills" },
  { value: "recovery", label: "🛟 Recovery" },

  { value: "trail", label: "🌲 Trail" },

  { value: "brick", label: "🧱 Brick" },
  { value: "race", label: "🏁 Race" },



];

const EMPTY_SPLIT = { mph: "", distance: "" };

function initialForm(a, unit) {
  if (a) return activityToForm(a, unit);
  return {
    id: null,
    title: "",
    description: "",
    type: "run",
    intensity: "easy",
    feel: "medium",
    status: "completed",
    limiter: "",
    tags: [],
    date: todayYMD(),
    time: "",
    mode: "timeMiles", // or "splits"
    duration: "",
    miles: "",
    splits: [{ ...EMPTY_SPLIT }],
    notes: "",
  };
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <div id={id} className="field-error" role="alert">
      {message}
    </div>
  );
}

// Rendered only while open (App mounts it), so the form starts fresh each time.
// onSave(activity, { photo, expected }) resolves to { ok, error? }.
export default function AddActivityModal({ isOpen, onClose, onSave, initialActivity, onDelete }) {
  const unit = useUnit();
  const [formUnit] = useState(unit); // values stay in the unit they were typed in
  const [form, setForm] = useState(() => initialForm(initialActivity, formUnit));
  const [initialSnapshot] = useState(() => JSON.stringify(initialForm(initialActivity, formUnit)));
  // undefined = keep the stored photo, null = remove it, string = new resized photo
  const [newPhoto, setNewPhoto] = useState(undefined);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [saving, setSaving] = useState(false);
  const [durationFocused, setDurationFocused] = useState(false);
  const formRef = useRef(null);
  const stored = usePhoto(newPhoto === undefined ? initialActivity?.photoId : null);
  const preview = newPhoto === undefined ? stored.src || initialActivity?.photo || null : newPhoto;

  const requestClose = () => {
    const dirty = JSON.stringify(form) !== initialSnapshot || newPhoto !== undefined;
    if (dirty && !window.confirm("Discard your changes to this activity?")) return;
    onClose();
  };

  const dialogRef = useDialog(isOpen, requestClose);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDurationChange = (e) => {
    const input = e.target;
    const { digits, caret } = editMaskedDuration(
      form.duration,
      input.value,
      input.selectionStart,
      e.nativeEvent.inputType === "deleteContentForward"
    );
    if (digits === form.duration) input.value = maskDuration(digits); // refused edit: undo it before placing the caret
    else flushSync(() => setForm((prev) => ({ ...prev, duration: digits })));
    input.setSelectionRange(caret, caret);
  };

  const handleSplitChange = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      splits: prev.splits.map((split, i) =>
        i === index ? { ...split, [field]: value } : split
      ),
    }));
  };

  const toggleTag = (tagValue) => {
    setForm((prev) => {
      const hasTag = prev.tags.includes(tagValue);

      return {
        ...prev,
        tags: hasTag
          ? prev.tags.filter((tag) => tag !== tagValue)
          : [...prev.tags, tagValue],
      };
    });
  };

  const addSplit = () => {
    setForm((prev) => ({
      ...prev,
      splits: [...prev.splits, { ...EMPTY_SPLIT }],
    }));
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const photo = await resizeImageFile(file, 1280);
      setPhotoError("");
      setNewPhoto(photo);
    } catch (err) {
      setPhotoError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const { errors: found, activity } = validateActivityForm(form, { unit: formUnit, original: initialActivity });
    setErrors(found);
    setSaveError("");
    if (!activity) {
      // Focus the first invalid field so keyboard/screen-reader users land on it.
      setTimeout(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus(), 0);
      return;
    }

    // Every field was just validated (status included), so earlier review flags no longer apply.
    const { needsReview: _reviewed, ...clean } = activity;
    setSaving(true);
    const result = await onSave({ ...clean, id: initialActivity?.id ?? null }, { photo: newPhoto, expected: initialActivity });
    if (!result?.ok) {
      setSaving(false);
      setSaveError(result?.error || "Couldn't save this activity.");
    }
  };

  const handleDelete = () => {
    if (!form.id) return;
    const result = onDelete(form.id);
    if (result && !result.ok && result.error) setSaveError(result.error);
  };

  // Live totals: typed in the form's unit, shown in the same unit.
  const splitTotals = form.mode === "splits"
    ? computeSplitTotals(form.splits.map((s) => ({ mph: s.mph, distance: s.distance })))
    : null;
  const invalid = (name) => (errors[name] ? { "aria-invalid": "true", "aria-describedby": `err-${name}` } : {});
  const reviewFields = (initialActivity?.needsReview || []).filter((f) => f in (initialActivity || {}));
  const dl = distLabel(formUnit);
  const typedDuration = readDurationInput(form.duration, initialActivity);
  const distanceName = formUnit === "km" ? "Kilometers" : "Miles";

  return (
    <div className="dialog-layer">
      <div className="overlay" onClick={requestClose}></div>

      <div
        className="modal slide-in"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-modal-title"
      >
      <form ref={formRef} onSubmit={handleSubmit} noValidate>

        <h2 id="activity-modal-title">{initialActivity ? "Edit Activity" : "Manual Activity"}</h2>

        <button type="button" className="close-btn" onClick={requestClose} aria-label="Close">
          ✕
        </button>

        {reviewFields.length > 0 && (
          <div className="field-error" role="note">
            Needs review — original stored values:{" "}
            {reviewFields.map((f) => `${f}: ${JSON.stringify(initialActivity[f])}`).join(", ")}
          </div>
        )}
        {initialActivity?.needsReview?.includes("status") && (
          <div className="field-error" role="note">
            This activity was dated in the future when planned workouts were introduced. Choose whether it is
            planned or completed below; until then it isn't counted anywhere.
          </div>
        )}

        <input
          name="title"
          placeholder="Title your run"
          aria-label="Title"
          value={form.title}
          onChange={handleChange}
        />

        <textarea
          name="description"
          placeholder="How'd it go?"
          aria-label="Description"
          value={form.description}
          onChange={handleChange}
        />

      <div className="toggle-group" role="group" aria-label="Entry mode">
        <button
          type="button"
          aria-pressed={form.mode === "timeMiles"}
          className={form.mode === "timeMiles" ? "active" : ""}
          onClick={() =>
            setForm((prev) => ({
              ...prev,
              mode: "timeMiles",
            }))
          }
        >
          {distanceName} + Time
        </button>

        <button
          type="button"
          aria-pressed={form.mode === "splits"}
          className={form.mode === "splits" ? "active" : ""}
          onClick={() =>
            setForm((prev) => ({
              ...prev,
              mode: "splits",
            }))
          }
        >
          {speedLabel(formUnit).toUpperCase()} + Splits
        </button>
      </div>

      {form.mode === "timeMiles" && (
        <>
          <input
            name="miles"
            placeholder={form.type === "strength" ? `${distanceName} (optional)` : distanceName}
            aria-label={`Distance (${dl})`}
            inputMode="decimal"
            value={form.miles}
            onChange={handleChange}
            {...invalid("miles")}
          />
          <FieldError id="err-miles" message={errors.miles} />

          <input
            name="duration"
            placeholder="Duration (MM:SS)"
            aria-label="Duration"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            // form.duration holds digits; the colons are display only.
            value={durationFocused || typedDuration.minutes == null ? maskDuration(form.duration) : formatDuration(typedDuration.minutes)}
            onChange={handleDurationChange}
            onFocus={(e) => {
              const input = e.target;
              const allSelected = input.value && input.selectionEnd - input.selectionStart === input.value.length;
              setDurationFocused(true);
              // A value swap here (99:59 back from 1:39:59) drops the select-all from tabbing in.
              if (allSelected) requestAnimationFrame(() => input.select());
            }}
            onBlur={() => {
              setDurationFocused(false);
              setErrors((prev) => ({ ...prev, duration: typedDuration.error }));
            }}
            {...invalid("duration")}
            aria-describedby={errors.duration ? "duration-hint err-duration" : "duration-hint"}
          />
          <div id="duration-hint" className="field-hint">
            Numbers only: 2530 = 25:30, 13045 = 1:30:45
            {parseDuration(initialActivity?.duration) >= 600 && ". Over 10 hours: HHMMSS"}
          </div>
          <FieldError id="err-duration" message={errors.duration} />
        </>
      )}

        {form.mode === "splits" && (
          <>
            {form.splits.map((split, i) => (
              <div key={i}>
                <input
                  placeholder={speedLabel(formUnit).toUpperCase()}
                  aria-label={`Split ${i + 1} speed (${speedLabel(formUnit)})`}
                  inputMode="decimal"
                  value={split.mph}
                  onChange={(e) =>
                    handleSplitChange(i, "mph", e.target.value)
                  }
                  {...(errors.splits && splitTotals?.invalidRows.includes(i) ? invalid("splits") : {})}
                />
                <input
                  placeholder="Distance"
                  aria-label={`Split ${i + 1} distance (${dl})`}
                  inputMode="decimal"
                  value={split.distance}
                  onChange={(e) =>
                    handleSplitChange(i, "distance", e.target.value)
                  }
                />
              </div>
            ))}
            <FieldError id="err-splits" message={errors.splits} />
            {splitTotals && splitTotals.count > 0 && splitTotals.invalidRows.length === 0 && (
              <div className="split-totals" aria-live="polite">
                Total: {splitTotals.miles} {dl} · {formatDuration(splitTotals.minutes)}
              </div>
            )}
            <button type="button" onClick={addSplit}>+ Add Split</button>
          </>
        )}

        {/* Keep these as selects */}
        <div className="row" style={{ marginBottom: "0px" }}>
          <select name="type" aria-label="Activity type" value={form.type} onChange={handleChange}>
            <option value="run">🏃‍➡️ Run</option>
            <option value="bike">🚲 Bike</option>
            <option value="swim">🥽 Swim</option>
            <option value="hike">🥾 Hike</option>
            <option value="workout">💪 Workout</option>
            <option value="strength">🏋️ Strength</option>
          </select>

          <select name="limiter" aria-label="Limiter" value={form.limiter} onChange={handleChange}>
            <option value="">⚪ No Limiter</option>

            <option value="heavy">🪨 Heavy Legs</option>
            <option value="lungs">🫁 Lungs Stopped Me</option>
            <option value="muscle_burn">🔥 Muscle Burn</option>
            <option value="joint_pain">⚠️ Foot / Knee / Hip Felt Sus</option>
            <option value="energy_low">🔋 Low Energy</option>
            <option value="heat">🥵 Heat</option>
            <option value="sleepy">😴 Poor Sleep</option>
            <option value="stomach">🤢 Stomach Issues</option>
            <option value="bored">😒 Bored</option>
          </select>
        </div>
        <FieldError id="err-type" message={errors.type} />

        <div className="row">
          <select name="intensity" aria-label="Intensity" value={form.intensity} onChange={handleChange}>
            <option value="easy">🟢 Easy</option>
            <option value="tempo">🟡 Tempo</option>
            <option value="intervals">🔴 Intervals</option>
            <option value="long">🟣 Long</option>
            <option value="unknown">⚪ Effort unknown</option>
          </select>

          <select name="feel" aria-label="Feel" value={form.feel} onChange={handleChange}>
            <option value="easy">🍃 Light</option>
            <option value="medium">😎 Steady</option>
            <option value="hard">🔥 Tough</option>
          </select>
        </div>
        <FieldError id="err-intensity" message={errors.intensity || errors.feel} />



        <div className="tag-section">
          <h3>Tags</h3>

          <div className="tag-group">
            {TAG_OPTIONS.map((tag) => {
              const isActive = form.tags.includes(tag.value);

              return (
                <button
                  key={tag.value}
                  type="button"
                  aria-pressed={isActive}
                  className={`tag-pill ${isActive ? "active" : ""}`}
                  onClick={() => toggleTag(tag.value)}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ height: "20px" }}></div>

        {/* Upload image */}
        <label className="upload-box">
          <input
            type="file"
            accept="image/*"
            className="upload-input"
            aria-label="Add photo"
            onChange={handlePhoto}
          />

          <div className="upload-content">
            <div className="upload-icon">
              <FiImage />
            </div>
            <div className="upload-text">{preview ? "Replace Photo" : "Add Photo"}</div>
          </div>
        </label>
        <FieldError id="err-photo" message={photoError || (newPhoto === undefined && stored.error ? photoErrorText(stored.error) : "")} />

        {preview && (
          <div style={{ marginTop: 10 }}>
            <img
              src={preview}
              alt="Activity photo preview"
              style={{ width: "100%", borderRadius: 12 }}
              onError={() => setPhotoError("This photo couldn't be displayed by the browser.")}
            />
            <button
              type="button"
              className="tertiary-btn"
              onClick={() => setNewPhoto(null)}
            >
              Remove photo
            </button>
          </div>
        )}

        <h3>Activity Stats</h3>

        <div className="row">
          <input type="date" name="date" aria-label="Date" value={form.date} onChange={handleChange} {...invalid("date")} />
          <input type="time" name="time" aria-label="Start time" value={form.time} onChange={handleChange} {...invalid("time")} />
        </div>
        <FieldError id="err-date" message={errors.date} />
        <FieldError id="err-time" message={errors.time} />

        <select name="status" aria-label="Status" value={form.status} onChange={handleChange} {...invalid("status")}>
          {!form.status && <option value="">Choose: completed or planned?</option>}
          <option value="completed">✅ Completed</option>
          <option value="planned">🗓️ Planned</option>
        </select>
        <FieldError id="err-status" message={errors.status} />
        {form.status === "planned" && (
          <div className="field-hint">
            Planned activities don't count toward mileage, jars, PRs or coaching until you mark them completed.
          </div>
        )}

        <textarea
          name="notes"
          placeholder="Private Notes"
          aria-label="Private notes"
          value={form.notes}
          onChange={handleChange}
        />

        {saveError && (
          <div className="field-error" role="alert">
            {saveError}
          </div>
        )}

        {/* Save button */}
        <button type="submit" className="primary-btn" disabled={saving}>
          {saving ? "Saving…" : "Save Activity"}
        </button>

        {/* Delete button */}
        {initialActivity && (
          <button
            type="button"
            className="danger-btn"
            onClick={handleDelete}
          >
            Delete Activity
          </button>
        )}


      </form>
      </div>
    </div>
  );
}


import React, { useState, useEffect } from "react";
import { FiImage, FiUpload } from "react-icons/fi";
import { FaRunning, FaBiking, FaSwimmingPool } from "react-icons/fa";

function getLocalTodayYMD() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

import completeSound from "/activity-save.mp3";

// Schema

/*
{
  "id": "string",
  "title": "string",
  "description": "string",
  "type": "run | bike | swim | workout",
  "intensity": "easy | tempo | intervals | long",
  "feel": "easy | medium | hard",
  "limiter": "string",
  "tags": ["string"],
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "mode": "timeMiles | splits",
  "miles": "number",
  "duration": "number",
  "splits": [
    {
      "mph": "number",
      "distance": "number"
    }
  ],
  "notes": "string",
  "photo": "base64-string"
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

export default function AddActivityModal({ isOpen, onClose, onSave, initialActivity, onDelete }) {

  const today = getLocalTodayYMD();

  const emptyForm = {
    id: null,
    title: "",
    description: "",
    type: "run",
    intensity: "easy",
    feel: "medium",
    limiter: "",
    tags: [],
    date: today,
    time: "",
    mode: "timeMiles", // or "splits"
    duration: "",
    miles: "",
    splits: [{ mph: "", distance: "" }],
    notes: "",
    photo: null, // will be base64 string
  };

  const [form, setForm] = useState(emptyForm);

  // When the modal opens, if we're editing, preload the form.
  // If we're adding, reset to empty defaults.
  useEffect(() => {
    if (!isOpen) return;

    if (initialActivity) {
      setForm({
        ...initialActivity, // copy activity FIRST

        limiter: initialActivity.limiter ?? "",
        tags: Array.isArray(initialActivity.tags) ? [...initialActivity.tags] : [],
        splits: initialActivity.splits?.length
          ? initialActivity.splits.map((s) => ({
              mph: s.mph ?? "",
              distance: s.distance ?? "",
            }))
          : [{ mph: "", distance: "" }],

        date: initialActivity.date ?? today,
      });
    } else {
      setForm({
        ...emptyForm,
        tags: [],
        splits: [{ mph: "", distance: "" }],
      });
    }

  }, [isOpen, initialActivity]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
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
      splits: [...prev.splits, { mph: "", distance: "" }],
    }));
  };

  const handleSubmit = () => {
    const activityToSave = {
      ...form,
      id: initialActivity?.id ?? form.id ?? null,
    };

    onSave(activityToSave);
    onClose();


    console.log("hiiiiiiiiii");

    // Tell next page load to play sound
    // (You can't refresh and play the sound here at the same time 
    // you need to use activity.jsx to play while this refreshes)

    localStorage.setItem("playActivitySound", "true");

    // 📳 Vibrate (mobile only)
    if (navigator.vibrate) {
      navigator.vibrate(120);
    }

    // Slight delay to have the reload match up with the sound
    setTimeout(() => {
      window.location.reload();
    }, 675);
    
  };

  return (
    <>
      <div className="overlay" onClick={onClose}></div>
        
      <div className="modal slide-in">

        <h2>{initialActivity ? "Edit Activity" : "Manual Activity"}</h2>

        <button className="close-btn" onClick={onClose}>
          ✕
        </button>

        <input
          name="title"
          placeholder="Title your run"
          value={form.title}
          onChange={handleChange}
        />

        <textarea
          name="description"
          placeholder="How'd it go?"
          value={form.description}
          onChange={handleChange}
        />

      <div className="toggle-group">
        <button
          className={form.mode === "timeMiles" ? "active" : ""}
          onClick={() =>
            setForm((prev) => ({
              ...prev,
              mode: "timeMiles",
            }))
          }
        >
          Miles + Time
        </button>

        <button
          className={form.mode === "splits" ? "active" : ""}
          onClick={() =>
            setForm((prev) => ({
              ...prev,
              mode: "splits",
            }))
          }
        >
          MPH + Splits
        </button>
      </div>

      {form.mode === "timeMiles" && (
        <>
          <input
            name="miles"
            placeholder="Miles"
            value={form.miles}
            onChange={handleChange}
          />

          <input
            name="duration"
            placeholder="Duration (minutes)"
            value={form.duration}
            onChange={handleChange}
          />
        </>
      )}

        {form.mode === "splits" && (
          <>
            {form.splits.map((split, i) => (
              <div key={i}>
                <input
                  placeholder="MPH"
                  value={split.mph}
                  onChange={(e) =>
                    handleSplitChange(i, "mph", e.target.value)
                  }
                />
                <input
                  placeholder="Distance"
                  value={split.distance}
                  onChange={(e) =>
                    handleSplitChange(i, "distance", e.target.value)
                  }
                />
              </div>
            ))}
            <button onClick={addSplit}>+ Add Split</button>
          </>
        )}


        {/* Activity Type Icons */}
        {/* <div className="activity-type-group">

          <button
            type="button"
            className={`activity-type ${form.type === "run" ? "active" : ""}`}
            onClick={() => setForm({ ...form, type: "run" })}
          >
            <FaRunning />
            <span>Run</span>
          </button>

          <button
            type="button"
            className={`activity-type ${form.type === "bike" ? "active" : ""}`}
            onClick={() => setForm({ ...form, type: "bike" })}
          >
            <FaBiking />
            <span>Bike</span>
          </button>

          <button
            type="button"
            className={`activity-type ${form.type === "swim" ? "active" : ""}`}
            onClick={() => setForm({ ...form, type: "swim" })}
          >
            <FaSwimmingPool />
            <span>Swim</span>
          </button>

        </div> */}

        {/* Keep these as selects */}
        <div className="row">
          <select name="type" value={form.type} onChange={handleChange}>
            <option value="run">🏃‍➡️ Run</option>
            <option value="bike">🚲 Bike</option>
            <option value="swim">🥽 Swim</option>
            <option value="workout">💪 Workout</option>
          </select>
          <select name="intensity" value={form.intensity} onChange={handleChange}>
            <option value="easy">🟢 Easy</option>
            <option value="tempo">🟡 Tempo</option>
            <option value="intervals">🔴 Intervals</option>
            <option value="long">🟣 Long</option>
          </select>

          <select name="feel" value={form.feel} onChange={handleChange}>
            <option value="easy">☺️ Light</option>
            <option value="medium">😎 Steady</option>
            <option value="hard">😤 Tough</option>
          </select>

          <select name="limiter" value={form.limiter} onChange={handleChange}>
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

        <div className="tag-section">
          <h3>Tags</h3>

          <div className="tag-group">
            {TAG_OPTIONS.map((tag) => {
              const isActive = form.tags.includes(tag.value);

              return (
                <button
                  key={tag.value}
                  type="button"
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
            className="upload-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              const reader = new FileReader();
              reader.onloadend = () => {
                setForm((prev) => ({
                  ...prev,
                  photo: reader.result,
                }));
              };
              reader.readAsDataURL(file);
            }}
          />

          <div className="upload-content">
            <div className="upload-icon">
              <FiImage />
            </div>
            <div className="upload-text">Add Photos / Videos</div>
          </div>
        </label>

        {form.photo && (
          <div style={{ marginTop: 10 }}>
            <img
              src={form.photo}
              alt="preview"
              style={{ width: "100%", borderRadius: 12 }}
            />
          </div>
        )}

        <h3>Activity Stats</h3>

        <div className="row">
          <input type="date" name="date" value={form.date} onChange={handleChange} />
          <input type="time" name="time" value={form.time} onChange={handleChange} />
        </div>



        <textarea
          name="notes"
          placeholder="Private Notes"
          value={form.notes}
          onChange={handleChange}
        />

        {/* Save button */}
        <button className="primary-btn" onClick={handleSubmit}>
          Save Activity
        </button>

        {/* Delete button */}
        {initialActivity && (
          <button
            type="button"
            className="danger-btn"
            onClick={() => {
              if (!form.id) return;
              onDelete(form.id);
              onClose();
            }}
          >
            Delete Activity
          </button>
        )}


      </div>
    </>
  );
}



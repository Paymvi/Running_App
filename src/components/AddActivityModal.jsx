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

export default function AddActivityModal({ isOpen, onClose, onSave, initialActivity, onDelete }) {

  const today = getLocalTodayYMD();

  const emptyForm = {
    id: null,
    title: "",
    description: "",
    type: "run",
    intensity: "easy",
    feel: "medium",
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
        ...emptyForm,
        ...initialActivity,
        id: initialActivity.id, // keep id
        date: initialActivity.date || today,
        splits: initialActivity.splits?.length
          ? initialActivity.splits
          : [{ mph: "", distance: "" }],
      });
    } else {
      setForm(emptyForm);
    }
  }, [isOpen, initialActivity]);


  if (!isOpen) return null;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSplitChange = (index, field, value) => {
    const updated = [...form.splits];
    updated[index][field] = value;
    setForm({ ...form, splits: updated });
  };

  const addSplit = () => {
    setForm({
      ...form,
      splits: [...form.splits, { mph: "", distance: "" }],
    });
  };

  const handleSubmit = () => {
    onSave(form);
    onClose();
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
          onClick={() => setForm({ ...form, mode: "timeMiles" })}
        >
          Miles + Time
        </button>

        <button
          className={form.mode === "splits" ? "active" : ""}
          onClick={() => setForm({ ...form, mode: "splits" })}
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
        </div>

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
                setForm({ ...form, photo: reader.result }); // base64 string
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
            }}
          >
            Delete Activity
          </button>
        )}


      </div>
    </>
  );
}
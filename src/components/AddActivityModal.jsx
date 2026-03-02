import React, { useState } from "react";
import { FiImage, FiUpload } from "react-icons/fi";
import { FaRunning, FaBiking, FaSwimmingPool } from "react-icons/fa";

export default function AddActivityModal({ isOpen, onClose, onSave }) {
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
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
    photo: null,
  });

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

        <h2>Manual Activity</h2>

        <button className="close-btn" onClick={onClose}>
          ✕
        </button>

        <input name="title" placeholder="Title your run" onChange={handleChange} />
        <textarea
          name="description"
          placeholder="How'd it go?"
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
              onChange={handleChange}
            />
            <input
              name="duration"
              placeholder="Duration (minutes)"
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
          <select name="type" onChange={handleChange}>
            <option value="run">🏃‍➡️ Run</option>
            <option value="bike">🚲 Bike</option>
            <option value="swim">🥽 Swim</option>
          </select>
          <select name="intensity" onChange={handleChange}>
            <option value="easy">🟢 Easy</option>
            <option value="tempo">🟡 Tempo</option>
            <option value="intervals">🔴 Intervals</option>
            <option value="long">🟣 Long</option>
          </select>

          <select name="feel" onChange={handleChange}>
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
            onChange={(e) =>
              setForm({ ...form, photo: e.target.files[0] })
            }
          />

          <div className="upload-content">
            <div className="upload-icon">
              <FiImage />
            </div>
            <div className="upload-text">Add Photos / Videos</div>
          </div>
        </label>

        <h3>Activity Stats</h3>

        <div className="row">
          <input type="date" name="date" defaultValue={today} onChange={handleChange} />
          <input type="time" name="time" onChange={handleChange} />
        </div>



        <textarea
          name="notes"
          placeholder="Private Notes"
          onChange={handleChange}
        />

        <button className="primary-btn" onClick={handleSubmit}>
          Save Activity
        </button>
      </div>
    </>
  );
}
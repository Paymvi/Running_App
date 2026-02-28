import React, { useState } from "react";

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

        <input name="title" placeholder="Title your run" onChange={handleChange} />
        <textarea
          name="description"
          placeholder="How'd it go?"
          onChange={handleChange}
        />



        <div className="row">
            <select name="type" onChange={handleChange}>
                <option value="run">Run</option>
                <option value="bike">Bike</option>
                <option value="swim">Swim</option>
            </select>
            <select name="intensity" onChange={handleChange}>
                <option value="easy">Easy</option>
                <option value="long">Long</option>
                <option value="tempo">Tempo</option>
                <option value="intervals">Intervals</option>
            </select>
            <select name="feel" onChange={handleChange}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
            </select>
        </div>

        <input type="file" />

        <h3>Activity Stats</h3>

        <input type="date" name="date" defaultValue={today} onChange={handleChange} />
        <input type="time" name="time" onChange={handleChange} />

        <div>
          <button onClick={() => setForm({ ...form, mode: "timeMiles" })}>
            Time + Miles
          </button>
          <button onClick={() => setForm({ ...form, mode: "splits" })}>
            MPH + Splits
          </button>
        </div>

        {form.mode === "timeMiles" && (
          <>
            <input
              name="duration"
              placeholder="Duration (minutes)"
              onChange={handleChange}
            />
            <input
              name="miles"
              placeholder="Miles"
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

        <textarea
          name="notes"
          placeholder="Private Notes"
          onChange={handleChange}
        />

        <button onClick={handleSubmit}>Save Activity</button>
      </div>
    </>
  );
}
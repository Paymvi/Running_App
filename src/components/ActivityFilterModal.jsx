import React, { useState } from "react";
import useDialog from "../hooks/useDialog";

export default function ActivityFilterModal({
  isOpen,
  onClose,
  filters,
  setFilters,
  onReset,
  unit = "mi",
}) {

  // null = follow the filters (open when any advanced filter is set); otherwise the user's choice.
  const [advancedChoice, setAdvancedChoice] = useState(null);
  const dialogRef = useDialog(isOpen, onClose);

  const toggleArrayValue = (key, value) => {
    setFilters((prev) => {
      const current = prev[key];
      const exists = current.includes(value);

      return {
        ...prev,
        [key]: exists
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  };

  const updateFilterValue = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === "" ? "" : value,
    }));
  };


  
  
  const hasAdvancedFilters = Boolean(
      filters.distanceMin ||
      filters.distanceMax ||
      filters.durationMin ||
      filters.durationMax ||
      filters.paceMin ||
      filters.paceMax ||
      filters.feels.length > 0 ||
      filters.dateStart ||
      filters.dateEnd ||
      filters.notesSearch);
  const showAdvanced = advancedChoice ?? hasAdvancedFilters;



  if (!isOpen) return null;


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="activity-filter-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="activity-filter-header">
          <h2 id="filter-modal-title">Filter Activities</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close filters">
            ✕
          </button>
        </div>

        <div className="activity-filter-body">


          <div className="row">
            <div className="filter-group">
              <label className="filter-label" htmlFor="filter-name">Search by name</label>
              <input
                id="filter-name"
                type="text"
                className="filter-input"
                placeholder="Search title..."
                value={filters.searchName}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, searchName: e.target.value }))
                }
              />
            </div>

            <div className="filter-group">
              <label className="filter-label" htmlFor="filter-date">Search by date</label>
              <input
                id="filter-date"
                type="date"
                className="filter-input"
                value={filters.searchDate}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, searchDate: e.target.value }))
                }
              />
            </div>
          </div>
          

          <div className="filter-group">
            <div className="filter-label" id="filter-type-label">Activity type</div>

            <div className="filter-chip-row" role="group" aria-labelledby="filter-type-label">
              {[
                { label: "Run", value: "run" },
                { label: "Bike", value: "bike" },
                { label: "Swim", value: "swim" },
                { label: "Hike", value: "hike" },
                { label: "Workout", value: "workout" },
                { label: "Strength", value: "strength" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={filters.types.includes(item.value)}
                  className={`filter-chip ${
                    filters.types.includes(item.value) ? "active" : ""
                  }`}
                  onClick={() => toggleArrayValue("types", item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <div className="filter-label" id="filter-intensity-label">Intensity</div>
            <div className="filter-chip-row" role="group" aria-labelledby="filter-intensity-label">
              {[
                { label: "Easy", value: "easy" },
                { label: "Tempo", value: "tempo" },
                { label: "Sprint", value: "intervals" },
                { label: "Long", value: "long" },
                { label: "Unknown", value: "unknown" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={filters.intensities.includes(item.value)}
                  className={`filter-chip chip-${item.value} ${
                    filters.intensities.includes(item.value) ? "active" : ""
                  }`}
                  onClick={() => toggleArrayValue("intensities", item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label className="filter-checkbox-row">
              <input
                type="checkbox"
                checked={filters.prOnly}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, prOnly: e.target.checked }))
                }
              />
              <span>Show PRs only</span>
            </label>
          </div>

          <div className="filter-group">
            <label className="filter-label" htmlFor="filter-sort">Sort by</label>
            <select
              id="filter-sort"
              className="filter-select"
              value={filters.sortBy}
              onChange={(e) => updateFilterValue("sortBy", e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="fastestPace">Fastest Pace</option>
              <option value="longestDistance">Longest Distance</option>
              <option value="longestTime">Longest Time</option>
            </select>

            <button
              type="button"
              className="advanced-settings-toggle"
              aria-expanded={showAdvanced}
              onClick={() => setAdvancedChoice(!showAdvanced)}
            >
              {showAdvanced ? "Hide Advanced Settings" : "Advanced Settings"}
            </button>
          </div>

          {showAdvanced && (
            <div className="advanced-settings-section">

              <div className="row">
                <div className="filter-group">
                  <div className="filter-label">Distance range ({unit === "km" ? "km" : "miles"})</div>
                  <div className="range-row">
                    <input
                      type="number"
                      className="filter-input"
                      placeholder="Min"
                      aria-label={`Minimum distance (${unit})`}
                      value={filters.distanceMin}
                      onChange={(e) => updateFilterValue("distanceMin", e.target.value)}
                    />
                    <input
                      type="number"
                      className="filter-input"
                      placeholder="Max"
                      aria-label={`Maximum distance (${unit})`}
                      value={filters.distanceMax}
                      onChange={(e) => updateFilterValue("distanceMax", e.target.value)}
                    />
                  </div>
                </div>

                <div className="filter-group">
                  <div className="filter-label">Duration range (minutes)</div>
                  <div className="range-row">
                    <input
                      type="number"
                      className="filter-input"
                      placeholder="Min"
                      aria-label="Minimum duration (minutes)"
                      value={filters.durationMin}
                      onChange={(e) => updateFilterValue("durationMin", e.target.value)}
                    />
                    <input
                      type="number"
                      className="filter-input"
                      placeholder="Max"
                      aria-label="Maximum duration (minutes)"
                      value={filters.durationMax}
                      onChange={(e) => updateFilterValue("durationMax", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="row">
                <div className="filter-group">
                  <div className="filter-label">Pace filter (min/{unit}, 7.5 = 7:30)</div>
                  <div className="range-row">
                    <input
                      type="number"
                      step="0.01"
                      className="filter-input"
                      placeholder="Min pace"
                      aria-label={`Fastest pace (min/${unit})`}
                      value={filters.paceMin}
                      onChange={(e) => updateFilterValue("paceMin", e.target.value)}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="filter-input"
                      placeholder="Max pace"
                      aria-label={`Slowest pace (min/${unit})`}
                      value={filters.paceMax}
                      onChange={(e) => updateFilterValue("paceMax", e.target.value)}
                    />
                  </div>
                </div>

                <div className="filter-group">
                  <div className="filter-label">Date range</div>
                  <div className="range-row">
                    <input
                      type="date"
                      className="filter-input"
                      aria-label="Start date"
                      value={filters.dateStart}
                      onChange={(e) => updateFilterValue("dateStart", e.target.value)}
                    />
                    <input
                      type="date"
                      className="filter-input"
                      aria-label="End date"
                      value={filters.dateEnd}
                      onChange={(e) => updateFilterValue("dateEnd", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="filter-group">
                <div className="filter-label" id="filter-feel-label">Feel</div>
                <div className="filter-chip-row" role="group" aria-labelledby="filter-feel-label">
                  {[
                    { label: "Easy", value: "easy" },
                    { label: "Medium", value: "medium" },
                    { label: "Hard", value: "hard" },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={filters.feels.includes(item.value)}
                      className={`filter-chip ${
                        filters.feels.includes(item.value) ? "active" : ""
                      }`}
                      onClick={() => toggleArrayValue("feels", item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ height: "14px" }}></div>

              <div className="filter-group">
                <label className="filter-label" htmlFor="filter-notes">Notes search</label>
                <input
                  id="filter-notes"
                  type="text"
                  className="filter-input"
                  placeholder="Search notes and descriptions..."
                  value={filters.notesSearch}
                  onChange={(e) => updateFilterValue("notesSearch", e.target.value)}
                />
              </div>




            </div>
          )}
          

        </div>

        <div className="activity-filter-footer">
          <button type="button" className="control-btn btn-secondary" onClick={onReset}>
            Reset
          </button>

          <button type="button" className="control-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
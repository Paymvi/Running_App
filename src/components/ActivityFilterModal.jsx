import React, { useEffect, useState } from "react";

export default function ActivityFilterModal({
  isOpen,
  onClose,
  filters,
  setFilters,
  onReset,
}) {

  const [showAdvanced, setShowAdvanced] = useState(false);

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  
  
  useEffect(() => {
    const hasAdvancedFilters =
      filters.distanceMin ||
      filters.distanceMax ||
      filters.durationMin ||
      filters.durationMax ||
      filters.paceMin ||
      filters.paceMax ||
      filters.feels.length > 0 ||
      filters.dateStart ||
      filters.dateEnd ||
      filters.notesSearch;

    if (hasAdvancedFilters) {
      setShowAdvanced(true);
    }
  }, [filters]);



  if (!isOpen) return null;


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="activity-filter-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="activity-filter-header">
          <h2>Filter Activities</h2>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="activity-filter-body">


          <div className="row">
            <div className="filter-group">
              <label className="filter-label">Search by name</label>
              <input
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
              <label className="filter-label">Search by date</label>
              <input
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
            <label className="filter-label">Activity type</label>

            <div className="filter-chip-row">
              {[
                { label: "Run", value: "run" },
                { label: "Bike", value: "bike" },
                { label: "Swim", value: "swim" },
                { label: "Workout", value: "workout" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
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
            <label className="filter-label">Intensity</label>
            <div className="filter-chip-row">
              {[
                { label: "Easy", value: "easy" },
                { label: "Tempo", value: "tempo" },
                { label: "Sprint", value: "intervals" },
                { label: "Long", value: "long" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
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
            <label className="filter-label">Sort by</label>
            <select
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
              onClick={() => setShowAdvanced((prev) => !prev)}
            >
              {showAdvanced ? "Hide Advanced Settings" : "Advanced Settings"}
            </button>
          </div>

          {showAdvanced && (
            <div className="advanced-settings-section">

              <div className="row">
                <div className="filter-group">
                  <label className="filter-label">Distance range (miles)</label>
                  <div className="range-row">
                    <input
                      type="number"
                      className="filter-input"
                      placeholder="Min"
                      value={filters.distanceMin}
                      onChange={(e) => updateFilterValue("distanceMin", e.target.value)}
                    />
                    <input
                      type="number"
                      className="filter-input"
                      placeholder="Max"
                      value={filters.distanceMax}
                      onChange={(e) => updateFilterValue("distanceMax", e.target.value)}
                    />
                  </div>
                </div>

                <div className="filter-group">
                  <label className="filter-label">Duration range (minutes)</label>
                  <div className="range-row">
                    <input
                      type="number"
                      className="filter-input"
                      placeholder="Min"
                      value={filters.durationMin}
                      onChange={(e) => updateFilterValue("durationMin", e.target.value)}
                    />
                    <input
                      type="number"
                      className="filter-input"
                      placeholder="Max"
                      value={filters.durationMax}
                      onChange={(e) => updateFilterValue("durationMax", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="row">
                <div className="filter-group">
                  <label className="filter-label">Pace filter (min/mi)</label>
                  <div className="range-row">
                    <input
                      type="number"
                      step="0.01"
                      className="filter-input"
                      placeholder="Min pace"
                      value={filters.paceMin}
                      onChange={(e) => updateFilterValue("paceMin", e.target.value)}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="filter-input"
                      placeholder="Max pace"
                      value={filters.paceMax}
                      onChange={(e) => updateFilterValue("paceMax", e.target.value)}
                    />
                  </div>
                </div>

                <div className="filter-group">
                  <label className="filter-label">Date range</label>
                  <div className="range-row">
                    <input
                      type="date"
                      className="filter-input"
                      value={filters.dateStart}
                      onChange={(e) => updateFilterValue("dateStart", e.target.value)}
                    />
                    <input
                      type="date"
                      className="filter-input"
                      value={filters.dateEnd}
                      onChange={(e) => updateFilterValue("dateEnd", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="filter-group">
                <label className="filter-label">Feel</label>
                <div className="filter-chip-row">
                  {[
                    { label: "Easy", value: "easy" },
                    { label: "Medium", value: "medium" },
                    { label: "Hard", value: "hard" },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
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
                <label className="filter-label">Notes search</label>
                <input
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
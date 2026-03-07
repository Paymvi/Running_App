import React from "react";

export default function ActivityFilterModal({
  isOpen,
  onClose,
  filters,
  setFilters,
  onReset,
}) {
  if (!isOpen) return null;

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
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, sortBy: e.target.value }))
              }
            >
              <option value="newest">Newest First</option>
              <option value="fastestPace">Fastest Pace</option>
              <option value="longestDistance">Longest Distance</option>
              <option value="longestTime">Longest Time</option>
            </select>
          </div>
        </div>

        <div className="activity-filter-footer">
          <button type="button" className="control-btn btn-secondary" onClick={onReset}>
            Reset
          </button>

          <button type="button" className="control-btn" onClick={onClose}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
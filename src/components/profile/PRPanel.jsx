import React from "react";
import { formatDate, formatTime, daysAgo } from "../../utils/profileHelpers";

export default function PRPanel({
  prs,
  selectedPR,
  setSelectedPR,
}) {
  return (
    <div className="profile-panel pr-panel">
    <div className="panel-title">🎖️ PRs</div>
    {selectedPR && selectedPR.date && (
        <div className="pr-selected-date">
            {selectedPR.label} PR: {formatDate(selectedPR.date)}
        </div>
        )}

    <div className="pr-table">
        <div className="pr-row">
        <div className="pr-cell label">Mile</div>
            <div
            className="pr-cell value clickable"
            onClick={() => {
                if (selectedPR?.label === "Mile") {
                    setSelectedPR(null);
                } else {
                    setSelectedPR({
                    label: "Mile",
                    date: prs.mile.date,
                    });
                }
            }}
            >
            {formatTime(prs.mile.time)}
            </div>
        </div>
        <div className="pr-row">
        <div className="pr-cell label">5K</div>
            <div
            className="pr-cell value clickable"
            onClick={() => {
                if (selectedPR?.label === "5K") {
                    setSelectedPR(null);
                } else {
                    setSelectedPR({
                    label: "5K",
                    date: prs.fiveK.date,
                    });
                }
            }}
            >
            {formatTime(prs.fiveK.time)}
            </div>
        </div>
        <div className="pr-row">
        <div className="pr-cell label">10K</div>
            <div
            className="pr-cell value clickable"
                onClick={() => {
                    if (selectedPR?.label === "10K") {
                    setSelectedPR(null);
                } else {
                    setSelectedPR({
                    label: "10K",
                    date: prs.tenK.date,
                    });
                }
            }}
            >
            {formatTime(prs.tenK.time)}
            </div>
        </div>
    </div>

    {prs.latestPRDate && (
        <div className="pr-latest">
            Last PR: {daysAgo(prs.latestPRDate)} days ago
        </div>
        )}

    </div>

  );
            
}
import React from "react";
import { formatDate, formatTime, daysAgo } from "../../utils/profileHelpers";

export default function PRPanel({
  prs,
  selectedPR,
  setSelectedPR,
}) {

  function getMph(time, distanceMiles) {
    if (!time || !distanceMiles) return null;

    // assumes `time` is stored in minutes
    const hours = time / 60;
    if (hours <= 0) return null;

    return (distanceMiles / hours).toFixed(1);
  }


  return (
    <div className="profile-panel pr-panel">
    <div className="panel-title">🎖️ PRs</div>
    {selectedPR && selectedPR.date && (
      <div className="pr-selected-date">
        {selectedPR.label} PR: {formatDate(selectedPR.date)}
        {selectedPR.time && selectedPR.distanceMiles && (
          <> • {getMph(selectedPR.time, selectedPR.distanceMiles)} mph</>
        )}
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
                  time: prs.mile.time,
                  distanceMiles: 1,
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
                  time: prs.fiveK.time,
                  distanceMiles: 3.10686,
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
                      time: prs.tenK.time,
                      distanceMiles: 6.21371,
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
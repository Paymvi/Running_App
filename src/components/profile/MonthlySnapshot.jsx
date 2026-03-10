import React from "react";
import { getEasyZone } from "../../utils/profileHelpers";

export default function MonthlySnapshot({
  monthlySnapshot,
  showTrends,
  setShowTrends,
}) {
  return (
    <div className="profile-section">

        <h2
            className="section-title clickable"
            onClick={() => setShowTrends((prev) => !prev)}
        >
            Monthly snapshot
        </h2>

        <div className="month-snap-row">
        {monthlySnapshot.map((m, i) => {
            const zone = getEasyZone(m.pctEasy);

            return (
                <div key={i} className="month-card">
                <div className="month-title">{m.month}</div>

                {/* HERO METRIC */}
                <div className="month-hero">
                {m.mileage} mi

                {showTrends && m.mileageDelta !== null && (
                <div
                    className={`trend ${
                    m.mileageDelta > 0
                        ? "trend-up"
                        : m.mileageDelta < 0
                        ? "trend-down"
                        : "trend-neutral"
                    }`}
                >
                    {m.mileageDelta > 0 && "▲ "}
                    {m.mileageDelta < 0 && "▼ "}
                    {m.mileageDelta !== 0 && `${Math.abs(m.mileageDelta).toFixed(1)} mi`}
                    {m.mileageDelta === 0 && "No change"}
                </div>
                )}
                </div>

                {/* Easy % with color meaning */}
                <div className={`easy-pill ${zone.className}`}>
                    <span className="easy-percent">{m.pctEasy}% Easy</span>
                    <span className="easy-label">{zone.label}</span>
                </div>

                    {/* {showTrends && m.easyDelta !== null && (
                    <div
                        className={`trend-small ${
                        m.easyDelta > 0
                            ? "trend-up"
                            : m.easyDelta < 0
                            ? "trend-down"
                            : "trend-neutral"
                        }`}
                    >
                        {m.easyDelta > 0 && "▲ "}
                        {m.easyDelta < 0 && "▼ "}
                        {m.easyDelta !== 0 && `${Math.abs(m.easyDelta)}% vs last month`}
                    </div>
                    )} */}

                <div className="month-secondary">
                    <div className="metric-row">
                    <span>Avg Easy Pace</span>
                    <span>{m.avgEasy}</span>
                    </div>

                    <div className="metric-row">
                    <span>Longest Run</span>
                    <span>{m.longest} mi</span>
                    </div>
                </div>
                </div>
            );
            })}
        </div>
    </div>

); 
                
}
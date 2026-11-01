import React, { useEffect, useMemo, useRef, useState } from "react";
import { prefersReducedMotion, vibrate } from "../../utils/feedback";
import { distLabel, toDisplay } from "../../utils/units";
import { formatHoursMinsFromMinutes } from "../../utils/profileHelpers";

// `weeks[].miles` is in miles; the chart plots and labels the display unit.
export default function WeeklyMileage({
  weeks: weeksInMiles = [],
  selectedIndex = 0,
  onSelect,
  scaleMode = "dynamic",
  unit = "mi",
}) {
  const weeks = useMemo(
    () => weeksInMiles.map((w) => ({ ...w, miles: Number(toDisplay(w.miles, unit).toFixed(1)) })),
    [weeksInMiles, unit]
  );
  const dl = distLabel(unit);
  const scrollerRef = useRef(null);
  const [pulseIndex, setPulseIndex] = useState(null);
  const [visibleMax, setVisibleMax] = useState(4); // y-axis max for visible window

  const chartMax = useMemo(() => {
    if (!weeks.length) return 4;

    let max = 0;
    for (const w of weeks) {
      max = Math.max(max, w?.miles || 0);
    }

    return Math.max(4, Math.ceil(max), 1);
  }, [weeks]);


  // SVG coord system
    const H = 220;
    const pad = { l: 42, r: 18, t: 18, b: 34 };
    const axisW = pad.l; // fixed y-axis column width

    const innerH = H - pad.t - pad.b;

    // spacing per week (controls how wide the chart is)
    const slot = 20; // px per week (tweak to taste)
    const contextWeeks = 2; // weeks kept visible to the right of the selection when scrolling
    // const W = Math.max(520, pad.l + pad.r + (weeks.length - 1) * slot);
    const W = pad.l + pad.r + weeks.length * slot;

  const activeMax = scaleMode === "max" ? chartMax : visibleMax;

  const points = useMemo(() => {
    if (!weeks.length) return [];

    return weeks.map((w, i) => {
      const x = pad.l + i * slot;
      const safeMax = Math.max(activeMax, 1);
      const y = pad.t + (1 - (w.miles || 0) / safeMax) * innerH;
      return { x, y, miles: w.miles || 0, i };
    });
  }, [weeks, slot, pad.l, pad.t, innerH, activeMax]);
  
  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    const bottomY = pad.t + innerH;
    const start = points[0];
    const end = points[points.length - 1];
    return `
      M ${start.x.toFixed(1)} ${bottomY.toFixed(1)}
      L ${start.x.toFixed(1)} ${start.y.toFixed(1)}
      ${points
        .slice(1)
        .map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(" ")}
      L ${end.x.toFixed(1)} ${bottomY.toFixed(1)}
      Z
    `;
  }, [points, innerH, pad.t]);

  const selectedPoint = points[selectedIndex] || null;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !weeks.length) return;

    // fixed mode uses chartMax directly (see activeMax)
    if (scaleMode === "max") return;

    const computeVisible = () => {
      const scrollLeft = el.scrollLeft;
      const viewW = el.clientWidth;

      const startX = scrollLeft;          // visible left (in px of the SVG container)
      const endX = scrollLeft + viewW;    // visible right

      // Convert visible pixel window to index window
      const firstIdx = Math.max(0, Math.floor((startX - pad.l) / slot));
      const lastIdx = Math.min(
        weeks.length - 1,
        Math.ceil((endX - pad.l) / slot)
      );

      let max = 0;
      for (let i = firstIdx; i <= lastIdx; i++) {
        max = Math.max(max, weeks[i]?.miles || 0);
      }

      // nice rounding: at least 4, round up to nearest 1
      // const next = Math.max(4, Math.ceil(max) || 4);
      const next = Math.max(4, Math.ceil(max), 1);
      setVisibleMax(next);
    };

    computeVisible();

    el.addEventListener("scroll", computeVisible, { passive: true });
    // Container size can change without a window resize (layout, rotation).
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(computeVisible) : null;
    observer?.observe(el);

    return () => {
      el.removeEventListener("scroll", computeVisible);
      observer?.disconnect();
    };
  }, [weeks, pad.l, slot, scaleMode]);

    useEffect(() => {
    const el = scrollerRef.current;
        if (!el) return;

        if (selectedIndex == null) return;

        const x = pad.l + selectedIndex * slot;
        const left = el.scrollLeft;
        const right = left + el.clientWidth;

        // Only scroll when the selected week is off screen (or at the edge).
        if (x - slot >= left && x + slot * contextWeeks <= right) return;

        el.scrollTo({
            left: Math.max(0, x + slot * contextWeeks - el.clientWidth),
            behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
    }, [selectedIndex, pad.l, slot, contextWeeks]);

  const select = (i) => {
    onSelect?.(i);
    vibrate(12); // short subtle tap
    setPulseIndex(i);
    setTimeout(() => setPulseIndex(null), 220);
  };

  // Arrow keys move the selected week; the page header shows its totals.
  const onKeyDown = (e) => {
    if (!weeks.length) return;
    const current = selectedIndex ?? weeks.length - 1;
    const next =
      e.key === "ArrowLeft" ? current - 1 :
      e.key === "ArrowRight" ? current + 1 :
      e.key === "Home" ? 0 :
      e.key === "End" ? weeks.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    onSelect?.(Math.max(0, Math.min(weeks.length - 1, next)));
  };

  const selectedWeek = weeks[selectedIndex];

  return (
    <div className="weekly-card">
      <div className="weekly-top">
        {/* <div className="weekly-title">Weekly mileage</div> */}
      </div>

        
    <div className="weekly-chart-row">
        {/* LEFT: sticky Y axis */}
        <div className="weekly-yaxis">
            <svg
            width={axisW}
            height={H}
            viewBox={`0 0 ${axisW} ${H}`}
            className="weekly-axis-svg"
            aria-hidden="true"
            >
            {/* top label */}
            <text x="8" y={pad.t} className="weekly-axis">
              {Math.round(activeMax)} {dl}
            </text>

            {/* bottom label */}
            <text
                x="12"
                y={pad.t + innerH - 2}
                className="weekly-axis"
                dominantBaseline="middle"
            >
            0 {dl}
            </text>

            </svg>
        </div>

        {/* RIGHT: scrolling chart */}
        <div
            className="weekly-chart-scroll"
            ref={scrollerRef}
            tabIndex={0}
            role="group"
            aria-label={`Weekly mileage chart, ${weeks.length} weeks. Use left and right arrow keys to choose a week.${
              selectedWeek ? ` Selected: ${selectedWeek.label}, ${selectedWeek.miles} ${dl}.` : ""
            }`}
            onKeyDown={onKeyDown}
        >
            <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            className="weekly-svg"
            shapeRendering="geometricPrecision"
            aria-hidden="true"
            >
            <defs>
                <linearGradient id="weeklyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(252,76,2,0.40)" />
                <stop offset="100%" stopColor="rgba(252,76,2,0.06)" />
                </linearGradient>
            </defs>

            {/* area */}
            {points.length > 0 && (
                <path
                    d={areaPath}
                    fill="url(#weeklyFill)"
                    className="weekly-area"
                />
            )}

            {/* line */}
            {points.length > 0 && (
                <path
                d={linePath}
                fill="none"
                stroke="rgb(252,76,2)"
                strokeWidth="2.5"
                className="weekly-line"
                />
            )}

            {/* selected marker */}
            {selectedPoint && (
                <line
                className="weekly-marker"
                x1="0"
                x2="0"
                y1={pad.t}
                y2={pad.t + innerH}
                transform={`translate(${selectedPoint.x},0)`}
                stroke="rgba(252,76,2,0.85)" // orange
                strokeWidth="2"
                />
            )}

            {/* dots */}
            {points.map((p) => {
                const isSel = p.i === selectedIndex;
                return (
                <g
                    key={p.i}
                    className={`weekly-dot clickable ${
                      pulseIndex === p.i ? "weekly-dot-pulse" : ""
                    }`}
                    onClick={() => select(p.i)}
                >
                    {/* larger invisible touch target */}
                    <circle cx={p.x} cy={p.y} r={slot / 2} fill="transparent" />
                    <circle
                    cx={p.x}
                    cy={p.y}
                    r={4} // size of orange circle
                    className="weekly-circle weekly-dot-anim"
                    fill={isSel ? "rgb(252,76,2)" : "rgba(252,76,2,0.35)"}
                    stroke="rgb(252,76,2)"
                    strokeWidth={isSel ? 2 : 1.5}
                    />
                </g>
                );
            })}

            {/* Month labels */}
            {weeks.map((w, i) => {
                const prev = weeks[i - 1];
                const wDate = w.weekStart;
                const prevDate = prev?.weekStart;

                const isNewMonth =
                !prevDate ||
                wDate.getMonth() !== prevDate.getMonth() ||
                wDate.getFullYear() !== prevDate.getFullYear();

                if (!isNewMonth) return null;

                const x = pad.l + i * slot;
                const label = wDate
                .toLocaleString("en-US", { month: "short" })
                .toUpperCase();

                return (
                <text
                    key={`m-${i}`}
                    x={x}
                    y={H - 8}
                    textAnchor="middle"
                    className="weekly-month"
                >
                    {label}
                </text>
                );
            })}
            </svg>
        </div>
    </div>

    {/* Text alternative to the chart: every week's numbers, newest first. */}
    <details className="chart-data">
        <summary>Show weekly data as a table</summary>
        <table>
            <caption>Run distance per week (Monday–Sunday), completed runs only</caption>
            <thead>
                <tr>
                    <th scope="col">Week</th>
                    <th scope="col">Distance ({dl})</th>
                    <th scope="col">Time</th>
                </tr>
            </thead>
            <tbody>
                {[...weeks].reverse().map((w) => (
                    <tr key={w.label}>
                        <th scope="row">{w.label}</th>
                        <td>{w.miles}</td>
                        <td>{formatHoursMinsFromMinutes(w.minutes || 0)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </details>
        
    </div>
  );
}

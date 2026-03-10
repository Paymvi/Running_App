import React, { useEffect, useMemo, useRef, useState } from "react";

export default function WeeklyMileage({
  weeks = [],
  selectedIndex = 0,
  onSelect,
  scaleMode = "dynamic",
}) {
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
    const visibleWeeks = 4; // about 3 months
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

    // fixed mode = always use highest week across the full chart
    if (scaleMode === "max") {
      setVisibleMax(chartMax);
      return;
    }

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
    window.addEventListener("resize", computeVisible);

    return () => {
      el.removeEventListener("scroll", computeVisible);
      window.removeEventListener("resize", computeVisible);
    };
  }, [weeks, pad.l, slot, scaleMode, chartMax]);

    useEffect(() => {
    const el = scrollerRef.current;
        if (!el) return;

        if (selectedIndex == null) return;

        const newestX = pad.l + selectedIndex * slot;

        // show the last ~3 months by default
        const scrollTarget = newestX - visibleWeeks * slot + slot * 2;

        el.scrollTo({
            left: Math.max(0, scrollTarget),
            behavior: "smooth",
        });
    }, [selectedIndex, pad.l, slot, visibleWeeks]);

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
              {Math.round(activeMax)} mi
            </text>

            {/* bottom label */}
            <text
                x="12"
                y={pad.t + innerH - 2}
                className="weekly-axis"
                dominantBaseline="middle"
            >
            0 mi
            </text>

            </svg>
        </div>

        {/* RIGHT: scrolling chart */}
        <div className="weekly-chart-scroll" ref={scrollerRef}>
            <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            className="weekly-svg"
            shapeRendering="geometricPrecision"
            role="img"
            aria-label="Weekly mileage chart"
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
                    onClick={() => {
                      onSelect?.(p.i);

                      // mobile haptic feedback
                      if (navigator.vibrate) {
                        navigator.vibrate(12); // short subtle tap
                      }

                      setPulseIndex(p.i);

                      setTimeout(() => {
                        setPulseIndex(null);
                      }, 220);
                    }}
                >
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
        
    </div>
  );
}

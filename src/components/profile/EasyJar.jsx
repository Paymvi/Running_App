import React, { useMemo } from "react";

export default function EasyJar({ runs = [], title = "Easy Jar", subtitle }) {
  // SVG coordinate system
  const W = 240;
  const H = 220;

  // jar interior bounds (where balls can be placed)
    const inner = {
        x: 40,
        y: 45,
        w: 160,
        h: 150,
    };

  // compute max duration for brightness scaling
  const durations = runs.map((r) => r.duration || 0).filter(Boolean);
  const maxDur = Math.max(30, ...durations); // at least 30 so it doesn't blow out

  // place circles with a simple deterministic packing attempt
  const circles = useMemo(() => {
    const placed = [];

    if (!runs.length) return placed;

    const rowGap = 4;

    // scale radius based on duration
    const radii = runs.map((r) => {
        const dur = r.duration || 0;
        const t = Math.min(1, dur / 75);
        return 7 + t * 4;
    });

    const bottomY = inner.y + inner.h - 4;
    let currentY = bottomY;

    let row = [];
    let rowWidth = 0;

    for (let i = 0; i < runs.length; i++) {
        const r = runs[i];
        const rad = radii[i];

        if (row.length === 0) {
        row.push({ r, rad });
        rowWidth = rad * 2;
        continue;
        }

        const nextWidth = rowWidth + rowGap + rad * 2;

        // prevent overflow near jar shoulders
        if (nextWidth > inner.w - 24) {
        const startX = inner.x + (inner.w - rowWidth) / 2;
        let xCursor = startX;

        for (const item of row) {
            placed.push({
            cx: xCursor + item.rad,
            cy: currentY - item.rad,
            r: item.rad,
            data: item.r,
            });

            xCursor += item.rad * 2 + rowGap;
        }

        currentY -= Math.max(...row.map((x) => x.rad)) * 2 + rowGap;

        row = [{ r, rad }];
        rowWidth = rad * 2;
        } else {
        row.push({ r, rad });
        rowWidth = nextWidth;
        }
    }

    // render last row
    if (row.length > 0) {
        const startX = inner.x + (inner.w - rowWidth) / 2;
        let xCursor = startX;

        for (const item of row) {
        placed.push({
            cx: xCursor + item.rad,
            cy: currentY - item.rad,
            r: item.rad,
            data: item.r,
        });

        xCursor += item.rad * 2 + rowGap;
        }
    }

    return placed.map((p) => {
        const dur = p.data.duration || 0;
        const tDur = Math.max(0, Math.min(1, dur / maxDur));
        const alpha = 0.25 + tDur * 0.75;

        return {
        cx: p.cx,
        cy: p.cy,
        r: p.r,
        fill: `rgba(252,76,2,${alpha})`, // orange
        glow: tDur,
        key: p.data.key,
        label: p.data.label,
        dur,
        miles: p.data.miles,
        date: p.data.date,
        };
    });
    }, [runs, maxDur]);

  return (
    <div className="jar-card">
      <div className="jar-head">
        <div className="jar-title">{title}</div>
        <div className="jar-sub">{subtitle}</div>
      </div>

      <div className="jar-wrap" aria-label="Easy Run Jar">
        <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            className="jar-svg">
          {/* Glow filter */}
          <defs>
            <filter id="ballGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Glass gradient */}
            <linearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.20)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
            </linearGradient>
          </defs>

          {/* Jar outline */}
          <path
            className="jar-glass"
            d="
            M70 35
            Q70 25 80 25
            L160 25
            Q170 25 170 35
            L170 45
            Q170 55 180 60
            Q200 70 200 95
            L200 185
            Q200 205 180 205
            L60 205
            Q40 205 40 185
            L40 95
            Q40 70 60 60
            Q70 55 70 45
            Z
            "
          />

          {/* Glass highlight */}
          <path
            className="jar-highlight"
            d="M110 78 Q105 120 110 175"
          />

          {/* Balls */}
          {circles.map((c) => (
            <g key={c.key} filter={c.glow > 0.75 ? "url(#ballGlow)" : undefined}>
              <circle
                cx={c.cx}
                cy={c.cy}
                r={c.r}
                fill={c.fill}
                className="jar-ball"
              />
              {/* tiny specular highlight */}
              <circle
                cx={c.cx - c.r * 0.25}
                cy={c.cy - c.r * 0.25}
                r={Math.max(1.6, c.r * 0.25)}
                fill="rgba(255,255,255,0.35)"
              />
            </g>
          ))}

          {/* Base shadow */}
          <ellipse cx="170" cy="208" rx="95" ry="10" className="jar-shadow" />
        </svg>

        {runs.length === 0 && (
          <div className="jar-empty">
            Add an <b>EASY</b> run to drop a ball 🫙
          </div>
        )}
      </div>
    </div>
  );
}
import React from "react";

// One constellation drawn into a size×size box at (x, y) of the parent <svg>.
// Lit stars are solid and fixed-size; the rest are faint guide points. A line is solid once
// both of its stars are lit, faint and dashed until then.
// With `onSelectStar`, each lit star is a keyboard-focusable button.
export default function ConstellationFigure({
  constellation,
  x = 0,
  y = 0,
  size = 200,
  dim = false,
  highlightIndex = null,
  selectedIndex = null,
  onSelectStar,
  describeStar,
}) {
  const { shape, stars } = constellation;
  const lit = stars.length;
  const r = size >= 120 ? 4.5 : 2.6;
  const pt = (i) => [x + (shape.points[i][0] * size) / 100, y + (shape.points[i][1] * size) / 100];

  return (
    <g className={dim ? "cst-figure cst-dim" : "cst-figure"}>
      {shape.lines.map(([a, b]) => {
        const [x1, y1] = pt(a);
        const [x2, y2] = pt(b);
        const earned = a < lit && b < lit;
        const isNew = earned && (a === highlightIndex || b === highlightIndex);
        return (
          <line
            key={`${a}-${b}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            pathLength={isNew ? 1 : undefined}
            className={earned ? (isNew ? "cst-line cst-line-new" : "cst-line") : "cst-line-guide"}
          />
        );
      })}

      {shape.points.map((_, i) => {
        const [cx, cy] = pt(i);
        if (i >= lit) return <circle key={i} cx={cx} cy={cy} r={r - 0.8} className="cst-guide" />;

        const day = stars[i];
        const star = <circle cx={cx} cy={cy} r={r} className={`cst-star cst-${day.type}${i === highlightIndex ? " cst-star-new" : ""}`} />;
        if (!onSelectStar) return <g key={i}>{star}</g>;

        const selected = i === selectedIndex;
        const toggle = () => onSelectStar(selected ? null : i);
        return (
          <g
            key={i}
            role="button"
            tabIndex={0}
            className="cst-hit"
            aria-label={describeStar(day, i)}
            aria-pressed={selected}
            onClick={toggle}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggle();
              }
            }}
          >
            <circle cx={cx} cy={cy} r={12} className="cst-hit-area" />
            <circle cx={cx} cy={cy} r={r + 3.5} className={selected ? "cst-ring cst-ring-on" : "cst-ring"} />
            {star}
          </g>
        );
      })}
    </g>
  );
}

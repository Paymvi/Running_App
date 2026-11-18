import React, { useState } from "react";
import ConstellationFigure from "./ConstellationFigure";
import { STARS_PER_CONSTELLATION, TYPE_LABELS, shapeFor } from "../../utils/motivation";
import { TYPES, formatDuration } from "../../utils/activityModel";
import { formatDisplayDate } from "../../utils/dateUtils";
import { formatDistance } from "../../utils/units";

// Faint background stars (decoration only).
const DUST = [[226, 20], [300, 52], [36, 196], [120, 218], [262, 214], [8, 92], [190, 12], [306, 140], [150, 120], [96, 8]];

const measure = (a, unit) => (a.miles > 0 ? formatDistance(a.miles, unit) : a.minutes > 0 ? formatDuration(a.minutes) : "");
const typesOf = (day) => [...new Set(day.activities.map((a) => TYPE_LABELS[a.type] || a.type))].join(", ");

// The Constellations module on Profile: the constellation being filled, the completed ones of
// this season sky dimmed beside it, what counts, and an inspectable star list.
export default function ConstellationSky({ sky, starColors = "type", unit = "mi", action, onOpenAtlas }) {
  const [selected, setSelected] = useState(null);
  const { current, currentSky, completedConstellations, skyIndex } = sky;
  const lit = current.stars.length;
  const day = selected !== null && selected < lit ? current.stars[selected] : null;

  const shownTypes = new Set([...current.stars, ...currentSky.flatMap((c) => c.stars)].map((d) => d.type));
  const legend = TYPES.filter((t) => shownTypes.has(t));

  let note = "";
  if (lit === 0 && completedConstellations === 0) note = "Log any completed workout to light your first star.";
  else if (lit === 0 && currentSky.length === 0) note = `Season sky ${skyIndex} is complete and saved in the Star Atlas. A new sky begins.`;
  else if (lit === 0) note = `${shapeFor(completedConstellations - 1).name} complete. Next up: ${current.shape.name}.`;

  return (
    <div className={`jar-card cst-card${starColors === "white" ? " cst-white" : ""}`}>
      <div className="jar-head">
        <div className="jar-title">Constellations</div>
        <div className="jar-head-side">{action}</div>
      </div>

      <svg viewBox="0 0 320 228" className="cst-svg" role="group" aria-label={`${current.shape.name}: ${lit} of ${STARS_PER_CONSTELLATION} stars lit`}>
        {DUST.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={0.9} className="cst-dust" />
        ))}
        <ConstellationFigure
          constellation={current}
          x={14}
          y={14}
          size={200}
          selectedIndex={selected}
          onSelectStar={setSelected}
          describeStar={(d, i) => `Star ${i + 1}: ${formatDisplayDate(d.date)}, ${typesOf(d)}`}
        />
        {currentSky.map((c, i) => (
          <ConstellationFigure key={c.index} constellation={c} x={248} y={12 + i * 74} size={60} dim />
        ))}
      </svg>

      <div className="cst-detail" aria-live="polite">
        {day && (
          <>
            <b>{formatDisplayDate(day.date)}</b>
            {day.activities.map((a) => (
              <span key={a.id}>
                {TYPE_LABELS[a.type] || a.type}
                {a.title && a.title.trim().toLowerCase() !== a.type ? ` · ${a.title}` : ""}
                {measure(a, unit) ? ` · ${measure(a, unit)}` : ""}
              </span>
            ))}
          </>
        )}
      </div>

      <div className="cst-status">
        {current.shape.name} · {lit}/{STARS_PER_CONSTELLATION} stars
      </div>
      <div className="cst-explain">One star per day with any completed workout.{lit > 0 && " Select a star to see that day."}</div>
      {note && <div className="cst-note">{note}</div>}

      <div className="cst-foot">
        {starColors === "type" && legend.length > 0 && (
          <ul className="cst-legend" aria-label="Star colours">
            {legend.map((t) => (
              <li key={t}>
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                  <circle cx="5" cy="5" r="4.5" className={`cst-star cst-${t}`} />
                </svg>
                {TYPE_LABELS[t]}
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="cst-atlas-btn" onClick={onOpenAtlas} aria-haspopup="dialog">
          Star Atlas →
        </button>
      </div>
    </div>
  );
}

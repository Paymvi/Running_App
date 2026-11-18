import React from "react";
import ConstellationFigure from "./ConstellationFigure";
import useDialog from "../../hooks/useDialog";
import { STARS_PER_CONSTELLATION } from "../../utils/motivation";
import { formatDisplayDate } from "../../utils/dateUtils";

// Every season sky (four constellations each), newest first. The sky in progress is included.
export default function StarAtlasModal({ sky, starColors = "type", onClose }) {
  const dialogRef = useDialog(true, onClose);

  return (
    <div className="jar-modal-backdrop" onClick={onClose}>
      <div
        className={`jar-modal${starColors === "white" ? " cst-white" : ""}`}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="star-atlas-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="jar-modal-head">
          <div className="jar-modal-title" id="star-atlas-title">Star Atlas</div>
          <button type="button" className="jar-close" onClick={onClose} aria-label="Close Star Atlas">✕</button>
        </div>

        {sky.skies.length === 0 ? (
          <div className="jar-modal-empty">No stars yet. Each day you log a completed workout lights one.</div>
        ) : (
          <div className="jar-grid">
            {sky.skies.slice().reverse().map((s) => {
              const names = s.constellations.map((c) => `${c.shape.name} ${c.stars.length}/${STARS_PER_CONSTELLATION}`);
              return (
                <figure key={s.index} className="atlas-sky">
                  <svg viewBox="0 0 220 220" className="cst-svg atlas-svg" role="img" aria-label={`Season sky ${s.index + 1}: ${names.join(", ")}`}>
                    {s.constellations.map((c, i) => (
                      <ConstellationFigure key={c.index} constellation={c} x={12 + (i % 2) * 104} y={12 + Math.floor(i / 2) * 104} size={92} />
                    ))}
                  </svg>
                  <figcaption>
                    <span><b>Season sky {s.index + 1}</b> · {s.complete ? "complete" : "in progress"}</span>
                    <span>
                      {formatDisplayDate(s.firstDate)}
                      {s.lastDate !== s.firstDate ? ` – ${formatDisplayDate(s.lastDate)}` : ""}
                    </span>
                    <span>{names.join(" · ")}</span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

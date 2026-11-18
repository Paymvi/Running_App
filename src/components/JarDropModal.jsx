import React, { useEffect, useMemo } from "react";
import EasyJar from "./profile/EasyJar";
import ConstellationFigure from "./motivation/ConstellationFigure";
import useDialog from "../hooks/useDialog";
import { buildJarGroups, JAR_SIZE } from "../utils/activityModel";
import { buildSky, findStar, STARS_PER_CONSTELLATION } from "../utils/motivation";
import { playSound, vibrate } from "../utils/feedback";

// Celebrates one newly created activity that added progress to the selected module
// (celebrationFor in motivation.js decides): a ball dropping into its jar, or a new star
// lighting in its constellation. Backdated activities show the older jar or constellation.
// `celebration` is { id, kind: "jar" | "constellations", settings }.
export default function JarDropModal({ celebration, activities, onClose }) {
  const activityId = celebration?.id ?? null;
  const kind = celebration?.kind;
  const isOpen = Boolean(activityId);

  const content = useMemo(() => {
    if (!activityId) return null;
    if (kind === "constellations") return findStar(buildSky(activities), activityId);
    const group = buildJarGroups(activities).groups.find((g) => g.some((r) => r.id === activityId)) || [];
    const index = group.findIndex((r) => r.id === activityId);
    return group.length ? { runs: group, animatedIndex: index >= 0 ? index : null } : null;
  }, [activityId, kind, activities]);

  const dialogRef = useDialog(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;

    const soundTimer = setTimeout(() => {
      playSound("/activity-save.mp3");
      vibrate([80, 40, 120]);
    }, 1100);

    const closeTimer = setTimeout(() => {
      onClose();
    }, 2100);

    return () => {
      clearTimeout(soundTimer);
      clearTimeout(closeTimer);
    };

  }, [isOpen, onClose]);

  if (!isOpen || !content) return null;

  const { animations = true, starColors = "type" } = celebration.settings || {};
  const motion = animations ? "" : " motion-off";

  if (kind === "constellations") {
    const { constellation, starIndex } = content;
    const lit = constellation.stars.length;
    return (
      <div className="jar-drop-backdrop" onClick={onClose}>
        <div
          className={`jar-drop-modal${motion}${starColors === "white" ? " cst-white" : ""}`}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="jar-drop-title"
        >
          <div className="jar-drop-title" id="jar-drop-title">New star ✦</div>
          <div className="jar-sub">
            {constellation.shape.name} · {lit}/{STARS_PER_CONSTELLATION} stars{lit === STARS_PER_CONSTELLATION ? " · constellation complete!" : ""}
          </div>
          <svg viewBox="0 0 228 228" className="cst-svg" role="img" aria-label={`${constellation.shape.name}: ${lit} of ${STARS_PER_CONSTELLATION} stars lit`}>
            <ConstellationFigure constellation={constellation} x={14} y={14} size={200} highlightIndex={starIndex} />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="jar-drop-backdrop" onClick={onClose}>
      <div
        className={`jar-drop-modal${motion}`}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="jar-drop-title"
      >

        <div className="jar-drop-title" id="jar-drop-title">
          Easy run added 🫙
        </div>

        <EasyJar
          title="Easy Run Jar"
          subtitle={`${content.runs.length}/${JAR_SIZE} balls${content.runs.length === JAR_SIZE ? " · jar complete!" : ""}`}
          runs={content.runs}
          animatedIndex={content.animatedIndex}
        />

      </div>
    </div>
  );
}

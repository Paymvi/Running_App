import React, { useEffect, useMemo } from "react";
import EasyJar from "./profile/EasyJar";
import useDialog from "../hooks/useDialog";
import { buildJarGroups, JAR_SIZE } from "../utils/activityModel";
import { playSound, vibrate } from "../utils/feedback";

// Celebrates one newly created easy run: shows the jar that run landed in
// (which may be an older jar if the run was backdated) and animates its ball.
export default function JarDropModal({ activityId, activities, onClose }) {
  const isOpen = Boolean(activityId);

  const { runs, animatedIndex } = useMemo(() => {
    if (!activityId) return { runs: [], animatedIndex: null };
    const group = buildJarGroups(activities).groups.find((g) => g.some((r) => r.id === activityId)) || [];
    const index = group.findIndex((r) => r.id === activityId);
    return { runs: group, animatedIndex: index >= 0 ? index : null };
  }, [activityId, activities]);

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

  if (!isOpen || !runs.length) return null;

  return (
    <div className="jar-drop-backdrop" onClick={onClose}>
      <div
        className="jar-drop-modal"
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
          subtitle={`${runs.length}/${JAR_SIZE} balls${runs.length === JAR_SIZE ? " · jar complete!" : ""}`}
          runs={runs}
          animatedIndex={animatedIndex}
        />

      </div>
    </div>
  );
}

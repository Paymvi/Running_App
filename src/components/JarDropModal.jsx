import React, { useEffect } from "react";
import EasyJar from "./profile/EasyJar";

export default function JarDropModal({
  isOpen,
  onClose,
  runsBefore = [],
  newRun = null
}) {

  useEffect(() => {
    if (!isOpen) return;

    const soundTimer = setTimeout(() => {

      const audio = new Audio("/activity-save.mp3");
      audio.volume = 0.6;
      audio.play().catch(console.error);

      if (navigator.vibrate) {
        navigator.vibrate([80, 40, 120]);
      }

    }, 1100);

    const closeTimer = setTimeout(() => {
      onClose();
    }, 2100);

    return () => {
      clearTimeout(soundTimer);
      clearTimeout(closeTimer);
    };

  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="jar-drop-backdrop">
      <div className="jar-drop-modal">

        <div className="jar-drop-title">
          Easy run added 🫙
        </div>

        <EasyJar
          title="Easy Run Jar"
          subtitle=""
          runs={runsBefore}
          animatedDropRun={newRun}
        />

      </div>
    </div>
  );
}
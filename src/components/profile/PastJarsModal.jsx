import React from "react";
import EasyJar from "./EasyJar";
import useDialog from "../../hooks/useDialog";

export default function PastJarsModal({
  showJarHistory,
  setShowJarHistory,
  completedJars,
}) {
  const dialogRef = useDialog(showJarHistory, () => setShowJarHistory(false));

  if (!showJarHistory) return null;

  return (
<div className="jar-modal-backdrop" onClick={() => setShowJarHistory(false)}>
      <div
        className="jar-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="past-jars-title"
        onClick={(e) => e.stopPropagation()}
      >
      <div className="jar-modal-head">
          <div className="jar-modal-title" id="past-jars-title">Past Jars</div>
          <button type="button" className="jar-close" onClick={() => setShowJarHistory(false)} aria-label="Close past jars">
          ✕
          </button>
      </div>

      {completedJars.length === 0 ? (
          <div className="jar-modal-empty">
          No completed jars yet. Fill your first one 😈
          </div>
      ) : (
          <div className="jar-grid">
          {completedJars
              .slice()
              .reverse()
              .map((jar, idx) => (
              <div key={jar[0]?.key ?? idx} className="jar-thumb">
                  <EasyJar
                  title={`Jar #${completedJars.length - idx}`}
                  subtitle="25/25"
                  runs={jar}
                  />
              </div>
              ))}
          </div>
      )}
      </div>
  </div>
  );
}
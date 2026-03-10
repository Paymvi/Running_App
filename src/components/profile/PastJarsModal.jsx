import React from "react";
import EasyJar from "./EasyJar";

export default function PastJarsModal({
  showJarHistory,
  setShowJarHistory,
  completedJars,
}) {
  if (!showJarHistory) return null;

  return (
<div className="jar-modal-backdrop" onClick={() => setShowJarHistory(false)}>
      <div className="jar-modal" onClick={(e) => e.stopPropagation()}>
      <div className="jar-modal-head">
          <div className="jar-modal-title">Past Jars</div>
          <button className="jar-close" onClick={() => setShowJarHistory(false)}>
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
              <div key={idx} className="jar-thumb">
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
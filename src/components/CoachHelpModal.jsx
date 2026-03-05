import React, { useEffect } from "react";

export default function CoachHelpModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Coach alerts help"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          borderRadius: 14,
          background: "#12141b",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
          padding: 16,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            👻 Coach Alerts... how it works
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              color: "rgba(255,255,255,0.85)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 10,
              padding: "6px 10px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ opacity: 0.92, lineHeight: 1.45, fontSize: 10 }}>
          <p style={{ marginTop: 0 }}>
            Coach alerts are <strong>automatic training notes</strong> based on your recent
            activities. They’re meant to help you avoid “silent” mistakes like pace creep,
            too much intensity, or big mileage jumps.
          </p>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              🎯 What the coach looks for
            </div>

            <ul style={{ marginTop: 0, paddingLeft: 18, lineHeight: 1.5 }}>

                <li>
                🔴 <strong>Easy run felt hard</strong>: you marked a run “easy” but it felt “hard”.
                </li>

                <li>
                🔴 <strong>Back-to-back hard efforts</strong>: two hard workouts in a row (tempo / intervals / race / hard).
                </li>

                <li>
                🔴 <strong>Easy pace creep</strong>: your “easy” run pace was much faster than your recent easy baseline and felt medium or hard.
                </li>

                <li>
                🟡 <strong>Too many hard efforts</strong>: 3 or more hard workouts in the last 7 days.
                </li>

                <li>
                🟡 <strong>Mileage spike</strong>: your weekly mileage jumped ~25% or more compared to last week.
                </li>

                <li>
                🟡 <strong>No-rest pattern</strong>: you ran 5 or more of the last 6 days.
                </li>

                <li>
                🟡 <strong>Easy pace drift</strong>: your recent easy runs are faster than your baseline and feel tougher (possible fatigue or ego pacing).
                </li>

                <li>
                🟡 <strong>Wall pattern</strong>: your last several runs are almost the same distance (within ~0.6 miles) and under ~4 miles.
                </li>

                <li>
                🟡 <strong>Intensity imbalance</strong>: less than ~45% of your runs this week were easy.
                </li>

                <li>
                🟢 <strong>High easy-run discipline</strong>: ~75% or more of your runs this week were easy.
                </li>

                <li>
                🟢 <strong>Stable mileage week</strong>: your weekly mileage stayed within ~15% of last week.
                </li>

                <li>
                🟢 <strong>Comeback run</strong>: you returned to running after a gap of 7+ days.
                </li>

                <li>
                🔵 <strong>Long run overdue</strong>: you log long runs but haven’t done one in 14+ days.
                </li>

                <li>
                🔵 <strong>Next move: easy reset</strong>: your last run was hard, so the coach suggests an easy day next.
                </li>

                <li>
                🔵 <strong>General consistency note</strong>: when nothing unusual is detected, the coach gives a simple consistency reminder.
                </li>

            </ul>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              🎚️ How selection works (when multiple alerts apply)
            </div>

            <ul style={{ marginTop: 6, paddingLeft: 18, display: "grid", gap: 3 }}>
              <li>
                The coach generates a list of alerts that match your data.
              </li>
              <li>
                Alerts are sorted by <strong>priority</strong>:
                <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                  <div>
                    <span style={{ fontWeight: 700 }}>🟥 Red</span>:  highest priority (risk / burnout / “stop digging” signals)
                  </div>
                  <div>
                    <span style={{ fontWeight: 700 }}>🟡 Yellow</span>:  caution (could become a problem soon)
                  </div>
                  <div>
                    <span style={{ fontWeight: 700 }}>🟢 Green</span>:  praise (you’re doing something right)
                  </div>
                  <div>
                    <span style={{ fontWeight: 700 }}>🔵 Blue</span>:  info / next best move
                  </div>
                </div>
              </li>
              <li>
                Then your “Coach alerts shown” setting chooses the <strong>top N</strong> alerts
                (so red/yellow typically appear before green/blue).
              </li>
            </ul>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              ⚠️ Important note
            </div>
            <div style={{ opacity: 0.9 }}>
              This is a coaching assistant, not medical advice. If you feel pain (sharp, worsening,
              or affecting your gait), treat it seriously.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 14,
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#1f2937",
              color: "white",
              border: "1px solid rgba(255,255,255,0.10)",
              padding: "8px 12px",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
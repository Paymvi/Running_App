import React from "react";
import useDialog from "../hooks/useDialog";

export default function CoachHelpModal({ isOpen, onClose }) {
  const dialogRef = useDialog(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Coach alerts help"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          maxHeight: "85dvh",
          overflowY: "auto",
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
          <div style={{ fontSize: 14, fontWeight: 700 }}>
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
        <div style={{ opacity: 0.92, lineHeight: 1.45, fontSize: 9 }}>
          <p style={{ marginTop: 0 }}>
            Coach alerts are <strong>automatic training notes</strong> based on your completed
            runs, looked at as of today. They’re meant to help you avoid “silent” mistakes like pace creep,
            too much intensity, or big mileage jumps.
          </p>
          <p>
            Only runs count: planned activities and other sports are ignored. Weeks run Monday–Sunday,
            and this week so far is compared with the same days of last week. Runs with
            <strong> unknown effort</strong> (for example Strava imports) are neither easy nor hard;
            when most of a week’s runs have unknown effort the coach says so instead of guessing.
            Runs without a time have no pace, so pace checks skip them. Choose “Hidden” to turn alerts off.
          </p>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              🎯 What the coach looks for
            </div>

            <ul style={{ marginTop: 0, paddingLeft: 18, lineHeight: 1.4 }}>

                <li>
                🔴 <strong>Easy run felt hard</strong>: you marked a run “easy” but it felt “hard”.
                </li>

                <li>
                🔴 <strong>Back-to-back hard efforts</strong>: two hard workouts in a row (tempo / intervals / race / hard).
                </li>

                <li>
                🔴 <strong>Easy pace creep</strong>: your latest “easy” run was much faster than your previous 10 easy runs and felt medium or hard.
                </li>

                <li>
                🟡 <strong>Too many hard efforts</strong>: 3 or more hard workouts in the last 7 days.
                </li>

                <li>
                🟡 <strong>Mileage spike</strong>: this week’s mileage so far is ~25% or more above the same days of last week.
                </li>

                <li>
                🟡 <strong>No-rest pattern</strong>: you ran 5 or more of the last 6 days.
                </li>

                <li>
                🟡 <strong>Easy pace drift</strong>: your last 5 easy runs are faster than the 10 easy runs before them and feel tougher (possible fatigue or ego pacing).
                </li>

                <li>
                🟡 <strong>Wall pattern</strong>: your last several runs are almost the same distance (within ~0.6 miles) and under ~4 miles.
                </li>

                <li>
                🟡 <strong>Intensity imbalance</strong>: ~45% or less of this week’s run distance (with a known effort) was easy.
                </li>

                <li>
                🟢 <strong>High easy-run discipline</strong>: ~75% or more of this week’s run distance (with a known effort) was easy.
                </li>

                <li>
                🟢 <strong>Stable mileage week</strong>: this week’s mileage so far is within ~15% of the same days of last week.
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
                Then your “Coach alerts” setting chooses the <strong>top N</strong> alerts
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
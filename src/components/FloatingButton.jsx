import React from "react";

export default function FloatingButton({ onClick }) {
  return (
    <button type="button" className="floating-btn" onClick={onClick} aria-label="Add activity" title="Add activity">
      +
    </button>

  );
}

import React from "react";

export default function FloatingButton({ onClick }) {
  return (
    <button className="floating-btn" onClick={onClick}>
      +
    </button>
  );
}
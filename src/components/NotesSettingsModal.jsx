import { useState, useEffect } from "react";

export default function NotesSettingsModal({ card, onClose, onSave }) {
  const [title, setTitle] = useState(card?.title || "");
  const [height, setHeight] = useState(card?.height || 380);
  const [fontSize, setFontSize] = useState(card?.fontSize || 12);

  useEffect(() => {
    if (card) {
      setTitle(card.title || "");
      setHeight(card.height || 380);
      setFontSize(card.fontSize || 12);
    }
  }, [card]);

  if (!card) return null;

  const handleSave = () => {
    const cleanedTitle = title.trim() || `Notes ${card.id}`;
    const cleanedHeight = Math.max(120, Number(height) || 380);
    const cleanedFontSize = Math.max(8, Number(fontSize) || 12);

    onSave(card.id, {
      title: cleanedTitle,
      height: cleanedHeight,
      fontSize: cleanedFontSize,
    });

    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="notes-settings-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Notes Settings</h2>

        <div className="notes-settings-row">
          <label>Name</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter note name"
          />
        </div>

        <div className="notes-settings-row">
          <label>Box Height (px)</label>
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            min="120"
          />
        </div>

        <div className="notes-settings-row">
          <label>Font Size (px)</label>
          <input
            type="number"
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
            min="8"
          />
        </div>

        <div className="notes-settings-preview">
          <p><strong>Preview</strong></p>
          <p>[{title.trim() || `Notes ${card.id}`}] [{height || 380}px] [{fontSize || 12}px]</p>
        </div>

        <div className="notes-settings-actions">
          <button className="secondary-btn" onClick={onClose}>
            Cancel
          </button>

          <button className="secondary-btn" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
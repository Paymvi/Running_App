import { useState } from "react";
import useDialog from "../hooks/useDialog";

export default function NotesSettingsModal({ card, onClose, onSave }) {
  const [title, setTitle] = useState(card?.title || "");
  const [height, setHeight] = useState(card?.height || 380);
  const [fontSize, setFontSize] = useState(card?.fontSize || 12);
  const dialogRef = useDialog(Boolean(card), onClose);

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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notes-settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="notes-settings-title">Notes Settings</h2>

        <div className="notes-settings-row">
          <label htmlFor="notes-settings-name">Name</label>
          <input
            id="notes-settings-name"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter note name"
          />
        </div>

        <div className="row">

            <div className="notes-settings-row">
            <label htmlFor="notes-settings-height">Box Height (px)</label>
            <input
                id="notes-settings-height"
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                min="120"
            />
            </div>

            <div className="notes-settings-row">
            <label htmlFor="notes-settings-font">Font Size (px)</label>
            <input
                id="notes-settings-font"
                type="number"
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value)}
                min="8"
            />
            </div>

        </div>
        
        {/*
        <div className="notes-settings-preview">
          <p><strong>Preview</strong></p>
          <p>[{title.trim() || `Notes ${card.id}`}] [{height || 380}px] [{fontSize || 12}px]</p>
        </div> */}

        <div className="notes-settings-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Cancel
          </button>

          <button type="button" className="secondary-btn" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
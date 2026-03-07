import { useState, useEffect, useRef } from "react";
import RunCalendar from "../components/RunCalendar";

function createEmptyNote(id) {
  return {
    id,
    text: "",
    isOpen: false,
  };
}

export default function Home() {
  const [activities, setActivities] = useState([]);
  const [noteCards, setNoteCards] = useState([createEmptyNote(1)]);
  const fileInputRefs = useRef({});

  useEffect(() => {
    const savedActivities = localStorage.getItem("activities");
    if (savedActivities) {
      setActivities(JSON.parse(savedActivities));
    }

    const savedNoteCards = localStorage.getItem("homeNoteCards");

    if (savedNoteCards) {
      const parsed = JSON.parse(savedNoteCards);

      if (Array.isArray(parsed) && parsed.length > 0) {
        setNoteCards(parsed);
      }
    } else {
      // fallback from old single-note version
      const oldSavedNotes = localStorage.getItem("homeNotes");
      if (oldSavedNotes) {
        setNoteCards([
          {
            id: 1,
            text: oldSavedNotes,
            isOpen: false,
          },
        ]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("homeNoteCards", JSON.stringify(noteCards));
  }, [noteCards]);

  const toggleNoteCard = (id) => {
    setNoteCards((prev) =>
      prev.map((card) =>
        card.id === id ? { ...card, isOpen: !card.isOpen } : card
      )
    );
  };

  const handleNotesChange = (id, value) => {
    setNoteCards((prev) =>
      prev.map((card) =>
        card.id === id ? { ...card, text: value } : card
      )
    );
  };

  const addNoteCard = () => {
    const newId =
      noteCards.length > 0
        ? Math.max(...noteCards.map((card) => card.id)) + 1
        : 1;

    setNoteCards((prev) => [
      ...prev,
      {
        id: newId,
        text: "",
        isOpen: true,
      },
    ]);
  };

  const removeNoteCard = (id) => {
    if (noteCards.length === 1) {
      alert("You must keep at least one notes card.");
      return;
    }

    const cardToRemove = noteCards.find((card) => card.id === id);
    if (!cardToRemove) return;

    if (cardToRemove.text.trim() !== "") {
      alert("You cannot remove a notes card that still has text in it.");
      return;
    }

    setNoteCards((prev) => prev.filter((card) => card.id !== id));
  };

  const exportNotes = (card) => {
    const today = new Date().toLocaleDateString();

    const text = `Date: ${today}

Notes:
${card.text}
`;

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `run-notes-${card.id}-${today}.txt`;
    link.click();

    URL.revokeObjectURL(url);
  };

  const handleImportClick = (id) => {
    fileInputRefs.current[id]?.click();
  };

  const handleImportNotes = (id, e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".txt")) {
      alert("Please import a .txt file only.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target.result || "";

      setNoteCards((prev) =>
        prev.map((card) =>
          card.id === id ? { ...card, text: text, isOpen: true } : card
        )
      );
    };

    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="page">
      <RunCalendar activities={activities} />

      <div className="notes-stack">
        {noteCards.map((card, index) => (
          <div key={card.id} className="notes-card">
            <div
              className="notes-header"
              onClick={() => toggleNoteCard(card.id)}
            >
              <h3>Notes {index + 1}</h3>
              <span>{card.isOpen ? "▲" : "▼"}</span>
            </div>

            {card.isOpen && (
            <div className="notes-card-body">
                <textarea
                className="notes-input"
                placeholder="Write anything: goals, thoughts, race plans..."
                value={card.text}
                onChange={(e) => handleNotesChange(card.id, e.target.value)}
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                />

                <input
                type="file"
                accept=".txt"
                ref={(el) => {
                    fileInputRefs.current[card.id] = el;
                }}
                onChange={(e) => handleImportNotes(card.id, e)}
                style={{ display: "none" }}
                />

                <div className="notes-actions">
                  <button
                    className="secondary-btn"
                    onClick={() => handleImportClick(card.id)}
                  >
                    Import Notes
                  </button>

                  <button
                    className="secondary-btn"
                    onClick={() => exportNotes(card)}
                  >
                    Export Notes
                  </button>

                  <button
                    className="secondary-btn notes-small-btn"
                    onClick={() => removeNoteCard(card.id)}
                  >
                    -
                  </button>

                  <button
                    className="secondary-btn notes-small-btn"
                    onClick={addNoteCard}
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
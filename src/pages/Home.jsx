import { useState, useEffect, useRef, useMemo } from "react";
import RunCalendar from "../components/RunCalendar";
import NotesSettingsModal from "../components/NotesSettingsModal";

import { FiCopy } from "react-icons/fi"

import WeeklyMileage from "../components/profile/WeeklyMileage";
import { useActivities } from "../utils/activityStore";
import { readJSON, describeWriteError, downloadText } from "../utils/storage";
import { formatWeekRange } from "../utils/profileHelpers";
import { formatDuration } from "../utils/activityModel";
import { isCountable } from "../utils/activityModel";
import { startOfWeekMonday, weeklyRunTotals } from "../utils/stats";
import { formatDistance, useUnit } from "../utils/units";

const NOTES_KEY = "homeNoteCards";

// "" when saved, otherwise a message to show.
function writeNotes(cards) {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(cards));
    return "";
  } catch (e) {
    return `Notes not saved: ${describeWriteError(e)}`;
  }
}

// Saved note cards (or the old single-note format), normalized.
function loadNoteCards() {
  const parsed = readJSON(NOTES_KEY, null);

  if (Array.isArray(parsed) && parsed.length > 0) {
    return parsed.map((card, index) => ({
      id: card?.id ?? index + 1,
      title: card?.title || `Notes ${index + 1}`,
      text: card?.text || "",
      isOpen: card?.isOpen ?? false,
      height: Number(card?.height) || 380,
      fontSize: Number(card?.fontSize) || 12,
    }));
  }

  // fallback from old single-note version
  let oldSavedNotes = null;
  try {
    oldSavedNotes = localStorage.getItem("homeNotes");
  } catch {
    // storage unavailable
  }
  if (oldSavedNotes) {
    return [{ id: 1, title: "Notes 1", text: oldSavedNotes, isOpen: false, height: 380, fontSize: 12 }];
  }

  return [createEmptyNote(1)];
}

function createEmptyNote(id) {
  return {
    id,
    title: `Notes ${id}`,
    text: "",
    isOpen: false,
    height: 380,
    fontSize: 12,
  };
}

export default function Home() {
    const { activities } = useActivities();
    const unit = useUnit();
    const [noteCards, setNoteCards] = useState(loadNoteCards);
    const [pendingImport, setPendingImport] = useState(null); // { id, text } awaiting Replace/Append
    const [notesSaveError, setNotesSaveError] = useState("");
    const [settingsCardId, setSettingsCardId] = useState(null);
    const fileInputRefs = useRef({});
    const [copiedCardId, setCopiedCardId] = useState(null);

    // null = follow the newest week
    const [selectedWeekIndex, setSelectedWeekIndex] = useState(null);

    const [weeklyScaleMode] = useState(() => {
      try {
        return localStorage.getItem("weeklyScaleMode") || "dynamic";
      } catch {
        return "dynamic";
      }
    });

    // Completed activities only: plans never show as done training.
    const completed = useMemo(() => activities.filter(isCountable), [activities]);

    // Weekly run mileage, Monday–Sunday, zero weeks included (shared with coaching).
    const weeklySnapshot = useMemo(
      () => weeklyRunTotals(activities).map((w) => ({ ...w, label: formatWeekRange(w.weekStart) })),
      [activities]
    );

    const effectiveWeekIndex =
      selectedWeekIndex !== null && selectedWeekIndex < weeklySnapshot.length
        ? selectedWeekIndex
        : weeklySnapshot.length - 1;

    const selectedWeek = weeklySnapshot[effectiveWeekIndex] || null;

    const isThisWeek = useMemo(() => {
      if (!selectedWeek?.weekStart) return false;

      const thisWeekStart = startOfWeekMonday(new Date());

      return (
        selectedWeek.weekStart.getFullYear() === thisWeekStart.getFullYear() &&
        selectedWeek.weekStart.getMonth() === thisWeekStart.getMonth() &&
        selectedWeek.weekStart.getDate() === thisWeekStart.getDate()
      );
    }, [selectedWeek]);

    // Debounced so typing doesn't rewrite every card on each keystroke. Edits still
    // pending are written immediately when the page is hidden/closed or Home unmounts.
    const pendingCards = useRef(null);
    useEffect(() => {
      pendingCards.current = noteCards;
      const timer = setTimeout(() => {
        pendingCards.current = null;
        setNotesSaveError(writeNotes(noteCards));
      }, 400);
      return () => clearTimeout(timer);
    }, [noteCards]);

    useEffect(() => {
      const flush = () => {
        if (!pendingCards.current) return;
        const error = writeNotes(pendingCards.current);
        pendingCards.current = null;
        setNotesSaveError(error);
      };
      const onHide = () => document.visibilityState === "hidden" && flush();
      window.addEventListener("pagehide", flush);
      document.addEventListener("visibilitychange", onHide);
      return () => {
        window.removeEventListener("pagehide", flush);
        document.removeEventListener("visibilitychange", onHide);
        flush();
      };
    }, []);

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
        title: `Notes ${newId}`,
        text: "",
        isOpen: true,
        height: 380,
        fontSize: 12,
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

  // Exactly the card's text, so importing the file back gives the same note.
  const exportNotes = (card) => {
    const safeTitle = String(card.title).replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "") || `notes-${card.id}`;
    downloadText(`${safeTitle}.txt`, card.text, "text/plain;charset=utf-8");
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
        const current = noteCards.find((card) => card.id === id);

        // A card with text asks Replace or Append (see the prompt rendered in the card).
        if (current?.text) {
          setPendingImport({ id, text });
          return;
        }
        applyImport(id, text, "replace");
        };

        reader.readAsText(file);
        e.target.value = "";
    };

    const applyImport = (id, text, mode) => {
        setNoteCards((prev) =>
            prev.map((card) =>
            card.id === id
              ? { ...card, isOpen: true, text: mode === "append" ? `${card.text}${card.text.endsWith("\n") ? "" : "\n"}${text}` : text }
              : card
            )
        );
        setPendingImport(null);
    };

    const openSettingsModal = (id) => {
        setSettingsCardId(id);
    };

    const closeSettingsModal = () => {
        setSettingsCardId(null);
    };

    const updateNoteCardSettings = (id, updates) => {
      setNoteCards((prev) =>
          prev.map((card) =>
          card.id === id ? { ...card, ...updates } : card
          )
      );
    };

    const copyNotesToClipboard = async (cardId, text) => {
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);

        setCopiedCardId(cardId);

        setTimeout(() => {
          setCopiedCardId(null);
        }, 2000);

      } catch (err) {
        console.error("Clipboard copy failed:", err);
      }
    };

  return (
    <div className="page">
      <RunCalendar activities={completed} />


      {/* WEEKLY MILEAGE */}
      <div className="profile-section home-weekly-mileage">

        <div className="weekly-header" aria-live="polite">

          <div className="weekly-header-title">
            {isThisWeek
              ? "This week"
              : selectedWeek?.label || "Weekly Mileage"}
          </div>

          <div className="weekly-stats-row">

            <div className="weekly-stat">
              <div className="weekly-stat-label">
                Distance
              </div>

              <div className="weekly-stat-value">
                {selectedWeek
                  ? formatDistance(selectedWeek.miles, unit)
                  : "-"}
              </div>
            </div>


            <div className="weekly-stat">
              <div className="weekly-stat-label">
                Time
              </div>

              <div className="weekly-stat-value">
                {selectedWeek
                  ? formatDuration(selectedWeek.minutes)
                  : "-"}
              </div>
            </div>

          </div>

        </div>


        <WeeklyMileage
          weeks={weeklySnapshot}
          selectedIndex={effectiveWeekIndex}
          onSelect={(index) => setSelectedWeekIndex(index)}
          scaleMode={weeklyScaleMode}
          unit={unit}
        />

      </div>




      <div className="notes-stack">
        {notesSaveError && (
          <div className="field-error" role="alert">{notesSaveError}</div>
        )}
        {noteCards.map((card) => (
          <div key={card.id} className="notes-card">
            <button
              type="button"
              className="notes-header"
              aria-expanded={card.isOpen}
              onClick={() => toggleNoteCard(card.id)}
            >
              <h3>{card.title}</h3>
              <span aria-hidden="true">{card.isOpen ? "▲" : "▼"}</span>
            </button>

            {card.isOpen && (
              <div className="notes-card-body">
                  <div className="notes-card-body">
                    <button
                      type="button"
                      className="notes-copy-btn"
                      onClick={() => copyNotesToClipboard(card.id, card.text)}
                      title="Copy notes"
                      aria-label="Copy notes"
                    >
                      <FiCopy />
                    </button>

                    {copiedCardId === card.id && (
                      <div className="notes-copied-msg" role="status">
                        Copied to your clipboard!
                      </div>
                    )}
                  </div>

                  <textarea
                      className="notes-input"
                      aria-label={`${card.title} text`}
                      placeholder="Write anything: goals, thoughts, race plans..."
                      value={card.text}
                      onChange={(e) => handleNotesChange(card.id, e.target.value)}
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      style={{
                          minHeight: `${card.height}px`,
                          fontSize: `${card.fontSize}px`,
                      }}
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

                {pendingImport?.id === card.id && (
                  <div className="notes-import-choice" role="group" aria-label="Imported text">
                    <span>This card already has text. Imported file:</span>
                    <button type="button" className="secondary-btn" onClick={() => applyImport(card.id, pendingImport.text, "replace")}>Replace</button>
                    <button type="button" className="secondary-btn" onClick={() => applyImport(card.id, pendingImport.text, "append")}>Append</button>
                    <button type="button" className="secondary-btn" onClick={() => setPendingImport(null)}>Cancel</button>
                  </div>
                )}

                <div className="notes-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => handleImportClick(card.id)}
                  >
                    Import
                  </button>

                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => exportNotes(card)}
                  >
                    Export
                  </button>

                  <button
                    type="button"
                    className="secondary-btn notes-small-btn"
                    aria-label="Remove this notes card"
                    onClick={() => removeNoteCard(card.id)}
                  >
                    -
                  </button>

                  <button
                    type="button"
                    className="secondary-btn notes-small-btn"
                    aria-label="Add a notes card"
                    onClick={addNoteCard}
                  >
                    +
                  </button>


                    <button
                        type="button"
                        className="secondary-btn notes-settings-btn"
                        onClick={() => openSettingsModal(card.id)}
                    >
                        Settings
                    </button>
                </div>
              </div>
            )}
          </div>
        ))}
        </div>

      {settingsCardId !== null && (
        <NotesSettingsModal
          card={noteCards.find((card) => card.id === settingsCardId)}
          onClose={closeSettingsModal}
          onSave={updateNoteCardSettings}
        />
      )}
    </div>
  );
}
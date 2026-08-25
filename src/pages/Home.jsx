import { useState, useEffect, useRef, useMemo } from "react";
import RunCalendar from "../components/RunCalendar";
import NotesSettingsModal from "../components/NotesSettingsModal";

import { FiCopy } from "react-icons/fi"

import WeeklyMileage from "../components/profile/WeeklyMileage";
import {
  parseDateSafe,
  parseDurationMinutes,
  startOfWeekMonday,
  addDays,
  weeksBetween,
  formatWeekRange,
  formatHoursMinsFromMinutes,
} from "../utils/profileHelpers";

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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
    const [activities, setActivities] = useState([]);
    const [noteCards, setNoteCards] = useState([createEmptyNote(1)]);
    const [settingsCardId, setSettingsCardId] = useState(null);
    const fileInputRefs = useRef({});
    const [copiedCardId, setCopiedCardId] = useState(null);

    const [selectedWeekIndex, setSelectedWeekIndex] = useState(null);

    const [weeklyScaleMode] = useState(
      () => localStorage.getItem("weeklyScaleMode") || "dynamic"
    );
    

  useEffect(() => {
    const savedActivities = localStorage.getItem("activities");
    if (savedActivities) {
        setActivities(JSON.parse(savedActivities));
    }

    const savedNoteCards = localStorage.getItem("homeNoteCards");

    if (savedNoteCards) {
        const parsed = JSON.parse(savedNoteCards);

        if (Array.isArray(parsed) && parsed.length > 0) {
        const normalizedCards = parsed.map((card, index) => ({
            id: card.id ?? index + 1,
            title: card.title || `Notes ${index + 1}`,
            text: card.text || "",
            isOpen: card.isOpen ?? false,
            height: Number(card.height) || 380,
            fontSize: Number(card.fontSize) || 12,
        }));

        setNoteCards(normalizedCards);
        }
    } else {
        // fallback from old single-note version
        const oldSavedNotes = localStorage.getItem("homeNotes");
        if (oldSavedNotes) {
        setNoteCards([
            {
            id: 1,
            title: "Notes 1",
            text: oldSavedNotes,
            isOpen: false,
            height: 380,
            fontSize: 12,
            },
        ]);
        }
    }
    }, []);

    // =========================================================
    // WEEKLY MILEAGE
    // Monday -> Sunday
    // Includes 0-mile weeks
    // =========================================================

    const weeklySnapshot = useMemo(() => {
      const map = new Map();
      let earliestDate = null;

      for (const activity of activities) {
        // Weekly mileage only counts runs
        if (activity.type && activity.type !== "run") continue;

        const date = parseDateSafe(activity.date);
        if (!date) continue;

        if (!earliestDate || date < earliestDate) {
          earliestDate = date;
        }

        const weekStart = startOfWeekMonday(date);
        const key = localDateKey(weekStart);

        if (!map.has(key)) {
          map.set(key, {
            weekStart,
            miles: 0,
            minutes: 0,
            elevationFt: 0,
          });
        }

        const week = map.get(key);

        const miles = Number(activity.miles) || 0;
        const minutes = parseDurationMinutes(activity.duration);

        const elevation =
          Number(
            activity.elevationGainFt ??
            activity.elevation_ft ??
            activity.elevationFt ??
            activity.elevation_gain_ft
          ) || 0;

        week.miles += miles;
        week.minutes += minutes;
        week.elevationFt += elevation;
      }

      // Current week
      const now = new Date();
      const endWeek = startOfWeekMonday(now);

      // If there are no activities yet, still show current week
      const startWeek = earliestDate
        ? startOfWeekMonday(earliestDate)
        : endWeek;

      const totalWeeks = weeksBetween(startWeek, endWeek);

      const weeks = [];

      for (let i = 0; i <= totalWeeks; i++) {
        const weekStart = addDays(startWeek, i * 7);
        const key = localDateKey(weekStart);

        const found = map.get(key);

        weeks.push({
          label: formatWeekRange(weekStart),
          weekStart,
          miles: found ? Number(found.miles.toFixed(1)) : 0,
          minutes: found ? Math.round(found.minutes) : 0,
          elevationFt: found ? Math.round(found.elevationFt) : 0,
        });
      }

      return weeks;
    }, [activities]);

    const selectedWeek =
      selectedWeekIndex !== null
        ? weeklySnapshot[selectedWeekIndex]
        : null;

    const isThisWeek = useMemo(() => {
      if (!selectedWeek?.weekStart) return false;

      const thisWeekStart = startOfWeekMonday(new Date());

      return (
        selectedWeek.weekStart.getFullYear() === thisWeekStart.getFullYear() &&
        selectedWeek.weekStart.getMonth() === thisWeekStart.getMonth() &&
        selectedWeek.weekStart.getDate() === thisWeekStart.getDate()
      );
    }, [selectedWeek]);

    useEffect(() => {
      if (!weeklySnapshot.length) {
        setSelectedWeekIndex(null);
        return;
      }

      setSelectedWeekIndex(weeklySnapshot.length - 1);
    }, [weeklySnapshot]);

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

    const copyAllNotesText = async (id) => {
      const textarea = textareaRefs.current[id];
      if (!textarea) return;

      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      try {
        await navigator.clipboard.writeText(textarea.value);
      } catch (err) {
        console.error("Copy failed:", err);
      }
    };

  return (
    <div className="page">
      <RunCalendar activities={activities} />


      {/* WEEKLY MILEAGE */}
      <div className="profile-section home-weekly-mileage">

        <div className="weekly-header">

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
                  ? `${selectedWeek.miles} mi`
                  : "-"}
              </div>
            </div>


            <div className="weekly-stat">
              <div className="weekly-stat-label">
                Time
              </div>

              <div className="weekly-stat-value">
                {selectedWeek
                  ? formatHoursMinsFromMinutes(selectedWeek.minutes)
                  : "-"}
              </div>
            </div>

          </div>

        </div>


        <WeeklyMileage
          weeks={weeklySnapshot}
          selectedIndex={selectedWeekIndex}
          onSelect={(index) => setSelectedWeekIndex(index)}
          scaleMode={weeklyScaleMode}
        />

      </div>




      <div className="notes-stack">
        {noteCards.map((card, index) => (
          <div key={card.id} className="notes-card">
            <div
              className="notes-header"
              onClick={() => toggleNoteCard(card.id)}
            >
              <h3>{card.title}</h3>
              <span>{card.isOpen ? "▲" : "▼"}</span>
            </div>

            {card.isOpen && (
              <div className="notes-card-body">
                  <div className="notes-card-body">
                    <button
                      className="notes-copy-btn"
                      onClick={() => copyNotesToClipboard(card.id, card.text)}
                      title="Copy notes"
                    >
                      <FiCopy />
                    </button>

                    {copiedCardId === card.id && (
                      <div className="notes-copied-msg">
                        Copied to your clipboard!
                      </div>
                    )}
                  </div>

                  <textarea
                      className="notes-input"
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

                <div className="notes-actions">
                  <button
                    className="secondary-btn"
                    onClick={() => handleImportClick(card.id)}
                  >
                    Import
                  </button>

                  <button
                    className="secondary-btn"
                    onClick={() => exportNotes(card)}
                  >
                    Export
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


                    <button
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
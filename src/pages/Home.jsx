import { useState, useEffect } from "react";
import RunCalendar from "../components/RunCalendar";
 
export default function Home(){
 const [activities, setActivities] = useState([]);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    const savedActivities = localStorage.getItem("activities");
    if (savedActivities) setActivities(JSON.parse(savedActivities));

    const savedNotes = localStorage.getItem("homeNotes");
    if (savedNotes) setNotes(savedNotes);
  }, []);

  const handleNotesChange = (e) => {
    const value = e.target.value;
    setNotes(value);
    localStorage.setItem("homeNotes", value);
  };

  // For export purposes
  const today = new Date().toLocaleDateString();

  const exportNotes = () => {
    const today = new Date().toLocaleDateString();
    const text = `Date: ${today}

  Notes:
  ${notes}
  `;

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `run-notes-${today}.txt`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <RunCalendar activities={activities} />

      <div className="notes-card">
        <div
          className="notes-header"
          onClick={() => setShowNotes(!showNotes)}
        >
          <h3>Notes</h3>
          <span>{showNotes ? "▲" : "▼"}</span>
        </div>

        {showNotes && (
          <>
            {/* <div className="notes-date">
              {today}
            </div> */}

            <textarea
              className="notes-input"
              placeholder="Write anything: goals, thoughts, race plans..."
              value={notes}
              onChange={handleNotesChange}
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />

            <button className="secondary-btn" onClick={exportNotes}>
              Export Notes
            </button>
          </>
        )}

      </div>
    </div>
  );
}
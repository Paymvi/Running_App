import { Routes, Route, NavLink, useNavigate } from "react-router-dom";
import "./App.css";
import { useState, useEffect } from "react";
import Activity from "./pages/Activity";
import FloatingButton from "./components/FloatingButton";
import AddActivityModal from "./components/AddActivityModal";
import RunCalendar from "./components/RunCalendar";
import Profile from "./pages/Profile";


import { FiSun, FiBarChart2, FiUser } from "react-icons/fi";

// To browse icons:
// https://react-icons.github.io/react-icons/ 




// to → the route path
// label → text under icon
// icon → emoji icon

function TabBar() {
  const tabs = [
    { to: "/", label: "Home", icon: <FiSun /> },
    { to: "/activity", label: "Activity", icon: <FiBarChart2 /> },
    { to: "/profile", label: "Profile", icon: <FiUser />},
  ];

  return (
    <nav className="tabbar" aria-label="Bottom Navigation">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === "/"} // makes "/" not stay active on every route
          className={({ isActive }) => (isActive ? "tab active" : "tab")}
        >
          <span className="tab-icon" aria-hidden="true">
            {t.icon}
          </span>
          <span className="tab-label">{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function Home() {

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


export default function App() {
  const [open, setOpen] = useState(false);
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>

      <FloatingButton onClick={() => setOpen(true)} />

      <AddActivityModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onSave={(activity) => {
          const saved = JSON.parse(localStorage.getItem("activities")) || [];
          const updated = [...saved, activity];
          localStorage.setItem("activities", JSON.stringify(updated));
        }}
      />

      <TabBar />
    </div>
  );
}
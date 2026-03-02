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

  useEffect(() => {
    const saved = localStorage.getItem("activities");
    if (saved) setActivities(JSON.parse(saved));
  }, []);

  return (
    <div className="page">
      <RunCalendar activities={activities} />
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
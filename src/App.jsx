import { Routes, Route, NavLink, useNavigate } from "react-router-dom";
import "./App.css";
import { useState, useEffect } from "react";
import Activity from "./pages/Activity";
import FloatingButton from "./components/FloatingButton";
import AddActivityModal from "./components/AddActivityModal";
import RunCalendar from "./components/RunCalendar";



// to → the route path
// label → text under icon
// icon → emoji icon

function TabBar() {
  const tabs = [
    { to: "/", label: "Home", icon: "🏠" },
    { to: "/activity", label: "Activity", icon: "📈" },
    { to: "/profile", label: "Profile", icon: "👤" },
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
      <h1>Welcome back!</h1>
      <RunCalendar activities={activities} />
    </div>
  );

}

function Profile() {
  return (
    <>
      <h1>Profile</h1>
    </>
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
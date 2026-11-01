import { Routes, Route, NavLink } from "react-router-dom";
import "./App.css";
import { useState, lazy, Suspense } from "react";
import FloatingButton from "./components/FloatingButton";
import AddActivityModal from "./components/AddActivityModal";
import JarDropModal from "./components/JarDropModal";
import StorageBanner from "./components/StorageBanner";
import { saveActivityWithPhoto, deleteActivity, restoreFromTrash, useActivities } from "./utils/activityStore";
import { isJarEligible } from "./utils/activityModel";
import { playSound, vibrate } from "./utils/feedback";

import { FiSun, FiBarChart2, FiUser } from "react-icons/fi";

// Pages load on demand so Home doesn't pay for the spreadsheet/import code.
const Home = lazy(() => import("./pages/Home"));
const Activity = lazy(() => import("./pages/Activity"));
const Profile = lazy(() => import("./pages/Profile"));

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

function NotFound() {
  return (
    <div className="page">
      <h2>Page not found</h2>
      <NavLink to="/">Go to Home</NavLink>
    </div>
  );
}

export default function App({ migration = { status: "current" } }) {
  // The single add/edit modal for every page. `editing` is null when adding.
  const [modal, setModal] = useState({ open: false, editing: null });
  const [jarDropId, setJarDropId] = useState(null);
  const [undo, setUndo] = useState(null); // { ids, message } after a delete
  const { activities } = useActivities();

  const openEditor = (activity = null) => setModal({ open: true, editing: activity });
  const closeEditor = () => setModal({ open: false, editing: null });

  // Persists first (photo, then record); the modal stays open with the user's input if saving fails.
  const handleSave = async (activity, options) => {
    const result = await saveActivityWithPhoto(activity, options);
    if (!result.ok) return result;

    closeEditor();
    vibrate(120);
    playSound("/ball-drop.mp3");
    // Celebrate only a newly created, completed easy run; never an edit, import or plan.
    if (result.created && isJarEligible(activity)) setJarDropId(result.id);
    return result;
  };

  // Deleting moves the activity to Recently deleted (Backup & recovery) and offers Undo.
  const handleDelete = (id) => {
    const result = deleteActivity(id);
    if (result.ok) {
      closeEditor();
      setUndo({ ids: [id], message: "Activity moved to Recently deleted." });
    }
    return result;
  };

  const handleUndo = () => {
    const result = restoreFromTrash(undo.ids);
    setUndo(result.ok ? null : { ...undo, message: result.error });
  };

  return (
    <div className="app">
      <StorageBanner migration={migration} />

      <Suspense fallback={<div className="page" aria-busy="true" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/activity" element={<Activity onEditActivity={openEditor} onDeleted={(ids, message) => setUndo({ ids, message })} />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>

      <FloatingButton onClick={() => openEditor(null)} />

      {modal.open && (
        <AddActivityModal
          isOpen
          initialActivity={modal.editing}
          onClose={closeEditor}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      {undo && (
        <div className="undo-bar" role="status">
          <span>{undo.message}</span>
          <button type="button" className="tertiary-btn" onClick={handleUndo}>Undo</button>
          <button type="button" className="tertiary-btn" aria-label="Dismiss" onClick={() => setUndo(null)}>✕</button>
        </div>
      )}

      <JarDropModal
        activityId={jarDropId}
        activities={activities}
        onClose={() => setJarDropId(null)}
      />

      <TabBar />
    </div>
  );
}

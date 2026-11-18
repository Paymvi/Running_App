import React, { useState, useMemo, useRef } from "react";
import LargeHeatmap from "../components/LargeHeatmap";
import EasyJar from "../components/profile/EasyJar";
import ProfileTopSection from "../components/profile/ProfileTopSection";
import PRPanel from "../components/profile/PRPanel";
import MonthlySnapshot from "../components/profile/MonthlySnapshot";
import PastJarsModal from "../components/profile/PastJarsModal";
import EditProfileModal from "../components/profile/EditProfileModal";
import ConstellationSky from "../components/motivation/ConstellationSky";
import StarAtlasModal from "../components/motivation/StarAtlasModal";
import CustomizeMotivationModal from "../components/motivation/CustomizeMotivationModal";
import { FiSliders } from "react-icons/fi";
import TAG_OPTIONS from "../utils/tags";
import { useActivities } from "../utils/activityStore";
import { buildJarGroups, isCountable, JAR_SIZE } from "../utils/activityModel";
import { detectPRs } from "../utils/prDetection";
import { monthlySnapshot as buildMonthlySnapshot, runTotals } from "../utils/stats";
import { parseLocalYMD } from "../utils/dateUtils";
import { resizeImageFile } from "../utils/image";
import { describeWriteError } from "../utils/storage";
import { setUnit, useUnit } from "../utils/units";
import { STARS_PER_CONSTELLATION, buildSky, getMotivationSettings, setMotivationSettings } from "../utils/motivation";

// Saves a small profile setting. Returns an error message, or null when saved.
function persist(key, value) {
  try {
    if (value === "") localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return null;
  } catch (e) {
    return describeWriteError(e);
  }
}

const readSetting = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};


export default function Profile() {
  const { activities } = useActivities();
  const unit = useUnit();
  const [avatar, setAvatar] = useState(() => readSetting("profileAvatar", ""));
  const [tag, setTag] = useState(() => readSetting("profileTag", "Built Different (Unfortunately)"));
  const [profileName, setProfileName] = useState(() => readSetting("profileName", "Your Name"));
  const fileInputRef = useRef(null);
  const [showJarHistory, setShowJarHistory] = useState(false);
  const [showAtlas, setShowAtlas] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [motivation, setMotivation] = useState(getMotivationSettings);
  const [selectedPR, setSelectedPR] = useState(null);
  const [showTrends, setShowTrends] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [weeklyScaleMode, setWeeklyScaleMode] = useState(() => readSetting("weeklyScaleMode", "dynamic"));
  // Shown wherever the failed setting lives; a value that couldn't be saved is never presented as saved.
  const [saveError, setSaveError] = useState("");

  // Selects only change when the new value was saved.
  const saveSelect = (key, value, setter) => {
    const error = persist(key, value);
    setSaveError(error ? `Not saved: ${error}` : "");
    if (!error) setter(value);
  };

  // Typed text stays on screen while typing; a failed save is flagged until a save succeeds.
  const saveName = (value) => {
    setProfileName(value);
    const error = persist("profileName", value);
    setSaveError(error ? `Name not saved: ${error}` : "");
  };

  // Returns an error message, or null when saved; the section only changes once saved.
  const saveMotivation = (next) => {
    const error = setMotivationSettings(next);
    if (!error) setMotivation(next);
    return error;
  };

  const saveMotivationHidden = (hidden) => {
    const error = saveMotivation({ ...motivation, hidden });
    setSaveError(error ? `Not saved: ${error}` : "");
  };

  const saveUnit = (value) => setSaveError(setUnit(value) ? "Unit setting not saved: browser storage refused it." : "");

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      // Resized so the avatar stays small in localStorage.
      const dataUrl = await resizeImageFile(file, 512);
      const error = persist("profileAvatar", dataUrl);
      if (error) return setSaveError(`Photo not saved: ${error}`);
      setAvatar(dataUrl);
      setSaveError("");
    } catch (err) {
      setSaveError(err.message);
    }
  };

  const removeAvatar = () => {
    const error = persist("profileAvatar", "");
    if (error) return setSaveError(error);
    setAvatar("");
  };

  // Completed runs only (stats.js).
  const stats = useMemo(() => runTotals(activities), [activities]);

  // Shared whole-activity PR rule (prDetection.js).
  const prs = useMemo(() => {
    const found = detectPRs(activities);
    const dates = [found.mile.date, found.fiveK.date, found.tenK.date].map(parseLocalYMD).filter(Boolean);
    return {
      ...found,
      latestPRDate: dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null,
    };
  }, [activities]);

  // EASY RUN JAR: 25 balls per jar; a full jar moves to Past Jars immediately.
  const jars = useMemo(() => buildJarGroups(activities), [activities]);
  const currentJar = jars.current;
  const completedJars = jars.completed;
  const jarCount = completedJars.length;

  // CONSTELLATIONS: one star per day with any completed activity, 12 per constellation.
  const sky = useMemo(() => buildSky(activities), [activities]);
  const showConstellations = motivation.module === "constellations";

  // The header's history button and count follow the chosen module.
  const history = motivation.hidden
    ? null
    : showConstellations
      ? { label: "Star Atlas ✦", count: sky.completedConstellations, countLabel: "Constellations", open: () => setShowAtlas(true) }
      : { label: "Past Jars 🫙", count: jarCount, countLabel: "Jars Completed", open: () => setShowJarHistory(true) };

  const customizeButton = (
    <button type="button" className="motivation-customize" aria-haspopup="dialog" onClick={() => setShowCustomize(true)}>
      <FiSliders aria-hidden="true" /> Customize
    </button>
  );

  const monthlySnapshot = useMemo(() => buildMonthlySnapshot(activities), [activities]);
  const completed = useMemo(() => activities.filter(isCountable), [activities]);

    const displayName = profileName.trim() || "Your Name";


    return (
      <div className="profile-page">

        <ProfileTopSection
          avatar={avatar}
          fileInputRef={fileInputRef}
          handleAvatarChange={handleAvatarChange}
          removeAvatar={removeAvatar}
          history={history}
          displayName={displayName}
          setShowEditProfile={setShowEditProfile}
          stats={stats}
          unit={unit}
          tag={tag}
          setTag={(value) => saveSelect("profileTag", value, setTag)}
          TAG_OPTIONS={TAG_OPTIONS}
        />
        {saveError && !showEditProfile && <div className="field-error" role="alert">{saveError}</div>}


        {/* MIDDLE AREA: graph left + PR panel right */}
        <div className={motivation.hidden ? "profile-mid single" : "profile-mid"}>

            {/* MOTIVATION: Easy Run Jar (default) or Constellations, or hidden */}
            {!motivation.hidden && (
            <div className="profile-panel motivation-panel">
            {showConstellations ? (
              <ConstellationSky
                sky={sky}
                starColors={motivation.starColors}
                unit={unit}
                action={customizeButton}
                onOpenAtlas={() => setShowAtlas(true)}
              />
            ) : (
              <>
              <EasyJar
                  title="Easy Run Jar"
                  subtitle={`${currentJar.length}/${JAR_SIZE} balls`}
                  runs={currentJar}
                  action={customizeButton}
              />

              {currentJar.length === 0 && jarCount > 0 && (
                  <div className="jar-complete">
                  Jar {jarCount} complete and moved to Past Jars. Fresh jar! 🏆
                  </div>
              )}
              </>
            )}
            </div>
            )}

            <PRPanel
              prs={prs}
              selectedPR={selectedPR}
              setSelectedPR={setSelectedPR}
              unit={unit}
            />

        </div>

            <MonthlySnapshot
              monthlySnapshot={monthlySnapshot}
              showTrends={showTrends}
              setShowTrends={setShowTrends}
              unit={unit}
            />

            <br></br>


        {showJarHistory && (
          <PastJarsModal
            showJarHistory={showJarHistory}
            setShowJarHistory={setShowJarHistory}
            completedJars={completedJars}
          />
        )}


        {showAtlas && (
          <StarAtlasModal sky={sky} starColors={motivation.starColors} onClose={() => setShowAtlas(false)} />
        )}

        {showCustomize && (
          <CustomizeMotivationModal
            settings={motivation}
            summaries={{
              jar: `Now: ${currentJar.length}/${JAR_SIZE} balls · ${jarCount} ${jarCount === 1 ? "jar" : "jars"} completed`,
              constellations: `Now: ${sky.current.shape.name} · ${sky.current.stars.length}/${STARS_PER_CONSTELLATION} stars · ${sky.days.length} active ${sky.days.length === 1 ? "day" : "days"}`,
            }}
            onSave={saveMotivation}
            onClose={() => setShowCustomize(false)}
          />
        )}

        {showEditProfile && (
          <EditProfileModal
              showEditProfile={showEditProfile}
              setShowEditProfile={setShowEditProfile}
              profileName={profileName}
              setProfileName={saveName}
              weeklyScaleMode={weeklyScaleMode}
              setWeeklyScaleMode={(value) => saveSelect("weeklyScaleMode", value, setWeeklyScaleMode)}
              unit={unit}
              setUnit={saveUnit}
              saveError={saveError}
              motivationHidden={motivation.hidden}
              setMotivationHidden={saveMotivationHidden}
            />
        )}

        <LargeHeatmap activities={completed}/>

        </div>
    );
}

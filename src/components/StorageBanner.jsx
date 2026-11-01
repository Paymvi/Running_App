import React, { useState } from "react";
import { runMigrations } from "../utils/migrations";
import { initActivityStore, useActivities } from "../utils/activityStore";
import { saveBackup } from "../utils/backups";
import {
  KEYS,
  buildBackupFile,
  describeWriteError,
  downloadText,
  snapshotAll,
  snapshotStorage,
  writeKeysAtomically,
} from "../utils/storage";

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

export default function StorageBanner({ migration }) {
  const { loadError, blockedReason } = useActivities();
  const [message, setMessage] = useState("");
  const [infoDismissed, setInfoDismissed] = useState(false);

  // Includes photos when the photo store is readable; otherwise records only (still complete
  // before the photo upgrade, when photos are inside the records).
  const downloadFullBackup = async () => {
    let snap;
    try {
      snap = await snapshotAll();
    } catch {
      snap = { entries: snapshotStorage(), media: {} };
    }
    downloadText(`velo-backup-${stamp()}.json`, buildBackupFile(snap.entries, undefined, snap.media));
  };

  if (loadError === "corrupt") {
    const setAside = async () => {
      if (!window.confirm("Move the unreadable data aside (it stays in this browser and in the download) and start with an empty activity list?")) return;
      const raw = localStorage.getItem(KEYS.activities);
      try {
        await saveBackup({ reason: "unreadable activities set aside", entries: snapshotStorage() }).catch(() => {});
        writeKeysAtomically({ [`activities_corrupt_${Date.now()}`]: raw, [KEYS.activities]: null });
        initActivityStore();
      } catch (e) {
        setMessage(describeWriteError(e));
      }
    };
    return (
      <div className="storage-banner storage-banner-error" role="alert">
        <strong>Your saved activities couldn't be read.</strong> Nothing has been changed or deleted, and
        saving is paused so the data isn't overwritten.
        <div className="storage-banner-actions">
          <button type="button" className="control-btn btn-secondary" onClick={() =>
            downloadText(`velo-unreadable-activities-${stamp()}.txt`, localStorage.getItem(KEYS.activities) || "", "text/plain")}>
            Download damaged data
          </button>
          <button type="button" className="control-btn btn-secondary" onClick={setAside}>
            Set aside &amp; start fresh
          </button>
        </div>
        {message && <div className="field-error">{message}</div>}
      </div>
    );
  }

  if (loadError === "unavailable") {
    return (
      <div className="storage-banner storage-banner-error" role="alert">
        <strong>Browser storage is unavailable</strong> (private mode or blocked site data). Velo can't load or
        save activities here.
      </div>
    );
  }

  if (blockedReason) {
    const upgradeWithoutAutoBackup = async () => {
      if (!window.confirm("Have you downloaded and kept the backup file? The upgrade will continue without an automatic backup.")) return;
      const result = await runMigrations({ skipBackup: true }).catch((e) => ({ status: "error", error: String(e) }));
      if (result.status === "migrated" || result.status === "current" || result.status === "fresh") {
        initActivityStore();
      } else {
        setMessage(`Upgrade did not complete (${result.status}). Your data is unchanged.`);
      }
    };
    const what =
      migration.status === "media-failed"
        ? "couldn't copy your photos into the browser's photo storage"
        : migration.status === "write-failed"
          ? "couldn't save the upgraded data"
          : "couldn't create its automatic safety backup";
    return (
      <div className="storage-banner storage-banner-warn" role="alert">
        <strong>Velo needs to upgrade your saved data, but {what}</strong>
        {migration.error ? ` (${migration.error})` : ""}. Nothing has been changed. Download a backup file
        first, then continue.
        <div className="storage-banner-actions">
          <button type="button" className="control-btn btn-secondary" onClick={downloadFullBackup}>
            Download backup file
          </button>
          <button type="button" className="control-btn btn-secondary" onClick={upgradeWithoutAutoBackup}>
            Continue upgrade
          </button>
        </div>
        {message && <div className="field-error">{message}</div>}
      </div>
    );
  }

  const review = migration.needsReview?.length || 0;
  const unconfirmed = migration.unconfirmed || 0;
  if (migration.status === "migrated" && (review || migration.quarantined || unconfirmed) && !infoDismissed) {
    return (
      <div className="storage-banner storage-banner-warn" role="status">
        Your data was upgraded and a backup was saved first.{" "}
        {review > 0 && `${review} ${review === 1 ? "activity has" : "activities have"} values Velo couldn't read; they're marked "Needs review" and were left unchanged. `}
        {unconfirmed > 0 && `${unconfirmed} future-dated ${unconfirmed === 1 ? "activity is" : "activities are"} marked "Planned or done?" and won't count until you choose. `}
        {migration.quarantined > 0 && `${migration.quarantined} unreadable entr${migration.quarantined === 1 ? "y was" : "ies were"} moved to the backup area (Backup → Download set-aside entries). `}
        Nothing was deleted.
        <div className="storage-banner-actions">
          <button type="button" className="control-btn btn-secondary" onClick={() => setInfoDismissed(true)}>
            OK
          </button>
        </div>
      </div>
    );
  }

  return null;
}

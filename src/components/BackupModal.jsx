import React, { useEffect, useRef, useState } from "react";
import useDialog from "../hooks/useDialog";
import { clearBackups, listBackups, saveBackup } from "../utils/backups";
import { initActivityStore, purgeTrash, restoreFromTrash, TRASH_DAYS, useActivities } from "../utils/activityStore";
import { disconnectStrava } from "../utils/stravaClient";
import { formatDisplayDate } from "../utils/dateUtils";
import {
  KEYS,
  buildBackupFile,
  describeWriteError,
  downloadText,
  parseBackupFile,
  readJSON,
  resetAllData,
  restoreBackup,
  snapshotAll,
} from "../utils/storage";

const stamp = (iso = new Date().toISOString()) => iso.slice(0, 19).replace(/[:T]/g, "-");
const RESET_WORD = "RESET";

async function downloadFullBackup() {
  const { entries, media } = await snapshotAll();
  downloadText(`velo-backup-${stamp()}.json`, buildBackupFile(entries, undefined, media));
}

// Backup & recovery: full backup/restore (records, photos, notes, profile, settings;
// never the Strava connection), Recently deleted, automatic backups, Delete All and app reset.
export default function BackupModal({ isOpen, onClose, onDeleteAll }) {
  const dialogRef = useDialog(isOpen, onClose);
  const { activities, trash } = useActivities();
  const fileRef = useRef(null);
  const [autoBackups, setAutoBackups] = useState(null);
  const [message, setMessage] = useState("");
  const [resetText, setResetText] = useState("");
  const [clearAuto, setClearAuto] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    listBackups()
      .then((list) => !cancelled && setAutoBackups(list))
      .catch(() => !cancelled && setAutoBackups([]));
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const quarantined = readJSON(KEYS.quarantine, []);

  // Runs one action at a time and reports failures instead of throwing.
  const guarded = (fn) => async (...args) => {
    if (working) return;
    setWorking(true);
    try {
      await fn(...args);
    } catch (e) {
      setMessage(e?.message || String(e));
    } finally {
      setWorking(false);
    }
  };

  // A safety copy of everything before a destructive step. Returns false if the user stops.
  const backupFirst = async (reason, question) => {
    try {
      await saveBackup({ reason, ...(await snapshotAll()) });
      return true;
    } catch {
      return window.confirm(question);
    }
  };

  const restore = guarded(async (file) => {
    if (!file) return;
    const parsed = parseBackupFile(await file.text());
    if (parsed.error) return setMessage(parsed.error);

    const when = parsed.createdAt ? new Date(parsed.createdAt).toLocaleString() : "an unknown date";
    if (!window.confirm(`Replace ALL current Velo data in this browser with the backup from ${when}? A copy of the current data is saved first.`)) return;
    if (!(await backupFirst("before restoring a backup file", "Couldn't save an automatic copy of the current data first. Restore anyway?"))) return;

    try {
      await restoreBackup(parsed);
    } catch (e) {
      return setMessage(`${e?.name === "QuotaExceededError" ? describeWriteError(e) : `Restore failed: ${e?.message || e}.`} The current data was left as it was.`);
    }
    initActivityStore();
    setMessage("Backup restored. Reloading…");
    // Notes, profile and settings are read when their pages mount; reload so every page shows restored data.
    setTimeout(() => window.location.reload(), 600);
  });

  const restoreTrashed = (ids) => {
    const result = restoreFromTrash(ids);
    if (!result.ok) setMessage(result.error);
    else setMessage(`${result.restored} restored${result.skipped ? `; ${result.skipped} skipped (an activity with the same id exists)` : ""}.`);
  };

  const deleteForever = guarded(async (ids) => {
    if (!window.confirm(`Permanently delete ${ids.length === 1 ? "this activity" : `${ids.length} activities`} and ${ids.length === 1 ? "its photo" : "their photos"}? This cannot be undone (automatic backups are kept).`)) return;
    const result = await purgeTrash(ids);
    setMessage(result.ok ? `${result.purged} permanently deleted.` : result.error);
  });

  const reset = guarded(async () => {
    if (resetText !== RESET_WORD) return;
    if (!(await backupFirst("before app reset", "Couldn't save an automatic backup first. Reset anyway? (Cancel, then download a backup file.)"))) return;
    try {
      await disconnectStrava();
    } catch {
      // the Velo server may not be running; nothing is stored about Strava in this browser
    }
    await resetAllData();
    if (clearAuto) await clearBackups();
    setMessage("Velo was reset. Reloading…");
    setTimeout(() => window.location.reload(), 600);
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="strava-modal backup-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="strava-modal-header">
          <h2 className="strava-modal-title" id="backup-modal-title">Backup &amp; recovery</h2>
          <button type="button" className="strava-modal-close" onClick={onClose} aria-label="Close backup dialog">
            ×
          </button>
        </div>

        <div className="strava-modal-body">
          <p className="strava-modal-text">
            A backup file holds everything stored in this browser: activities, photos, recently deleted items,
            notes, profile and settings. Spreadsheet export is for sharing activity tables and leaves photos out.
          </p>

          <div className="strava-modal-actions">
            <button type="button" className="strava-action-btn" disabled={working} onClick={guarded(downloadFullBackup)}>
              Download backup file
            </button>
            <button type="button" className="strava-action-btn" disabled={working} onClick={() => fileRef.current?.click()}>
              Restore from backup file…
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                restore(file);
              }}
            />
          </div>

          {message && <p className="strava-modal-text" role="status">{message}</p>}

          <section className="strava-modal-fyi" aria-labelledby="trash-title">
            <h3 id="trash-title" className="backup-section-title">Recently deleted</h3>
            <div>Deleted activities stay here for {TRASH_DAYS} days, then are removed for good.</div>
            {trash.length === 0 && <div>Nothing here.</div>}
            {trash.map((t) => (
              <div key={t.activity.id} className="backup-row">
                <span>
                  {t.activity.title || "Untitled"} · {formatDisplayDate(t.activity.date) || t.activity.date} (deleted{" "}
                  {new Date(t.deletedAt).toLocaleDateString()})
                </span>
                <span>
                  <button type="button" className="tertiary-btn" onClick={() => restoreTrashed([t.activity.id])}>Restore</button>
                  <button type="button" className="tertiary-btn" disabled={working} onClick={() => deleteForever([t.activity.id])}>
                    Delete forever
                  </button>
                </span>
              </div>
            ))}
            {trash.length > 1 && (
              <div className="backup-row">
                <button type="button" className="tertiary-btn" onClick={() => restoreTrashed(trash.map((t) => t.activity.id))}>
                  Restore all
                </button>
                <button type="button" className="tertiary-btn" disabled={working} onClick={() => deleteForever(trash.map((t) => t.activity.id))}>
                  Empty Recently deleted
                </button>
              </div>
            )}
          </section>

          <section className="strava-modal-fyi" aria-labelledby="auto-title">
            <h3 id="auto-title" className="backup-section-title">Automatic backups</h3>
            <div>Saved before upgrades, Delete All, restores and resets. Upgrade backups are always kept, plus the 10 newest others.</div>
            {autoBackups === null && <div>Loading…</div>}
            {autoBackups?.length === 0 && <div>None yet.</div>}
            {autoBackups?.map((b) => (
              <div key={b.id} className="backup-row">
                <span>
                  {new Date(b.createdAt).toLocaleString()} — {b.reason}
                </span>
                <button
                  type="button"
                  className="tertiary-btn"
                  onClick={() => downloadText(`velo-backup-${stamp(b.createdAt)}.json`, buildBackupFile(b.entries, b.createdAt, b.media || {}))}
                >
                  Download
                </button>
              </div>
            ))}
            {quarantined.length > 0 && (
              <div className="backup-row">
                <span>{quarantined.length} unreadable entries were set aside during an upgrade.</span>
                <button
                  type="button"
                  className="tertiary-btn"
                  onClick={() => downloadText(`velo-set-aside-${stamp()}.json`, JSON.stringify(quarantined, null, 2))}
                >
                  Download set-aside entries
                </button>
              </div>
            )}
          </section>

          <section className="strava-modal-fyi" aria-labelledby="delete-all-title">
            <h3 id="delete-all-title" className="backup-section-title">Delete all activities</h3>
            <div>
              Moves every activity to Recently deleted for {TRASH_DAYS} days. Notes, profile and settings are not
              affected. A backup is saved first.
            </div>
            <button
              type="button"
              className="control-btn btn-danger"
              disabled={!activities.length || working}
              onClick={guarded(onDeleteAll)}
            >
              Delete All
            </button>
          </section>

          <section className="strava-modal-fyi" aria-labelledby="reset-title">
            <h3 id="reset-title" className="backup-section-title">Reset Velo</h3>
            <div>
              Removes <strong>everything</strong> Velo stores in this browser: activities, recently deleted, photos,
              notes, profile, settings and unreadable data set aside. It also disconnects Strava (activities already
              imported are part of what is removed). A backup is saved first; automatic backups are kept unless you
              tick the box.
            </div>
            <label className="settings-toggle">
              <input type="checkbox" checked={clearAuto} onChange={(e) => setClearAuto(e.target.checked)} />
              Also delete automatic backups (cannot be undone)
            </label>
            <label className="filter-label" htmlFor="reset-confirm">Type {RESET_WORD} to confirm</label>
            <input
              id="reset-confirm"
              className="filter-input"
              value={resetText}
              autoComplete="off"
              onChange={(e) => setResetText(e.target.value)}
            />
            <button
              type="button"
              className="control-btn btn-danger"
              disabled={resetText !== RESET_WORD || working}
              onClick={reset}
            >
              Reset Velo
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

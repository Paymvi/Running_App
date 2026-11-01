import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { runMigrations, blockedReasonFor } from './utils/migrations.js'
import { saveBackup } from './utils/backups.js'
import { initActivityStore } from './utils/activityStore.js'

// Leftovers from older versions: reload-time feedback flags, and the Strava token
// that used to live in the browser (tokens are now held by the server only).
for (const key of ['jarDrop', 'playActivitySound', 'strava_access_token']) {
  try {
    localStorage.removeItem(key)
  } catch {
    // storage unavailable; the store reports it
  }
}

runMigrations({ saveBackup })
  .catch((e) => ({ status: 'error', error: String(e?.message || e) }))
  .then((migration) => {
    initActivityStore({ blockedReason: blockedReasonFor(migration) })
    createRoot(document.getElementById('root')).render(
      <BrowserRouter>
        <App migration={migration} />
      </BrowserRouter>
    )
  })

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config({ path: "./server/.env" });


const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

const {
  STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET,
  STRAVA_REDIRECT_URI,
  FRONTEND_URL,
} = process.env;

if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REDIRECT_URI || !FRONTEND_URL) {
  console.warn("Missing env vars. Check server/.env");
}

/**
 * Step 1: Redirect user to Strava authorize URL
 * Strava will send them back to STRAVA_REDIRECT_URI with ?code=...
 */
app.get("/auth/strava", (req, res) => {
  const scope = "activity:read_all";
  const url =
    "https://www.strava.com/oauth/authorize" +
    `?client_id=${encodeURIComponent(STRAVA_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT_URI)}` +
    `&response_type=code` +
    `&approval_prompt=auto` +
    `&scope=${encodeURIComponent(scope)}`;

  res.redirect(url);
});

/**
 * Step 2: Strava redirects here with ?code=
 * We exchange that code for an access token (server-only).
 */
app.get("/auth/strava/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`${FRONTEND_URL}/activity?strava=error`);
  }

  if (!code) {
    return res.status(400).send("Missing code from Strava.");
  }

  try {
    const resp = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Token exchange failed:", text);
      return res.status(500).send("Token exchange failed.");
    }

    const data = await resp.json();

    // Send token back to frontend via query param (simple approach for local dev)
    // In production you'd store session cookies instead.
    const accessToken = data.access_token;

    return res.redirect(
      `${FRONTEND_URL}/activity?strava=connected&access_token=${encodeURIComponent(accessToken)}`
    );
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server error.");
  }
});

/**
 * Step 3: Use access token to fetch activities from Strava
 * GET /api/strava/activities?access_token=...&per_page=50&page=1
 */
app.get("/api/strava/activities", async (req, res) => {
  const { access_token, per_page = "50", page = "1" } = req.query;

  if (!access_token) {
    return res.status(400).json({ error: "Missing access_token" });
  }

  // Strava per_page max is commonly 200
  const perPageNum = Math.min(Number(per_page) || 50, 200);

  try {
    const url =
      `https://www.strava.com/api/v3/athlete/activities` +
      `?per_page=${perPageNum}` +
      `&page=${encodeURIComponent(page)}`;

    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Fetch activities failed:", text);
      return res.status(500).json({ error: "Failed to fetch activities" });
    }

    const data = await resp.json();
    return res.json({ activities: data });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Strava server running on http://localhost:${PORT}`));
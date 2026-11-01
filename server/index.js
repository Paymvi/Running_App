import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { createApp, validateConfig } from "./app.js";

// Load server/.env no matter which directory the process was started from.
dotenv.config({ path: fileURLToPath(new URL(".env", import.meta.url)), quiet: true });

const problems = validateConfig(process.env);
if (problems.length) {
  console.error(`Velo server not started. Fix server/.env (see server/.env.example):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}

const app = createApp({ config: process.env });

const PORT = Number(process.env.PORT) || 5050;
const server = app.listen(PORT, () => console.log(`Strava server running on http://localhost:${PORT}`));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

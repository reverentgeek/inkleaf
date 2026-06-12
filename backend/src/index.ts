import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { getSqlite } from "./db/sqlite.js";
import { startSyncLoop } from "./services/sync.service.js";
import { errorHandler } from "./middleware/errorHandler.js";
import notesRouter from "./routes/notes.js";
import searchRouter from "./routes/search.js";
import semanticRouter from "./routes/semantic.js";
import vaultRouter from "./routes/vault.js";
import syncRouter from "./routes/sync.js";

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "tauri://localhost",
      "https://tauri.localhost",
    ],
  }),
);
app.use(express.json({ limit: "5mb" }));

app.use("/api/notes", notesRouter);
app.use("/api/search", searchRouter);
app.use("/api/semantic", semanticRouter);
app.use("/api/vault", vaultRouter);
app.use("/api/sync", syncRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(errorHandler);

function start() {
  // The local SQLite store must always be available — initialize it first.
  getSqlite();

  // Listen immediately; the sync loop owns connecting (and reconnecting)
  // to Atlas, so the app works offline from a cold start.
  app.listen(config.port, () => {
    console.log(`Backend running on http://localhost:${config.port}`);
  });

  startSyncLoop();
}

start();

import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { connectToDatabase } from "./db/connection.js";
import { errorHandler } from "./middleware/errorHandler.js";
import notesRouter from "./routes/notes.js";
import searchRouter from "./routes/search.js";
import semanticRouter from "./routes/semantic.js";
import vaultRouter from "./routes/vault.js";

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

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(errorHandler);

async function start() {
  try {
    await connectToDatabase();
    app.listen(config.port, () => {
      console.log(`Backend running on http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();

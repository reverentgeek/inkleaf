import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(import.meta.dirname, "../../.env") });

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  mongodbUri: process.env.MONGODB_URI || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  dbName: process.env.MONGODB_DB || "inkleaf",
  sqlitePath:
    process.env.SQLITE_PATH ||
    resolve(import.meta.dirname, "../data/inkleaf.db"),
  syncIntervalMs: parseInt(process.env.SYNC_INTERVAL_MS || "15000", 10),
} as const;

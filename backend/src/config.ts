import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(import.meta.dirname, "../../.env") });

// Embedding provider selection. "openai" (default) or "voyage" (MongoDB's Voyage AI).
const embeddingProvider = (
  process.env.EMBEDDING_PROVIDER || "voyage"
).toLowerCase() as "openai" | "voyage";

// Default embedding model + dimensions per provider. text-embedding-3-small is
// 1536-dim; voyage-4-lite is 1024-dim. The Atlas vector index must match, so
// dimensions are derived here and consumed by create-indexes.
const embeddingDefaults = {
  openai: { model: "text-embedding-3-small", dimensions: 1536 },
  voyage: { model: "voyage-4-lite", dimensions: 1024 },
} as const;

const providerDefaults =
  embeddingDefaults[embeddingProvider] ?? embeddingDefaults.openai;

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  mongodbUri: process.env.MONGODB_URI || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  voyageApiKey: process.env.VOYAGE_API_KEY || "",
  embeddingProvider,
  embeddingModel: process.env.EMBEDDING_MODEL || providerDefaults.model,
  embeddingDimensions: parseInt(
    process.env.EMBEDDING_DIMENSIONS || String(providerDefaults.dimensions),
    10,
  ),
  dbName: process.env.MONGODB_DB || "inkleaf",
  sqlitePath:
    process.env.SQLITE_PATH ||
    resolve(import.meta.dirname, "../data/inkleaf.db"),
  syncIntervalMs: parseInt(process.env.SYNC_INTERVAL_MS || "15000", 10),
} as const;

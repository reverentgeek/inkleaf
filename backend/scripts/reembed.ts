// Re-embed every note with the currently configured embedding provider and,
// when the vector dimensions change (e.g. switching OpenAI 1536 <-> Voyage
// 1024), rebuild the Atlas vector index to match. Run this after changing
// EMBEDDING_PROVIDER / EMBEDDING_MODEL in .env.
//
//   pnpm reembed            # rebuild index if needed, then re-embed all notes
//   pnpm reembed --keep-index   # re-embed only, never touch the vector index
//
// Safe to run repeatedly; re-embedding is idempotent. Stop the backend first so
// the sync engine doesn't race this script writing the same docs.
import { MongoClient, type Collection } from "mongodb";
import { config } from "../src/config.js";
import {
  generateEmbedding,
  prepareTextForEmbedding,
} from "../src/services/embeddings.js";
import { getSqlite, closeSqlite } from "../src/db/sqlite.js";
import {
  VECTOR_INDEX,
  vectorIndexDefinition,
  ensureSearchIndex,
} from "../src/db/search-indexes.js";
import type { Note } from "../src/types/index.js";

const keepIndex = process.argv.includes("--keep-index");

// API key check for the configured provider.
const keyConfigured =
  config.embeddingProvider === "voyage"
    ? Boolean(config.voyageApiKey)
    : Boolean(config.openaiApiKey);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Current numDimensions of the vector index, or null if the index is absent.
async function existingIndexDimensions(
  collection: Collection<Note>,
): Promise<number | null> {
  const indexes = await collection.listSearchIndexes().toArray();
  const idx = indexes.find((i) => i.name === VECTOR_INDEX);
  if (!idx) return null;
  const fields = idx.latestDefinition?.fields as
    | { path?: string; numDimensions?: number }[]
    | undefined;
  const vec = fields?.find((f) => f.path === "embedding");
  return vec?.numDimensions ?? null;
}

async function dropVectorIndex(collection: Collection<Note>): Promise<void> {
  console.log(`Dropping vector index '${VECTOR_INDEX}'...`);
  await collection.dropSearchIndex(VECTOR_INDEX);
  // Drops are asynchronous in Atlas — wait until it's actually gone so the
  // recreate below doesn't collide with the tail end of the drop.
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if ((await existingIndexDimensions(collection)) === null) {
      console.log("  index dropped.");
      return;
    }
    await sleep(2000);
  }
  throw new Error(
    `Timed out waiting for '${VECTOR_INDEX}' to drop; check Atlas UI and retry.`,
  );
}

async function createVectorIndex(collection: Collection<Note>): Promise<void> {
  console.log(
    `Creating vector index '${VECTOR_INDEX}' (${config.embeddingDimensions} dims)...`,
  );
  await collection.createSearchIndex({
    name: VECTOR_INDEX,
    type: "vectorSearch",
    definition: vectorIndexDefinition(),
  });
  console.log("  index creation started (builds in the background).");
}

async function reembedAll(collection: Collection<Note>): Promise<void> {
  const notes = await collection
    .find({}, { projection: { title: 1, markdown: 1, tags: 1 } })
    .toArray();

  if (notes.length === 0) {
    console.log("No notes to embed.");
    return;
  }

  console.log(
    `Re-embedding ${notes.length} notes via ${config.embeddingProvider} (${config.embeddingModel})...`,
  );
  let ok = 0;
  for (const note of notes) {
    const text = prepareTextForEmbedding(
      note.title ?? "",
      note.markdown ?? "",
      note.tags ?? [],
    );
    try {
      const embedding = await generateEmbedding(text, "document");
      if (!embedding) {
        console.error(`  ✗ No embedding returned: ${note.title}`);
        continue;
      }
      await collection.updateOne({ _id: note._id }, { $set: { embedding } });
      ok++;
      process.stdout.write(`  ✓ ${note.title}\n`);
    } catch (err) {
      console.error(`  ✗ Failed to embed: ${note.title}`, err);
    }
  }
  console.log(`Re-embedded ${ok}/${notes.length} notes.`);
}

// The local store never holds embeddings, but edits/switches may have left
// rows flagged embedding_pending. Clear them so the sync engine doesn't
// immediately re-embed everything again with a duplicate round of API calls.
function clearLocalPendingFlags(): void {
  try {
    const sqlite = getSqlite();
    const res = sqlite
      .prepare("UPDATE notes SET embedding_pending = 0 WHERE embedding_pending = 1")
      .run();
    if (Number(res.changes) > 0) {
      console.log(`Cleared embedding_pending on ${res.changes} local rows.`);
    }
  } catch (err) {
    // The local DB may not exist yet (e.g. running against a fresh checkout);
    // that's fine — there are no flags to clear.
    console.warn("Could not update local SQLite flags:", err);
  } finally {
    closeSqlite();
  }
}

async function main() {
  if (!config.mongodbUri) {
    console.error("MONGODB_URI is required in .env");
    process.exit(1);
  }
  if (!keyConfigured) {
    const keyName =
      config.embeddingProvider === "voyage" ? "VOYAGE_API_KEY" : "OPENAI_API_KEY";
    console.error(
      `${keyName} is required for provider '${config.embeddingProvider}'`,
    );
    process.exit(1);
  }

  const client = new MongoClient(config.mongodbUri);
  try {
    await client.connect();
    const collection = client.db(config.dbName).collection<Note>("notes");

    const currentDims = await existingIndexDimensions(collection);
    const targetDims = config.embeddingDimensions;

    if (keepIndex) {
      console.log("Skipping vector index changes (--keep-index).");
      await reembedAll(collection);
    } else if (currentDims === null) {
      // No index yet — embed first so the index has vectors to ingest, then create.
      await reembedAll(collection);
      await createVectorIndex(collection);
    } else if (currentDims !== targetDims) {
      // Dimension change: drop the old index, re-embed at the new size, recreate.
      console.log(
        `Vector dimensions changing ${currentDims} -> ${targetDims}; rebuilding index.`,
      );
      await dropVectorIndex(collection);
      await reembedAll(collection);
      await createVectorIndex(collection);
    } else {
      // Same dimensions (e.g. same-size model swap) — index can stay; just refresh vectors.
      console.log(
        `Vector index already at ${targetDims} dims; re-embedding in place.`,
      );
      await reembedAll(collection);
    }

    // Rebuilding the vector index can take the co-located full-text Search
    // index down with it on some Atlas tiers — make sure it still exists so
    // text search keeps working after a provider switch.
    await ensureSearchIndex(collection);

    clearLocalPendingFlags();
    console.log("\nDone. If an index was rebuilt, allow 1-5 min for it to finish building.");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Shared Atlas Search / Vector Search index definitions and helpers, used by
// both scripts/create-indexes.ts and scripts/reembed.ts so the two never drift.
import type { Collection, Document } from "mongodb";
import { config } from "../config.js";

export const SEARCH_INDEX = "notes_search_index";
export const VECTOR_INDEX = "notes_vector_index";

// Full-text Atlas Search index over title / markdown / tags.
export const searchIndexDefinition = {
  mappings: {
    dynamic: false,
    fields: {
      title: [
        { type: "string", analyzer: "lucene.standard" },
        {
          type: "autocomplete",
          tokenization: "edgeGram",
          minGrams: 2,
          maxGrams: 15,
        },
      ],
      markdown: {
        type: "string",
        analyzer: "lucene.standard",
      },
      tags: [
        { type: "string", analyzer: "lucene.keyword" },
        { type: "token" },
      ],
    },
  },
};

// Vector Search index; dimensions follow the configured embedding provider.
export function vectorIndexDefinition() {
  return {
    fields: [
      {
        type: "vector",
        path: "embedding",
        numDimensions: config.embeddingDimensions,
        similarity: "cosine",
      },
    ],
  };
}

export async function hasSearchIndex(
  collection: Collection<Document>,
  name: string,
): Promise<boolean> {
  const indexes = await collection.listSearchIndexes().toArray();
  return indexes.some((i) => i.name === name);
}

// Create the full-text Search index if it's missing. Idempotent — a no-op when
// it already exists, so it's safe to call after other index operations.
export async function ensureSearchIndex(
  collection: Collection<Document>,
): Promise<void> {
  if (await hasSearchIndex(collection, SEARCH_INDEX)) {
    console.log(`Atlas Search index '${SEARCH_INDEX}' already present.`);
    return;
  }
  console.log(`Creating Atlas Search index '${SEARCH_INDEX}'...`);
  await collection.createSearchIndex({
    name: SEARCH_INDEX,
    definition: searchIndexDefinition,
  });
  console.log("  index creation started (builds in the background).");
}

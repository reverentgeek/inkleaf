import { getDb } from "../db/connection.js";
import { isOnline } from "./sync.service.js";
import { localSearch, localAutocomplete } from "./local-search.service.js";
import { hybridSearch } from "./hybrid-search.service.js";
import { isEmbeddingConfigured } from "./embeddings.js";
import type { SearchResult, AutocompleteResult } from "../types/index.js";

/**
 * The one search entry point, degrading in three steps:
 *
 *   1. hybrid ($rankFusion over Atlas Search + Vector Search) — online, with an
 *      embedding provider configured
 *   2. text-only Atlas Search — online, but no embedding available
 *   3. local FTS5 over SQLite — offline
 *
 * Every step returns the same wire shape, so the frontend never branches on
 * which engine answered.
 */
export async function searchNotes(
  query: string,
  tags?: string[],
): Promise<SearchResult[]> {
  // Offline → local FTS5 over the SQLite store (same response shape).
  if (!isOnline()) return localSearch(query, tags);

  if (isEmbeddingConfigured()) {
    try {
      const results = await hybridSearch(query, tags);
      // null means the embedding call came back empty — fall through to text.
      if (results) return results;
    } catch (err) {
      // Cluster below MongoDB 8.0, embedding provider outage, missing vector
      // index. Text search still works, so degrade instead of failing.
      console.warn("Hybrid search failed, falling back to text search:", err);
    }
  }

  try {
    return await atlasSearch(query, tags);
  } catch (err) {
    // Covers going offline between sync ticks.
    console.warn("Atlas Search failed, falling back to local search:", err);
    return localSearch(query, tags);
  }
}

async function atlasSearch(
  query: string,
  tags?: string[],
): Promise<SearchResult[]> {
  const db = getDb();

  const must: Record<string, unknown>[] = [
    {
      text: {
        query,
        path: ["title", "markdown"],
        fuzzy: { maxEdits: 1 },
      },
    },
  ];

  const filter: Record<string, unknown>[] = [];
  if (tags && tags.length > 0) {
    filter.push({
      text: {
        query: tags,
        path: "tags",
      },
    });
  }

  const pipeline = [
    {
      $search: {
        index: "notes_search_index",
        compound: {
          must,
          ...(filter.length > 0 ? { filter } : {}),
        },
        highlight: {
          path: ["title", "markdown"],
        },
      },
    },
    // Exclude trashed notes (soft-deleted docs remain in Atlas with deletedAt
    // set; `null` also matches docs that never had the field).
    { $match: { deletedAt: null } },
    {
      $project: {
        title: 1,
        markdown: 1,
        tags: 1,
        score: { $meta: "searchScore" },
        highlights: { $meta: "searchHighlights" },
      },
    },
    { $limit: 20 },
  ];

  return db
    .collection("notes")
    .aggregate<SearchResult>(pipeline)
    .toArray();
}

export async function autocompleteNotes(
  query: string,
): Promise<AutocompleteResult[]> {
  if (!isOnline()) return localAutocomplete(query);
  try {
    return await atlasAutocomplete(query);
  } catch (err) {
    console.warn("Atlas autocomplete failed, falling back to local:", err);
    return localAutocomplete(query);
  }
}

async function atlasAutocomplete(
  query: string,
): Promise<AutocompleteResult[]> {
  const db = getDb();

  const pipeline = [
    {
      $search: {
        index: "notes_search_index",
        autocomplete: {
          query,
          path: "title",
        },
      },
    },
    { $match: { deletedAt: null } },
    {
      $project: {
        title: 1,
      },
    },
    { $limit: 8 },
  ];

  return db
    .collection("notes")
    .aggregate<AutocompleteResult>(pipeline)
    .toArray();
}

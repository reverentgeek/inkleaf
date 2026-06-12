import { getDb } from "../db/connection.js";
import { isOnline } from "./sync.service.js";
import { localSearch, localAutocomplete } from "./local-search.service.js";
import type { SearchResult, AutocompleteResult } from "../types/index.js";

export async function searchNotes(
  query: string,
  tags?: string[],
): Promise<SearchResult[]> {
  // Offline → local FTS5 over the SQLite store (same response shape).
  if (!isOnline()) return localSearch(query, tags);
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

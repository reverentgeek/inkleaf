import { getDb } from "../db/connection.js";
import type { SearchResult, AutocompleteResult } from "../types/index.js";

export async function searchNotes(
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

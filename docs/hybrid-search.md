# Walkthrough: Hybrid Search

Traces the full data flow when a user searches in Inkleaf, from the keyboard shortcut through the query embedding to MongoDB's `$rankFusion` stage and back to the UI.

There used to be two searches here: `Cmd+K` for keyword, `Cmd+Shift+K` for semantic. Making the user pick a mode before they've typed anything was always the weak part of the demo, and hybrid search removes the choice. One box, both retrievers, merged by rank.

```text
 Tauri Webview (localhost:5173)              Express Backend (localhost:3001)
 ================================            ================================
 Cmd+K
   |
   v
 setCommandPaletteOpen(true)                GET /api/search?q=...
   |  (App.tsx → Zustand)                      |  (routes/search.ts)
   v                                            v
 CommandPalette.tsx                           searchService.searchNotes(q)
   |  200ms debounce on query                   |  picks a strategy, degrades
   v                                            v
 useSearch.search(query)                     hybridSearch(q)
   |  (hooks/useSearch.ts)                      |  (services/hybrid-search.service.ts)
   v                                            v
 api.search.query(query)                     generateEmbedding(q, "query")
   |  (api/client.ts)                           |  Voyage voyage-4-lite (or OpenAI)
   |  GET request ───────────────────>          v
   |                                         $rankFusion
   |                                            |  text:   $search   (notes_search_index)
   |                                            |  vector: $vectorSearch (notes_vector_index)
   |                                            |  weights 0.4 / 0.6, rankConstant 60
   |                                            v
   |                                         + parallel $search for highlights
   v                                            |  joined back by _id
 SearchResult[]                                 v
   |                                         Response: SearchResult[]
   v                                            score, highlights, matchedBy
 SearchResults.tsx
   highlights + retriever badges
```

---

## Step 1: Keyboard Shortcut, `Cmd+K`

Global keyboard shortcuts are registered in `App.tsx` via a `useEffect`:

**`frontend/src/App.tsx`**

```ts
const handleKeyDown = (e: KeyboardEvent) => {
  const isMod = e.metaKey || e.ctrlKey;

  // Cmd+K: Open command palette. One search now — /api/search fuses
  // full-text and vector results, so there's no separate semantic mode.
  if (isMod && e.key.toLowerCase() === "k") {
    e.preventDefault();
    setCommandPaletteOpen(true);
    return;
  }
```

`e.key.toLowerCase()` is still used because on macOS `e.key` stays lowercase even with Shift held when Cmd is pressed. That gotcha outlived the shortcut that needed it.

With the mode gone, so is `commandPaletteMode` in the Zustand store, and with it `openCommandPalette()`. Opening the palette is a single boolean now, which is the kind of deletion that makes a refactor feel worth it.

---

## Step 2: Command Palette

No tabs. One input, one placeholder that hedges toward both halves of the search:

**`frontend/src/components/search/CommandPalette.tsx`**

```tsx
<Command.Input
  autoFocus
  value={query}
  onValueChange={setQuery}
  placeholder="Search notes, or describe what you're looking for..."
  ...
/>
```

As the user types, a **200ms debounce** prevents excessive API calls. Worth noting: every keystroke past the debounce now costs an embedding API call, which is the real price of hybrid search.

```ts
debounceRef.current = setTimeout(() => {
  search(query);
  autocomplete(query);
}, 200);
```

Autocomplete still runs alongside, and it's still `$search`-only. Prefix-matching note titles is a keyword problem, and a vector has nothing useful to say about a half-typed word.

---

## Step 3: useSearch Hook

The hook is down to one result set, because the backend no longer distinguishes:

**`frontend/src/hooks/useSearch.ts`**

```ts
const search = useCallback(async (query: string, tags?: string) => {
  if (!query.trim()) {
    setSearchResults([]);
    return;
  }
  setIsSearching(true);
  try {
    const results = await api.search.query(query, tags);
    setSearchResults(Array.isArray(results) ? results : []);
  } catch (err) {
    console.error("Search failed:", err);
    setSearchResults([]);
  } finally {
    setIsSearching(false);
  }
}, []);
```

While `isSearching` is `true`, the palette shows a spinner next to the input.

---

## Step 4: The Strategy Ladder

`GET /api/search` is the only query surface, and `searchNotes()` decides how to answer it:

**`backend/src/services/search.service.ts`**

```ts
export async function searchNotes(
  query: string,
  tags?: string[],
): Promise<SearchResult[]> {
  if (!isOnline()) return localSearch(query, tags);

  if (isEmbeddingConfigured()) {
    try {
      const results = await hybridSearch(query, tags);
      if (results) return results;
    } catch (err) {
      console.warn("Hybrid search failed, falling back to text search:", err);
    }
  }

  try {
    return await atlasSearch(query, tags);
  } catch (err) {
    console.warn("Atlas Search failed, falling back to local search:", err);
    return localSearch(query, tags);
  }
}
```

Three rungs, each returning the identical wire shape:

| Condition                                        | Engine                              |
| ------------------------------------------------ | ----------------------------------- |
| Online, embedding provider configured            | Hybrid `$rankFusion`                |
| Online, no embedding available (or it failed)     | Text-only `$search`                 |
| Offline                                          | SQLite FTS5                         |

This is why the frontend never asks which engine answered. It's also the design that lets an M0 cluster on MongoDB 7 run this app: `$rankFusion` throws, the warning gets logged, and the user gets full-text search.

---

## Step 5: Query Embedding

Same as before, with one detail that matters: the query is embedded as a **query**, not a document.

```ts
const embedding = await generateEmbedding(query, "query");
if (!embedding) return null;
```

Voyage uses `input_type` to tune the vector asymmetrically, so a query embedding and a document embedding of the same words come out differently, on purpose. OpenAI ignores the parameter.

Returning `null` rather than `[]` is deliberate. It's the signal that says "no embedding, fall down a rung," which is different from "searched and found nothing."

---

## Step 6: `$rankFusion`

**`backend/src/services/hybrid-search.service.ts`**

```ts
{
  $rankFusion: {
    input: {
      pipelines: {
        text: [
          buildSearchStage(query, tags, false),
          { $match: { deletedAt: null } },
          { $limit: CANDIDATES },
        ],
        vector: [
          {
            $vectorSearch: {
              index: "notes_vector_index",
              path: "embedding",
              queryVector: embedding,
              numCandidates: CANDIDATES * 5,
              limit: CANDIDATES,
            },
          },
          { $match: { deletedAt: null } },
        ],
      },
    },
    combination: {
      weights: { text: 0.4, vector: 0.6 },
    },
    scoreDetails: true,
  },
}
```

Reciprocal rank fusion scores each document by where it *placed* in each retriever, not by what score it got:

```text
final_score = Σ  weight / (rank + 60)
```

That sidesteps the whole problem of comparing a BM25-ish `searchScore` (unbounded, roughly 1-10 here) against a cosine `vectorSearchScore` (0 to 1). You never have to normalize them, because ranks are already on the same scale.

The `60` is `rankConstant`, and it's fixed. It flattens the difference between the top few positions so a document that placed 1st in one retriever and nowhere in the other doesn't automatically beat a document that placed 3rd in both.

A few things the constants are doing:

| Setting                     | Why                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `CANDIDATES = 40`           | Wider than the final 20 on purpose. With no overlap between the two lists, RRF just interleaves them   |
| `numCandidates: 200`        | ANN search space for the vector half, 5× its own limit                                                 |
| `weights: 0.4 / 0.6`        | Vector leads slightly, because the text retriever already dominates on exact keyword matches. Tunable via `HYBRID_TEXT_WEIGHT` / `HYBRID_VECTOR_WEIGHT` |
| `$match: { deletedAt: null }` | Trashed notes are still in Atlas. This has to be in **both** sub-pipelines                            |
| `scoreDetails: true`        | Per-pipeline ranks, which become the UI badges                                                         |

Requirements: **MongoDB 8.0 or later**, and both indexes present on the collection. `$rankFusion` also doesn't support pagination, so `$limit` is the only knob for result count.

---

## Step 7: Getting Highlights Back

Here's the part that isn't in the docs' happy path.

`$rankFusion` sub-pipelines may only contain `$search`, `$vectorSearch`, `$match`, `$sort`, and `$geoNear`. No `$project`. And by the time the fusion stage emits documents, `$meta: "searchHighlights"` is gone. So the obvious approach, asking `$search` for highlights inside the sub-pipeline and projecting them after, doesn't work.

The workaround is to run the text retriever a second time, on its own, purely to harvest highlights, and join them onto the fused ranking by `_id`:

```ts
const highlightPipeline = [
  buildSearchStage(query, tags, true),  // withHighlight
  { $match: { deletedAt: null } },
  { $project: { highlights: { $meta: "searchHighlights" } } },
  { $limit: CANDIDATES },
];

const [fused, highlighted] = await Promise.all([
  notes.aggregate<FusedDoc>(fusionPipeline).toArray(),
  notes.aggregate(highlightPipeline).toArray(),
]);
```

Both aggregations run in parallel, and the `$search` stage itself is built by one shared function, so the two runs can't drift apart. Yes, this means the text retriever executes twice. That's the cost of keeping highlights, and highlights are most of what makes a search result readable.

That leaves documents only the *vector* retriever found. They have no keyword hit to highlight, by definition. `services/snippet.ts` fills the gap with Atlas-shaped output so the UI can't tell the difference:

```ts
const built = buildHighlight(doc.markdown, query);
return built.length > 0 ? built : buildExcerpt(doc.markdown);
```

`buildHighlight()` marks any query terms that do appear in the body (a semantic hit often shares *some* words), windowed around the first match. `buildExcerpt()` is the last resort: a plain leading excerpt, no marks. Both emit the same `{ value, type: "hit" | "text" }` segments that Atlas Search returns and that the local FTS5 path already mimics.

---

## Step 8: Provenance

`scoreDetails` reports the rank each sub-pipeline gave a document. A pipeline that didn't return it reports no positive rank, which makes ranks a usable "who found this" signal:

```ts
function matchedBy(doc: FusedDoc): SearchResult["matchedBy"] {
  const matched: SearchResult["matchedBy"] = [];
  for (const detail of doc.scoreDetails?.details ?? []) {
    const name = detail.inputPipelineName;
    if ((name === "text" || name === "vector") && (detail.rank ?? 0) > 0) {
      matched.push(name);
    }
  }
  return matched;
}
```

This ships to the frontend as `matchedBy: ["text", "vector"]` and renders as small icons on each result: a magnifier for a keyword match, a sparkle for a semantic one, both when both retrievers agreed. It's the honest version of a search demo, since you can see the fusion working instead of taking it on faith.

---

## Step 9: Results Rendered in the UI

```ts
interface SearchResult {
  _id: string;
  title: string;
  markdown: string;
  tags: string[];
  score: number;                        // fused RRF score, ~0.01-0.03
  highlights: SearchHighlight[];
  matchedBy?: Array<"text" | "vector">; // absent on text-only and offline results
}
```

Two small rendering details follow from fusion. Scores print to **three** decimals, because RRF sums `weight / (rank + 60)` and neighboring results differ in the third place. And since Atlas returns a highlight per matching passage and the first one doesn't always contain a marked term, the component prefers a passage that does:

**`frontend/src/components/search/SearchResults.tsx`**

```ts
const best =
  highlights.find((h) => h.texts.some((t) => t.type === "hit")) ??
  highlights[0];
```

Clicking a result sets `activeNoteId` in the Zustand store and closes the palette.

---

## Summary

| Layer          | File                                        | What happens                                                        |
| -------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| Shortcut       | `App.tsx`                                   | `Cmd+K` → `setCommandPaletteOpen(true)`                             |
| Palette        | `components/search/CommandPalette.tsx`      | 200ms debounce, calls `search(query)` + `autocomplete(query)`        |
| Hook           | `hooks/useSearch.ts`                        | `api.search.query(query)`, one result set                           |
| API Client     | `api/client.ts`                             | `GET /api/search?q=...`                                             |
| Route          | `routes/search.ts`                          | Validates `q`, delegates to the service                             |
| Strategy       | `services/search.service.ts`                | hybrid → text-only → local FTS5, same shape from each               |
| Embedding      | `services/embeddings.ts`                    | Voyage `voyage-4-lite` (1024-dim) with `input_type: "query"`         |
| Fusion         | `services/hybrid-search.service.ts`         | `$rankFusion` over `$search` + `$vectorSearch`, weights 0.4 / 0.6   |
| Highlights     | `services/hybrid-search.service.ts`         | Parallel `$search` run, joined by `_id`                             |
| Snippets       | `services/snippet.ts`                       | Synthesized highlights for vector-only hits                         |
| Results        | `components/search/SearchResults.tsx`       | Highlighted passage plus keyword/semantic badges                    |

## Related

- [Saving a note](save-note.md), which is how the embeddings these searches depend on get generated
- [Hybrid search with `$rankFusion`](https://www.mongodb.com/docs/vector-search/hybrid-search/hybrid-search-overview/)

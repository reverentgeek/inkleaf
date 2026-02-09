# Walkthrough: Semantic Search

Traces the full data flow when a user performs a semantic (vector) search in Inkleaf — from the keyboard shortcut through OpenAI embedding to MongoDB Atlas Vector Search and back to the UI.

```
 Tauri Webview (localhost:5173)              Express Backend (localhost:3001)
 ================================            ================================
 Cmd+Shift+K
   |
   v
 openCommandPalette("semantic")             GET /api/semantic/search?q=...
   |  (App.tsx → Zustand)                      |  (routes/semantic.ts)
   v                                            v
 CommandPalette.tsx                           semanticService.semanticSearch(q)
   |  200ms debounce on query                   |  (services/semantic.service.ts)
   v                                            v
 useSearch.semanticSearch(query)             generateEmbedding(query)
   |  (hooks/useSearch.ts)                      |  (services/embeddings.ts)
   v                                            |  OpenAI text-embedding-3-small
 api.semantic.search(query)                     v
   |  (api/client.ts)                        $vectorSearch aggregation
   |  GET request ───────────────────>          |  notes_vector_index
   |                                            |  1536 dims, cosine, numCandidates:100
   v                                            v
 SemanticResult[]                            $project { title, markdown, tags, score }
   |                                            |
   v                                            v
 SearchResults.tsx                           Response: SemanticResult[] with scores
   renders score as percentage
```

---

## Step 1: Keyboard Shortcut — `Cmd+Shift+K`

Global keyboard shortcuts are registered in `App.tsx` via a `useEffect`:

**`frontend/src/App.tsx:9-16`**

```ts
const handleKeyDown = (e: KeyboardEvent) => {
  const isMod = e.metaKey || e.ctrlKey;

  // Cmd+K / Cmd+Shift+K: Open command palette
  if (isMod && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openCommandPalette(e.shiftKey ? "semantic" : "text");
    return;
  }
```

When Shift is held, the mode is `"semantic"`. Without Shift (`Cmd+K`), it's `"text"`.

Note: `e.key.toLowerCase()` is used because on macOS, `e.key` stays lowercase even with Shift held when Cmd is pressed.

The `openCommandPalette` action atomically sets both `commandPaletteOpen` and `commandPaletteMode` in a **single Zustand `set()` call** to avoid race conditions:

**`frontend/src/stores/appStore.ts:50`**

```ts
openCommandPalette: (mode) => set({ commandPaletteOpen: true, commandPaletteMode: mode }),
```

---

## Step 2: Command Palette Renders in Semantic Mode

The `CommandPalette` component reads the mode from the Zustand store and renders the appropriate UI:

**`frontend/src/components/search/CommandPalette.tsx:20-21`**

```ts
const mode = useAppStore((s) => s.commandPaletteMode);
const setMode = useAppStore((s) => s.setCommandPaletteMode);
```

The palette displays two tabs — **Text Search** and **Semantic Search** — with the active tab highlighted in emerald. In semantic mode, the placeholder reads "Describe what you're looking for..." (vs. "Search notes..." in text mode).

As the user types, a **200ms debounce** prevents excessive API calls:

**`frontend/src/components/search/CommandPalette.tsx:49-68`**

```ts
useEffect(() => {
  if (!query.trim()) {
    clearResults();
    return;
  }

  if (debounceRef.current) clearTimeout(debounceRef.current);

  debounceRef.current = setTimeout(() => {
    if (mode === "text") {
      search(query);
      autocomplete(query);
    } else {
      semanticSearch(query);
    }
  }, 200);

  return () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };
}, [query, mode, search, autocomplete, semanticSearch, clearResults]);
```

When mode is `"semantic"`, only `semanticSearch(query)` is called (no autocomplete).

---

## Step 3: useSearch Hook — `semanticSearch()`

The `useSearch` hook manages search state and API calls:

**`frontend/src/hooks/useSearch.ts:42-57`**

```ts
const semanticSearch = useCallback(async (query: string) => {
  if (!query.trim()) {
    setSemanticResults([]);
    return;
  }
  setIsSearching(true);
  try {
    const results = await api.semantic.search(query);
    setSemanticResults(Array.isArray(results) ? results : []);
  } catch (err) {
    console.error("Semantic search failed:", err);
    setSemanticResults([]);
  } finally {
    setIsSearching(false);
  }
}, []);
```

While `isSearching` is `true`, the `CommandPalette` displays a spinning indicator next to the search input.

---

## Step 4: HTTP Request

The API client sends the query as a URL parameter:

**`frontend/src/api/client.ts:95-98`**

```ts
semantic: {
  search: (q: string) =>
    request<SemanticResult[]>(
      `/semantic/search?q=${encodeURIComponent(q)}`,
    ),
```

This fires `GET http://localhost:3001/api/semantic/search?q=how%20does%20aggregation%20work` (the query is URL-encoded).

The request passes through the Tauri CSP gate — `connect-src http://localhost:3001` in `frontend/src-tauri/tauri.conf.json:22` whitelists the backend origin.

---

## Step 5: Express Route

The request hits the semantic route handler:

**`backend/src/routes/semantic.ts:7-15`**

```ts
router.get("/search", async (req: Request, res: Response) => {
  const q = req.query.q as string;
  if (!q) {
    res.status(400).json({ error: "Query parameter 'q' is required" });
    return;
  }
  const results = await semanticService.semanticSearch(q);
  res.json(results);
});
```

Validates that `q` is present, then delegates to the service layer.

---

## Step 6: Query Embedding — Vectorize the Search Text

The service first converts the user's natural-language query into a vector:

**`backend/src/services/semantic.service.ts:6-10`**

```ts
export async function semanticSearch(query: string): Promise<SemanticResult[]> {
  const embedding = await generateEmbedding(query);
  if (!embedding) {
    return [];
  }
```

`generateEmbedding()` in `backend/src/services/embeddings.ts:24-39` calls the OpenAI API:

```ts
const response = await client.embeddings.create({
  model: "text-embedding-3-small",
  input: text,
});
return response.data[0].embedding;
```

This returns a **1536-dimensional float vector** representing the semantic meaning of the query. The same model (`text-embedding-3-small`) is used for both note embeddings and query embeddings — this is critical because vector similarity only works when both sides use the same embedding model and dimensions.

If `OPENAI_API_KEY` is not set, `generateEmbedding()` returns `null` and the search returns an empty array.

---

## Step 7: Atlas Vector Search — `$vectorSearch` Aggregation

With the query vector in hand, the service runs a MongoDB aggregation pipeline:

**`backend/src/services/semantic.service.ts:12-36`**

```ts
const db = getDb();
const pipeline = [
  {
    $vectorSearch: {
      index: "notes_vector_index",
      path: "embedding",
      queryVector: embedding,
      numCandidates: 100,
      limit: 10,
    },
  },
  {
    $project: {
      title: 1,
      markdown: 1,
      tags: 1,
      score: { $meta: "vectorSearchScore" },
    },
  },
];

return db
  .collection("notes")
  .aggregate<SemanticResult>(pipeline)
  .toArray();
```

Key parameters of `$vectorSearch`:

| Parameter       | Value                  | Description                                                                         |
| --------------- | ---------------------- | ----------------------------------------------------------------------------------- |
| `index`         | `"notes_vector_index"` | The Atlas Vector Search index on the `notes` collection                             |
| `path`          | `"embedding"`          | The document field containing the stored vectors                                    |
| `queryVector`   | `embedding`            | The 1536-dim vector from Step 6                                                     |
| `numCandidates` | `100`                  | How many candidates the ANN algorithm considers (higher = more accurate but slower) |
| `limit`         | `10`                   | Return the top 10 closest matches                                                   |

The `$project` stage shapes the output: it includes `title`, `markdown`, `tags`, and exposes the **cosine similarity score** via `{ $meta: "vectorSearchScore" }`. The score ranges from 0 to 1, where 1 is a perfect match.

The `notes_vector_index` is an Atlas Vector Search index configured for:

- **1536 dimensions** (matching `text-embedding-3-small` output)
- **Cosine similarity** distance function

---

## Step 8: Results Rendered in the UI

The response is an array of `SemanticResult` objects:

```ts
interface SemanticResult {
  _id: string;
  title: string;
  markdown: string;
  tags: string[];
  score: number;  // 0-1 cosine similarity
}
```

Back in the frontend, `useSearch` stores these in `semanticResults` state. The `CommandPalette` passes them to `SearchResults`:

**`frontend/src/components/search/SearchResults.tsx:44-69`**

```tsx
{results.map((r) => (
  <button key={r._id} onClick={() => onSelect(r._id)} ...>
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <FileText size={12} className="text-slate-500 flex-shrink-0" />
        <span className="text-sm text-slate-200 truncate">{r.title}</span>
      </div>
      <span className="text-xs text-slate-500 flex-shrink-0">
        {mode === "text"
          ? `${r.score.toFixed(2)}`
          : `${(r.score * 100).toFixed(0)}%`}
      </span>
    </div>
    {mode === "semantic" && (
      <p className="text-xs text-slate-500 mt-1 truncate">
        {r.markdown?.slice(0, 100)}
      </p>
    )}
  </button>
))}
```

In semantic mode, each result displays:

- The note **title**
- The similarity **score as a percentage** (e.g., `0.87` → `87%`)
- A **100-character preview** of the markdown content

Clicking a result calls `onSelect(r._id)`, which sets the `activeNoteId` in the Zustand store and closes the command palette.

---

## Summary

| Layer         | File                                      | What happens                                                |
| ------------- | ----------------------------------------- | ----------------------------------------------------------- |
| Shortcut      | `App.tsx:13`                              | `Cmd+Shift+K` → `openCommandPalette("semantic")`            |
| Zustand       | `stores/appStore.ts:50`                   | Atomically sets `open: true, mode: "semantic"`              |
| Palette       | `components/search/CommandPalette.tsx:57` | 200ms debounce, calls `semanticSearch(query)`               |
| Hook          | `hooks/useSearch.ts:42`                   | `api.semantic.search(query)`                                |
| API Client    | `api/client.ts:96`                        | `GET /api/semantic/search?q=...`                            |
| Route         | `routes/semantic.ts:7`                    | Passes query to `semanticService.semanticSearch()`          |
| Embedding     | `services/embeddings.ts:33`               | OpenAI `text-embedding-3-small` → 1536-dim vector           |
| Vector Search | `services/semantic.service.ts:13`         | `$vectorSearch` aggregation: cosine, 100 candidates, top 10 |
| Results       | `components/search/SearchResults.tsx:56`  | Score displayed as percentage, 100-char preview             |

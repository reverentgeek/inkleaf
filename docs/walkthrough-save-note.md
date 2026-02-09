# Walkthrough: Saving a Note

Traces the full data flow when a user edits a note in Inkleaf — from keystrokes in the Tauri webview through to MongoDB Atlas and async embedding generation.

```
 Tauri Webview (localhost:5173)              Express Backend (localhost:3001)
 ================================            ================================
 CodeMirror editor
   |
   v
 handleMarkdownChange()                     PUT /api/notes/:id
   |  (Layout.tsx)                              |  (routes/notes.ts)
   v                                            v
 useNotes.updateNote()                       notesService.updateNote()
   |  1. Optimistic Zustand update              |  (services/notes.service.ts)
   |  2. Debounce 400ms                         v
   v                                         findOneAndUpdate() ──> MongoDB Atlas
 api.notes.update(id, data)                     |                    `notes` collection
   |  (api/client.ts)                           v
   |  PUT request ──────────────────>        updateEmbedding()  (fire-and-forget)
   |  through Tauri CSP whitelist               |
   |                                            v
   |                                         OpenAI text-embedding-3-small
   |                                            |
   |                                            v
   |                                         updateOne({ $set: { embedding } })
   v                                            |
 Response (updated Note JSON)                   v
                                             1536-dim vector stored on `embedding` field
```

---

## Step 1: Tauri Webview — User Types in the Editor

The user types inside a **CodeMirror 6** editor rendered by `MarkdownEditor`. Every keystroke triggers CodeMirror's `onChange` callback, which propagates up to `Layout.tsx`.

**`frontend/src/components/layout/Layout.tsx:82-91`**

```ts
const handleMarkdownChange = useCallback(
  (markdown: string) => {
    if (!activeNoteId) return;
    if (isVaultMode) {
      updateVaultNote(activeNoteId, { markdown });
    } else {
      updateNote(activeNoteId, { markdown });
    }
  },
  [activeNoteId, isVaultMode, updateNote, updateVaultNote],
);
```

For regular (non-vault) notes, this calls `updateNote()` from the `useNotes` hook.

---

## Step 2: Optimistic State Update + Debounced API Call

`useNotes.updateNote()` does two things: an **immediate** local update and a **debounced** network save.

**`frontend/src/hooks/useNotes.ts:48-63`**

```ts
const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

const updateNote = useCallback(
  (id: string, data: Partial<Note>) => {
    // Optimistic local update immediately
    setNotes(notes.map((n) => (n._id === id ? { ...n, ...data } : n)));

    // Debounce the API call
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await api.notes.update(id, data);
      } catch (err) {
        console.error("Failed to update note:", err);
      }
    }, 400);
  },
  [notes, setNotes],
);
```

1. **Optimistic update**: `setNotes()` immediately updates the Zustand store with the new markdown, so the UI feels instant — no loading spinner, no waiting.
2. **Debounce (400ms)**: The actual HTTP request is delayed. Each new keystroke resets the timer. The request only fires 400ms after the user stops typing.

The Zustand store (`frontend/src/stores/appStore.ts:35`) holds the `notes` array:

```ts
setNotes: (notes) => set({ notes }),
```

---

## Step 3: HTTP Request

When the debounce timer fires, the hook calls:

**`frontend/src/api/client.ts:74-78`**

```ts
update: (id: string, data: Partial<Note>) =>
  request<Note>(`/notes/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }),
```

This sends `PUT http://localhost:3001/api/notes/:id` with a JSON body containing the changed fields (e.g., `{ "markdown": "# Updated content..." }`).

The `request()` helper (`client.ts:3-13`) sets the `Content-Type: application/json` header and throws on non-2xx responses.

---

## Step 4: Tauri CSP Gate

Because the frontend runs inside a **Tauri v2 webview**, the Content Security Policy controls which origins the webview can contact. The CSP is configured in:

**`frontend/src-tauri/tauri.conf.json:22`**

```json
"csp": "default-src 'self'; ... connect-src http://localhost:3001 https://localhost:3001 ..."
```

The `connect-src http://localhost:3001` directive explicitly whitelists the Express backend. Without this, the `fetch()` call would be blocked by the webview's security sandbox.

---

## Step 5: Express Route

The request arrives at the Express backend (running on port 3001). The route handler is:

**`backend/src/routes/notes.ts:27-34`**

```ts
router.put("/:id", async (req: Request, res: Response) => {
  const note = await notesService.updateNote(req.params.id as string, req.body);
  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  res.json(note);
});
```

It extracts the note ID from the URL params (cast with `as string` due to Express v5 types) and passes the request body to the service layer.

---

## Step 6: MongoDB Write

The service layer performs the actual database operation:

**`backend/src/services/notes.service.ts:66-91`**

```ts
export async function updateNote(
  id: string,
  data: Partial<Pick<Note, "title" | "markdown" | "tags" | "notebookId">>,
): Promise<Note | null> {
  const update: Record<string, unknown> = {
    ...data,
    updatedAt: new Date(),
  };

  const result = await getCollection().findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: "after", projection: { embedding: 0 } },
  );

  // Fire-and-forget embedding regeneration if content changed
  if (result && (data.markdown !== undefined || data.title !== undefined || data.tags !== undefined)) {
    updateEmbedding(new ObjectId(id), {
      title: result.title,
      markdown: result.markdown,
      tags: result.tags,
    });
  }

  return result;
}
```

Key details:

- `findOneAndUpdate()` atomically updates the document and returns the new version (`returnDocument: "after"`)
- `updatedAt` is set server-side to `new Date()` on every save
- The `embedding` field is excluded from the response via `projection: { embedding: 0 }` (the frontend never needs the raw 1536-dim vector)
- The `getCollection()` helper (`notes.service.ts:8-10`) retrieves the `notes` collection from the database connection singleton (`backend/src/db/connection.ts`)

---

## Step 7: Async Embedding Generation (Fire-and-Forget)

If any content field changed (`markdown`, `title`, or `tags`), the service calls `updateEmbedding()` **without awaiting it** — this is a fire-and-forget operation that runs after the HTTP response is already sent.

**`backend/src/services/notes.service.ts:12-25`**

```ts
async function updateEmbedding(noteId: ObjectId, note: Pick<Note, "title" | "markdown" | "tags">) {
  try {
    const text = prepareTextForEmbedding(note.title, note.markdown, note.tags);
    const embedding = await generateEmbedding(text);
    if (embedding) {
      await getCollection().updateOne(
        { _id: noteId },
        { $set: { embedding } },
      );
    }
  } catch (err) {
    console.error("Failed to update embedding:", err);
  }
}
```

This calls two functions from `backend/src/services/embeddings.ts`:

1. **`prepareTextForEmbedding()`** (`embeddings.ts:14-22`) — concatenates title, markdown, and tags (comma-separated) into a single string, truncated to 8,000 characters:

   ```ts
   const parts = [title, markdown, tags.join(", ")];
   const combined = parts.filter(Boolean).join("\n\n");
   return combined.slice(0, 8000);
   ```

2. **`generateEmbedding()`** (`embeddings.ts:24-39`) — sends the text to OpenAI's `text-embedding-3-small` model and returns a 1536-dimensional vector:

   ```ts
   const response = await client.embeddings.create({
     model: "text-embedding-3-small",
     input: text,
   });
   return response.data[0].embedding;
   ```

The resulting vector is written back to the `embedding` field of the same document via `updateOne()`. This keeps the note's vector embedding in sync with its content, powering semantic search and "related notes" features.

If `OPENAI_API_KEY` is not configured, `generateEmbedding()` returns `null` and the embedding is silently skipped.

---

## Summary

| Layer      | File                                   | What happens                                      |
| ---------- | -------------------------------------- | ------------------------------------------------- |
| Editor     | `components/editor/MarkdownEditor.tsx` | CodeMirror fires `onChange`                       |
| Layout     | `components/layout/Layout.tsx:82`      | `handleMarkdownChange` calls `updateNote()`       |
| Hook       | `hooks/useNotes.ts:48`                 | Optimistic Zustand update + 400ms debounce        |
| API Client | `api/client.ts:74`                     | `PUT /api/notes/:id` with JSON body               |
| Tauri CSP  | `src-tauri/tauri.conf.json:22`         | `connect-src` whitelist allows the request        |
| Route      | `routes/notes.ts:27`                   | Passes to `notesService.updateNote()`             |
| Service    | `services/notes.service.ts:66`         | `findOneAndUpdate()` on `notes` collection        |
| Embedding  | `services/notes.service.ts:12`         | Fire-and-forget: OpenAI embedding → `updateOne()` |

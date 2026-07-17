# Inkleaf

A Tauri v2 desktop app: personal Markdown knowledge base demonstrating MongoDB Atlas Search and Atlas Vector Search.

## Architecture

- **Frontend**: React 19 + Vite 7 + Tailwind CSS 4, runs in Tauri v2 webview (localhost:5173)
- **Backend**: Express 5 + TypeScript on Node.js, standalone process (localhost:3001)
- **Database**: MongoDB Atlas — `notes` collection (searchable)
- **Offline-first**: notes CRUD is served from a local SQLite store (`backend/data/inkleaf.db`, via built-in `node:sqlite`); a background sync engine (`services/sync.service.ts`) pushes dirty rows to Atlas and pulls remote changes (last-write-wins by `updatedAt`, ID reconciliation handles remote *permanent* deletes + reseeds). Text search falls back to SQLite FTS5 when Atlas is unreachable; semantic search is online-only (503 `{code:"OFFLINE"}`). `GET/POST /api/sync[/now]` exposes status; frontend polls it (`useSyncStatus`) into the Zustand store and shows a header indicator.
- **Soft delete (recoverable)**: deleting a note trashes it — it's hidden from reads but kept. In SQLite `deleted=1` + `deleted_at` mark the tombstone; in Atlas the doc is kept with a `deletedAt` field (never removed). Restore clears both; **permanent** delete (`purge_pending=1`) is the only op that actually removes the Atlas doc + local row. Endpoints: `GET /api/notes/trash`, `POST /api/notes/:id/restore`, `DELETE /api/notes/:id/permanent` (plain `DELETE /api/notes/:id` = soft). Search must exclude trashed docs: Atlas full-text/vector pipelines add `$match: { deletedAt: null }`, local FTS filters `deleted=0`. Frontend surfaces an undo toast (`components/Toast.tsx`) after delete and a Trash view in the sidebar (`sidebarView` in the store).
- **Package manager**: pnpm with workspaces (`frontend/`, `backend/`)
- Processes launched together via `concurrently` from root scripts

## Project Structure

```
inkleaf/
├── package.json              # Root: pnpm workspaces + concurrently scripts
├── pnpm-workspace.yaml
├── .env / .env.example
├── backend/
│   ├── src/
│   │   ├── index.ts          # Express server entry
│   │   ├── config.ts         # Env vars
│   │   ├── db/
│   │   │   └── connection.ts # Standard MongoClient singleton
│   │   ├── routes/           # notes, search, semantic
│   │   ├── services/         # Business logic for each route
│   │   ├── middleware/       # errorHandler
│   │   └── types/            # Note, SearchResult interfaces
│   └── scripts/              # seed, create-indexes
└── frontend/
    ├── src/
    │   ├── App.tsx           # Root + keyboard shortcuts
    │   ├── api/client.ts     # Typed fetch wrapper for all API endpoints
    │   ├── stores/appStore.ts # Zustand global state
    │   ├── hooks/            # useNotes, useSearch
    │   ├── components/
    │   │   ├── layout/       # Layout (3-column), Sidebar, Header
    │   │   ├── editor/       # MarkdownEditor (CodeMirror), MarkdownPreview
    │   │   ├── search/       # CommandPalette (cmdk), SearchResults
    │   │   ├── notes/        # NoteList, NoteCard, RelatedNotes
    │   │   └── tags/         # TagInput, TagFilter
    │   └── styles/globals.css
    └── src-tauri/            # Tauri v2 Rust config
```

## Scripts

All run from the project root with `pnpm`:

```bash
pnpm dev              # Backend + Vite frontend (browser)
pnpm dev:tauri        # Backend + Tauri desktop window
pnpm build            # TypeScript compile + Vite production build
pnpm seed             # Seed 17 sample notes (+ embeddings if OPENAI_API_KEY set); destructive — refuses if notes exist unless --force
pnpm create-indexes   # Create Atlas Search + Vector Search indexes
pnpm reembed          # Re-embed all notes with the configured provider; rebuilds the vector index if dimensions changed (use after switching EMBEDDING_PROVIDER). --keep-index to skip the index rebuild
```

## Versioning

The app version lives in **six** files that must be bumped together (they have drifted before):

- `package.json` (root)
- `frontend/package.json`
- `backend/package.json`
- `frontend/src-tauri/tauri.conf.json` — the version the desktop app reports
- `frontend/src-tauri/Cargo.toml`
- `frontend/src-tauri/Cargo.lock` — regenerate with `cargo update -p inkleaf` (run in `frontend/src-tauri/`), don't hand-edit

## Environment Variables (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | Atlas connection string |
| `EMBEDDING_PROVIDER` | No (default `voyage`) | Embedding backend: `voyage` (MongoDB's Voyage AI) or `openai` |
| `VOYAGE_API_KEY` | For Vector Search (voyage provider) | Voyage AI key; used against `https://ai.mongodb.com/v1/embeddings` |
| `OPENAI_API_KEY` | For Vector Search (openai provider) | OpenAI API key (needs `text-embedding-3-small` access) |
| `EMBEDDING_MODEL` | No | Override the model. Defaults: `voyage-4-lite` (voyage), `text-embedding-3-small` (openai) |
| `EMBEDDING_DIMENSIONS` | No | Override vector dimensions. Defaults: 1024 (voyage), 1536 (openai). Must match the model and the Atlas vector index |
| `PORT` | No (default 3001) | Backend port |
| `MONGODB_DB` | No (default `inkleaf`) | Database name |
| `SQLITE_PATH` | No (default `backend/data/inkleaf.db`) | Local offline store location |
| `SYNC_INTERVAL_MS` | No (default 15000) | Background sync tick interval |

## Key Dependencies

**Backend**: express 5, mongodb 7, openai 6, cors, dotenv 17, zod 4, tsx

**Frontend**: react 19, @uiw/react-codemirror, @codemirror/lang-markdown, @codemirror/theme-one-dark, cmdk, react-markdown 10, remark-gfm, rehype-highlight, zustand 5, lucide-react, @tauri-apps/api 2, tailwindcss 4, vite 7

## Data Models

### `notes` collection
```
_id, title, markdown, tags[], notebookId, createdAt, updatedAt, embedding[] (1536 dims for openai / 1024 for voyage)
```

## Atlas Indexes

- **`notes_search_index`** (Atlas Search): title (string + autocomplete edgeGram), markdown (string), tags (keyword + token)
- **`notes_vector_index`** (Vector Search): embedding field, `config.embeddingDimensions` dimensions (1536 openai / 1024 voyage), cosine similarity

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+N | Create a new note (focuses the title input) |
| Cmd+K | Open command palette (text search) |
| Cmd+Shift+K | Open command palette (semantic search) |
| Cmd+Shift+T | Toggle light/dark theme |
| Cmd+\ | Toggle sidebar |
| ↑ / ↓ | Previous / next note when the note list is focused |
| Cmd+O | Import a Markdown file as a new note (desktop menu accelerator) |
| Cmd+S | Export the active note as a Markdown file (desktop menu accelerator) |
| Escape | Close command palette |

## Coding Patterns & Gotchas

### Zustand
- When multiple state fields must update atomically, use a **single `set()` call** (e.g., `openCommandPalette` sets both `open` and `mode`). Separate `set()` calls cause race conditions where components see intermediate states.

### macOS Keyboard Events
- `e.key` stays **lowercase** even with Shift held when Cmd is pressed. Always use `e.key.toLowerCase()` + `e.shiftKey` instead of checking for uppercase keys like `"K"`.

### TypeScript
- Express v5 types: `req.params.id` is `string | string[]` — cast with `as string`
- React 19: use `React.ReactElement` instead of `JSX.Element`
- `useRef` in React 19 requires explicit initial value: `useRef<T>(undefined)`
- pnpm strict node_modules: Express route files need explicit `Router` type annotation (`const router: IRouter = Router()`) to avoid TS2742 errors

### Backend
- Uses `.js` extensions in all imports (NodeNext module resolution)
- Embedding generation is queued via the `embedding_pending` flag in SQLite and performed by the sync engine after content is pushed (works across offline periods)
- **Embedding provider** is pluggable in `services/embeddings.ts` behind `generateEmbedding(text, inputType)`. `EMBEDDING_PROVIDER=openai` uses the OpenAI SDK; `voyage` POSTs to `https://ai.mongodb.com/v1/embeddings` with a `Bearer VOYAGE_API_KEY`. `inputType` (`"document"` | `"query"`) is passed to Voyage's `input_type` for asymmetric embeddings (semantic-search queries use `"query"`, everything else `"document"`); OpenAI ignores it. Config derives model + dimensions per provider (`config.embeddingModel` / `config.embeddingDimensions`), and `create-indexes` reads `embeddingDimensions` for the vector index.
- **Switching providers is not hot-swappable**: OpenAI (1536) and Voyage (1024) vectors have different dimensions and live in different vector spaces — they are not comparable, and mixing them makes `$vectorSearch` error or return garbage. After changing `EMBEDDING_PROVIDER` (or `EMBEDDING_MODEL`) in `.env`, run **`pnpm reembed`** (`scripts/reembed.ts`), which does the full switch: rebuilds `notes_vector_index` when the dimensions change (drop → re-embed → recreate, in that order so the index never ingests mismatched vectors), re-embeds every Atlas note with the new provider, re-ensures the full-text `notes_search_index` exists (rebuilding the vector index can take the co-located text index down on some Atlas tiers — this is why text search broke on a bare drop/recreate), and clears local `embedding_pending` flags so the sync engine doesn't duplicate the work. Stop the backend first so the sync engine doesn't race it. `--keep-index` re-embeds only (for same-dimension model swaps). It is idempotent and safe to re-run. Both index definitions live in `src/db/search-indexes.ts`, shared by `reembed` and `create-indexes`.
- The MongoClient uses `serverSelectionTimeoutMS: 5000` — required so offline requests fail fast instead of hanging 30s; the server listens before Atlas connects (never `process.exit` on connect failure)
- Sync push must use `updateOne` + `$set`, never replace — SQLite doesn't store `embedding`, a replace would destroy vector data. Soft delete pushes `$set { deletedAt }` (keeps the doc); only `purge_pending` rows call `deleteOne`. Pull-phase ID-absence means a *permanent* remote delete (soft-deleted docs still exist remotely with `deletedAt`), so it hard-deletes locally.
- SQLite schema changes need an additive migration: `CREATE TABLE IF NOT EXISTS` won't add columns to an existing store. `db/sqlite.ts` `migrate()` runs guarded `ALTER TABLE ... ADD COLUMN` (checked via `PRAGMA table_info`) — this is how `deleted_at`/`purge_pending` reach pre-existing dbs.
- FTS5 `MATCH` throws on raw user input (`"`, `-`, `(`) — `local-search.service.ts` quote-wraps each token; keep that if touching local search
- The sync engine stores a `remote_identity` (redacted URI + db name) in `sync_state`; if `MONGODB_URI`/`MONGODB_DB` changes, it re-seeds the new remote from SQLite (full re-push + checkpoint reset) instead of letting pull-reconciliation interpret the empty remote as mass deletion and wipe the local store
- `create-indexes` script auto-creates the `notes` collection if it doesn't exist

### Frontend
- Tailwind v4: CSS-first config via `@import "tailwindcss"` in globals.css, uses `@tailwindcss/vite` plugin (no tailwind.config.js or postcss.config.js)
- **Theming**: Light/dark via CSS custom properties (`--ink-*`) registered as Tailwind colors (`ink-*`) in `@theme`. Theme persists to `localStorage("inkleaf-theme")`, defaults to dark. Toggle via header button or `Cmd+Shift+T`. Anti-FOUC script in `index.html` applies `.dark` class before React loads.
- Color tokens: `ink-bg-*`, `ink-text-*`, `ink-accent-*`, `ink-border-*` — defined in `:root` (light) and `.dark` (dark) blocks in globals.css
- Tauri v2 CSP must include `connect-src http://localhost:3001` for backend API access
- `useSearch` hook: all returned functions must be wrapped in `useCallback` to prevent infinite re-render loops in consumers

### Tauri
- `beforeDevCommand` in tauri.conf.json must use `pnpm dev` (not `npm run dev`)
- `app.title` is not a valid field in Tauri v2 config — title only goes on individual windows
- Icon files required at build time in `src-tauri/icons/`
- The native menu (Rust, `src-tauri/src/lib.rs`) emits events the webview listens for (`@tauri-apps/api/event`): `show-keyboard-shortcuts`, `menu-import`, `menu-export`. Add a new menu item by building it, adding it to a `SubmenuBuilder`, and emitting an event in `on_menu_event`

### Import / Export
- Markdown file import/export is **frontend-side** — no backend endpoints. Import parses the file and calls `api.notes.create()`, reusing the normal sync/embedding path; export serializes the active note in the webview.
- `lib/markdownFile.ts` handles YAML frontmatter (`js-yaml`): import title resolution is frontmatter `title` → first H1 → file name (sans extension); export writes `title`/`tags`/`createdAt`/`updatedAt` frontmatter. `createdAt`/`updatedAt` are informational — an imported note is always new.
- `lib/fileIO.ts` is platform-aware: Tauri dialog + fs plugins in the desktop app, hidden `<input type=file>` / Blob download in the browser (`pnpm dev`). Browser blob-download is unreliable in WKWebView, which is why the desktop path uses the fs plugin. Triggered from Header buttons (both contexts) and the native File menu (desktop only).
- fs plugin access is scoped to `$HOME/**` in `capabilities/default.json`; importing/exporting outside the home dir will be denied.

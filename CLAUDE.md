# Inkleaf

A Tauri v2 desktop app: personal Markdown knowledge base demonstrating MongoDB Atlas Search, Atlas Vector Search, and hybrid search via `$rankFusion`.

## Architecture

- **Two processes, not one**: the backend is a standalone Express server on `localhost:3001`, separate from the Tauri v2 webview on `localhost:5173`. They are launched together via `concurrently` from the root scripts.
- **Search is one thing**: `GET /api/search` is the only query surface. `search.service.ts` picks a strategy and degrades: hybrid `$rankFusion` (online + embedding provider configured) → text-only `$search` (no embedding available) → SQLite FTS5 (offline). All three return the same `SearchResult` shape, so the frontend never branches on which engine answered. There is no semantic-only search mode; `/api/semantic` keeps only `related/:noteId` (note-to-note similarity, not query-driven).
- **Offline-first**: notes CRUD is served from a local SQLite store (`backend/data/inkleaf.db`, via built-in `node:sqlite`); a background sync engine (`services/sync.service.ts`) pushes dirty rows to Atlas and pulls remote changes (last-write-wins by `updatedAt`, ID reconciliation handles remote *permanent* deletes + reseeds). Search falls back to SQLite FTS5 when Atlas is unreachable (keyword only, no vector half); related-notes is online-only (503 `{code:"OFFLINE"}`). `GET/POST /api/sync[/now]` exposes status; frontend polls it (`useSyncStatus`) into the Zustand store and shows a header indicator.
- **Soft delete (recoverable)**: deleting a note trashes it — it's hidden from reads but kept. In SQLite `deleted=1` + `deleted_at` mark the tombstone; in Atlas the doc is kept with a `deletedAt` field (never removed). Restore clears both; **permanent** delete (`purge_pending=1`) is the only op that actually removes the Atlas doc + local row. Endpoints: `GET /api/notes/trash`, `POST /api/notes/:id/restore`, `DELETE /api/notes/:id/permanent` (plain `DELETE /api/notes/:id` = soft). Search must exclude trashed docs: Atlas full-text/vector pipelines add `$match: { deletedAt: null }` (including inside every `$rankFusion` sub-pipeline), local FTS filters `deleted=0`. Frontend surfaces an undo toast (`components/Toast.tsx`) after delete and a Trash view in the sidebar (`sidebarView` in the store).

## Scripts

Standard invocations are in the root `package.json` (pnpm workspaces: `frontend/`, `backend/`). The non-obvious ones:

```bash
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

## Reference

Environment variables (`.env`) and keyboard shortcuts live in the **`inkleaf-reference` skill** (`.claude/skills/inkleaf-reference/SKILL.md`) — invoke it when configuring `.env` or touching shortcuts.

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
- **Hybrid search** (`services/hybrid-search.service.ts`) needs **MongoDB 8.0+** for `$rankFusion`. Two constraints shape the implementation, and both have bitten already:
  - Sub-pipelines may only contain `$search`, `$vectorSearch`, `$match`, `$sort`, `$geoNear` — **no `$project`** — and `$meta: "searchHighlights"` is unavailable after the fusion stage. So highlights are harvested by running the text retriever a **second time** as a standalone `$search` (with `highlight`) in parallel, then joined onto the fused ranking by `_id`. Don't "simplify" that second aggregation away; it's the only way to keep highlights.
  - Vector-only hits have no keyword to highlight, so `services/snippet.ts` synthesizes an Atlas-shaped highlight from the note body (term match → `buildHighlight`, else plain excerpt → `buildExcerpt`). Its regex escapes user input; keep that if touching it.
  - Fused scores come from `$meta: "score"` (not `searchScore`/`vectorSearchScore`), and are small (~0.01–0.03) since RRF sums `weight / (rank + 60)`. `rankConstant` is fixed at 60. `$rankFusion` does **not** support pagination (`$skip`), so the 20-result limit is load-bearing.
  - `scoreDetails: true` surfaces per-pipeline ranks, mapped to `matchedBy: ["text"|"vector"]` for the UI badges. A pipeline that didn't return the doc reports no positive rank.
  - Sub-pipeline candidate limits (`CANDIDATES = 40`) are deliberately wider than the final 20 — with no overlap between the two result sets, RRF degenerates into two interleaved lists.
  - A missing/bad vector index does **not** throw; Atlas returns the text half only (verified). The `try/catch` in `search.service.ts` covers the pre-8.0 and embedding-provider-failure cases.
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

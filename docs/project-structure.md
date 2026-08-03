# Project Structure

A quick tour of how the repo is laid out and which piece does what. It's a pnpm
workspace with two packages, `backend/` and `frontend/`, plus a Tauri shell
nested inside the frontend.

## Backend (`backend/`)

A Node.js and Express 5 API on `localhost:3001`, written in TypeScript. It binds
to `127.0.0.1` only, since it has no authentication and is meant purely for the
local app to talk to.

The thing to know before reading any of it: **SQLite is the source of truth, not
Atlas.** Every read and write hits a local SQLite database
(`backend/data/inkleaf.db`, using the built-in `node:sqlite` module), and a
background sync engine moves changes to and from MongoDB Atlas. That's what
makes the app work on a plane.

Route groups:

- `/api/notes`: notes CRUD, served from SQLite. Also the trash endpoints, since
  delete is a soft delete: `GET /trash`, `POST /:id/restore`,
  `DELETE /:id/permanent` (plain `DELETE /:id` just moves a note to the trash).
- `/api/search`: the one search endpoint, plus autocomplete. Hybrid by default:
  `$rankFusion` merges an Atlas Search `$search` over title, markdown, and tags
  with a `$vectorSearch` over embeddings. It degrades a rung at a time, to
  text-only `$search` when no embedding is available and to SQLite FTS5 when
  Atlas is unreachable, so search keeps working offline. Embeddings come from
  Voyage AI `voyage-4-lite` (1024 dimensions, the default) or OpenAI
  `text-embedding-3-small` (1536).
- `/api/semantic`: just the "related notes" lookup now, note-to-note similarity
  with `$vectorSearch`. Online only, because it needs Atlas and an embedding
  provider.
- `/api/sync`: reports sync status, and `POST /api/sync/now` forces a sync tick.
- `/api/health`: a liveness check the frontend uses to tell online from offline.

Inside `src/`:

| Path | What lives there |
| --- | --- |
| `db/sqlite.ts` | Local store, schema, and additive migrations |
| `db/connection.ts` | Atlas client, with a fast-fail 5s server selection timeout |
| `db/search-indexes.ts` | Shared Atlas Search and Vector Search index definitions |
| `services/sync.service.ts` | The background push/pull engine and conflict resolution |
| `services/notes.service.ts` | Notes CRUD against SQLite |
| `services/local-search.service.ts` | Offline SQLite FTS5 search |
| `services/search.service.ts` | The strategy ladder: hybrid, then text-only, then local |
| `services/hybrid-search.service.ts` | `$rankFusion` over `$search` + `$vectorSearch`, and highlight harvesting |
| `services/snippet.ts` | Synthesized highlights for vector-only hits |
| `services/semantic.service.ts` | `$vectorSearch` pipeline for related notes |
| `services/embeddings.ts` | Pluggable embedding provider (Voyage or OpenAI) |

`backend/scripts/` holds the three CLI utilities: `seed.ts` (sample notes),
`create-indexes.ts` (Atlas Search and Vector Search indexes), and `reembed.ts`
(re-embed everything after switching providers).

## Frontend (`frontend/`)

A React 19, Vite 7, and Tailwind CSS 4 app. This is the whole UI, and it runs
identically in a browser tab or inside the Tauri window.

- **Three-column layout**: the sidebar (tag tree and note list), the main pane,
  and a related notes panel on the right. The main pane holds *either* the
  CodeMirror editor or the rendered Markdown preview, which swap via `viewMode`
  (`Cmd+E` and `Cmd+Shift+E`), rather than sitting side by side.
- **Command palette** (cmdk) for search (`Cmd+K`). One mode: the backend fuses
  keyword and semantic results, and each result badges which retriever found
  it.
- **Zustand** for state (`stores/appStore.ts`), a typed fetch client
  (`api/client.ts`) for every backend call, and hooks for the rest: `useNotes`,
  `useSearch`, `useSyncStatus` (polls sync state for the header indicator), and
  `useImportExport`.
- **Light and dark themes** through CSS custom properties, toggled with
  `Cmd+Shift+T` and persisted to `localStorage`.
- `lib/markdownFile.ts` and `lib/fileIO.ts` handle Markdown import and export,
  including YAML frontmatter. Import and export are entirely frontend-side, with
  no backend endpoints involved.

Running `pnpm dev` serves this at `localhost:5173` in your browser.

## Tauri desktop shell (`frontend/src-tauri/`)

A Tauri v2 project nested inside the frontend workspace, which wraps the React
app into a native desktop application instead of a browser tab.

The Rust side is small but not empty. `lib.rs` builds the **native menu** and
emits events the webview listens for (`show-keyboard-shortcuts`, `menu-import`,
`menu-export`), registers the `dialog` and `fs` plugins that make desktop file
import and export work, and exposes one command, `open_external`. Tauri itself
handles:

- **Window management**: a 1400x900 window (minimum 900x600) loading the React
  app from the Vite dev server on `localhost:5173`, or from the production build
  in `../dist`.
- **Security**: a Content Security Policy that keeps network access to
  `localhost:3001` and the Tauri IPC channel. Filesystem access is scoped to
  `$HOME/**` in `capabilities/default.json`.
- **Bundling**: packaging the app with platform icons for distribution.
- **Dev orchestration**: `beforeDevCommand` runs `pnpm dev`, so a single
  `pnpm dev:tauri` starts the backend, Vite, and the native window together.

The `target/` directory inside `src-tauri` is just the Cargo build cache. It's
gitignored, and `pnpm clean` deletes it when it gets large.

## How it all connects

```text
pnpm dev:tauri
│
├── Express backend (127.0.0.1:3001)
│     ├── SQLite (source of truth, FTS5 offline search)
│     └── background sync ──► MongoDB Atlas ($search, $vectorSearch)
│
└── Tauri native window
      └── loads the React app (localhost:5173)
            └── fetches from the backend over HTTP
```

The backend and frontend are independent processes started together by
`concurrently`. Tauri is only the desktop container, so all the application
logic lives in React and Express.

Want more depth? [save-note.md](save-note.md) and
[hybrid-search.md](hybrid-search.md) trace a single user action all the way
through this stack.

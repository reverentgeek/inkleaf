<p align="center">
  <img src="docs/inkleaf-logo.svg" width="120" alt="Inkleaf logo" />
</p>

# Inkleaf

A desktop Markdown knowledge base built with **Tauri v2**, **React**, and **MongoDB Atlas** — showcasing Atlas Search and Atlas Vector Search.

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

- **Markdown Editor** — CodeMirror-powered editor with live preview, syntax highlighting, and auto-save
- **Atlas Search** — Full-text search with fuzzy matching, autocomplete, and highlighted results via `$search` aggregation
- **Vector Search** — Semantic search powered by embeddings and `$vectorSearch`, plus a related notes panel. Choose your embedding provider: MongoDB's **Voyage AI** `voyage-4-lite` (default) or OpenAI `text-embedding-3-small`
- **Offline-First** — All notes live in a local SQLite store, so you can view and edit offline; changes sync to Atlas automatically when connected (last-write-wins), with SQLite FTS5 full-text search as the offline fallback
- **Search Palette** — `Cmd+K` for text search, `Cmd+Shift+K` for semantic search
- **Desktop App** — Native window via Tauri v2, with a dark theme and keyboard-driven workflow

## Architecture

```text
┌─────────────────────────────────┐
│  Tauri v2 Desktop Window        │
│  React + Vite (localhost:5173)  │
│  - Markdown editor (CodeMirror) │
│  - Cmd+K search palette (cmdk)  │
│  - Related notes sidebar        │
└──────────────┬──────────────────┘
               │ fetch (HTTP)
               ▼
┌─────────────────────────────────┐
│  Node.js / Express (port 3001)  │
│  - Notes CRUD (SQLite-backed)   │
│  - Atlas Search pipelines       │
│  - Vector Search pipelines      │
│  - Embeddings (OpenAI / Voyage) │
│  ┌───────────────────────────┐  │
│  │  SQLite (node:sqlite)     │  │
│  │  - offline source of truth│  │
│  │  - FTS5 offline search    │  │
│  └─────────────┬─────────────┘  │
│                │ background sync│
└────────────────┼────────────────┘
                 │ MongoDB Driver
                 ▼
┌─────────────────────────────────┐
│  MongoDB Atlas                  │
│  - notes collection             │
│  - Atlas Search index           │
│  - Vector Search index          │
└─────────────────────────────────┘
```

## Prerequisites

- [Node.js](https://nodejs.org/) v22.5+ (the offline store uses the built-in `node:sqlite` module)
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install) (for Tauri desktop builds — see below)
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- (Optional) An embedding provider API key for vector search — a MongoDB [Voyage AI](https://www.mongodb.com/products/platform/voyage-ai) key (default) or an [OpenAI API key](https://platform.openai.com/)

### Installing Rust

Rust is only needed for the desktop window (`pnpm dev:tauri`) — browser mode (`pnpm dev`) runs without it.

```bash
# Official installer (rustup)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Or with Homebrew on macOS
brew install rust
```

> **Note:** `brew install rustup` also exists, but it's keg-only — its binaries aren't added to your PATH, so `rustup-init` won't be found without extra setup. `brew install rust` is the simpler choice. On macOS you'll also need the Xcode Command Line Tools (`xcode-select --install`).

The first `pnpm dev:tauri` run compiles all Tauri crates and takes a few minutes; subsequent builds take seconds.

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/reverentgeek/inkleaf.git
cd inkleaf
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your MongoDB Atlas connection string and (optionally) an embedding provider key:

```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/inkleaf?retryWrites=true&w=majority

# Embeddings — pick a provider (default is voyage). Only the matching key is needed.
EMBEDDING_PROVIDER=voyage
VOYAGE_API_KEY=...

# ...or use OpenAI instead:
# EMBEDDING_PROVIDER=openai
# OPENAI_API_KEY=sk-...
```

Make sure your current IP address is in the Atlas **Network Access** IP Access List.

#### Configuration options

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | Atlas connection string |
| `EMBEDDING_PROVIDER` | No (default `voyage`) | Embedding backend: `voyage` (MongoDB Voyage AI) or `openai` |
| `VOYAGE_API_KEY` | For Vector Search (voyage) | Voyage AI key (used against `https://ai.mongodb.com/v1/embeddings`) |
| `OPENAI_API_KEY` | For Vector Search (openai) | OpenAI API key with `text-embedding-3-small` access |
| `EMBEDDING_MODEL` | No | Override the model. Defaults: `voyage-4-lite` (voyage), `text-embedding-3-small` (openai) |
| `EMBEDDING_DIMENSIONS` | No | Override vector dimensions. Defaults: `1024` (voyage), `1536` (openai). Must match the model and the Atlas vector index |
| `MONGODB_DB` | No (default `inkleaf`) | Database name |
| `PORT` | No (default `3001`) | Backend port |
| `SQLITE_PATH` | No (default `backend/data/inkleaf.db`) | Local offline store location |
| `SYNC_INTERVAL_MS` | No (default `15000`) | Background sync tick interval |

> **Switching embedding providers:** OpenAI (1536-dim) and Voyage (1024-dim) vectors aren't compatible. After changing `EMBEDDING_PROVIDER`, stop the app and run `pnpm reembed` — it rebuilds the vector index when the dimensions change, re-embeds every note with the new provider, and ensures the full-text search index is intact.

### 3. Create indexes

```bash
pnpm create-indexes
```

This creates the Atlas Search and Vector Search indexes. They take 1-5 minutes to build — check the Atlas UI to verify status.

### 4. Seed sample data

```bash
pnpm seed
```

Inserts 17 sample notes covering MongoDB, React, TypeScript, and more. If your embedding provider's API key is set, it also generates vector embeddings for each note.

> **Heads up:** seeding into an empty database just works. Re-seeding, though, deletes every existing note first — so if the `notes` collection already has data, the script refuses unless you pass `--force` (`pnpm seed --force`), guarding against accidentally clobbering real data.

### 5. Run the app

**Desktop (Tauri):**

```bash
pnpm dev:tauri
```

**Browser only:**

```bash
pnpm dev
```

Then open [http://localhost:5173](http://localhost:5173).

## Offline & Sync

Notes are stored in a local SQLite database (`backend/data/inkleaf.db`) and served from there — Atlas is synced in the background:

- **Edit anywhere, sync later** — create, edit, and delete notes offline; a background engine pushes changes to Atlas when a connection returns (and pulls remote changes down, so multiple machines pointed at the same cluster stay in sync)
- **Conflicts** — resolved per note, newest `updatedAt` wins
- **Offline search** — text search transparently falls back to SQLite FTS5 with highlighted results; semantic search requires a connection
- **Status indicator** — the cloud icon in the header shows sync state and pending changes; click it to force a sync (`POST /api/sync/now`)
- **Switching clusters** — if you point `MONGODB_URI` at a different cluster, the app re-seeds it from the local store rather than treating the empty remote as deletions

## Keyboard Shortcuts

| Shortcut | Action |
| ---------- | -------- |
| `Cmd+N` | New note |
| `Cmd+K` | Open command palette (text search) |
| `Cmd+Shift+K` | Open command palette (semantic search) |
| `Cmd+E` | Switch to edit mode |
| `Cmd+Shift+E` | Switch to preview mode |
| `Cmd+Shift+T` | Toggle light/dark theme |
| `Cmd+\` | Toggle sidebar |
| `↑` / `↓` | Previous / next note in list |
| `Cmd+Shift+F` | Format markdown |
| `Cmd+O` | Import Markdown file |
| `Cmd+S` | Export note as Markdown |
| `Cmd+/` | Show keyboard shortcuts |
| `Escape` | Close dialog / command palette |

## Tech Stack

| Layer | Technology |
| ------- | ------------ |
| Desktop | Tauri v2 |
| Frontend | React 19, Vite 7, Tailwind CSS 4 |
| Editor | CodeMirror (`@uiw/react-codemirror`) |
| Preview | react-markdown, remark-gfm, rehype-highlight |
| Command Palette | cmdk |
| State | Zustand |
| Icons | Lucide React |
| Backend | Express 5, TypeScript |
| Database | MongoDB Atlas (driver v7) |
| Local store | SQLite via built-in `node:sqlite` (FTS5) |
| Embeddings | Voyage AI `voyage-4-lite` or OpenAI `text-embedding-3-small` |

## License

[MIT](LICENSE)

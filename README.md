<p align="center">
  <img src="docs/inkleaf-logo.svg" width="120" alt="Inkleaf logo" />
</p>

# Inkleaf

A desktop Markdown knowledge base built with **Tauri v2**, **React**, and **MongoDB Atlas** — showcasing Atlas Search and Atlas Vector Search.

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

- **Markdown Editor** — CodeMirror-powered editor with live preview, syntax highlighting, and auto-save
- **Atlas Search** — Full-text search with fuzzy matching, autocomplete, and highlighted results via `$search` aggregation
- **Vector Search** — Semantic search powered by OpenAI `text-embedding-3-small` embeddings and `$vectorSearch`, plus a related notes panel
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
│  - OpenAI embedding generation  │
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
- (Optional) An [OpenAI API key](https://platform.openai.com/) for vector search / embeddings

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

Edit `.env` with your MongoDB Atlas connection string and (optionally) your OpenAI API key:

```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/inkleaf?retryWrites=true&w=majority
OPENAI_API_KEY=sk-...
```

Make sure your current IP address is in the Atlas **Network Access** IP Access List.

### 3. Create indexes

```bash
pnpm create-indexes
```

This creates the Atlas Search and Vector Search indexes. They take 1-5 minutes to build — check the Atlas UI to verify status.

### 4. Seed sample data

```bash
pnpm seed
```

Inserts 17 sample notes covering MongoDB, React, TypeScript, and more. If `OPENAI_API_KEY` is set, it also generates vector embeddings for each note.

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
| `Cmd+K` | Open command palette (text search) |
| `Cmd+Shift+K` | Open command palette (semantic search) |
| `Cmd+E` | Switch to edit mode |
| `Cmd+Shift+E` | Switch to preview mode |
| `Cmd+Shift+F` | Format markdown |
| `Escape` | Close command palette |

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
| Embeddings | OpenAI `text-embedding-3-small` |

## License

[MIT](LICENSE)

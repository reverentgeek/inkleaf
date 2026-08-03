<p align="center">
  <img src="docs/inkleaf-logo.svg" width="120" alt="Inkleaf logo" />
</p>

# Inkleaf

A desktop Markdown knowledge base built with **Tauri v2**, **React**, and **MongoDB Atlas**, showing off Atlas Search and Atlas Vector Search.

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)

## Why another notes app?

We've all got a graveyard of half-abandoned note apps. Mine died the same way every time: I'd write something genuinely useful, then six months later I couldn't find it again. I knew I'd written *something* about aggregation pipelines. Was it filed under "mongodb"? "aggregation"? "that thing I figured out on a Tuesday"? Who knows. The note existed. Finding it was the problem.

Keyword search only helps when you remember the keyword.

Inkleaf is my excuse to fix that with the tools I'd reach for at work anyway: Atlas Search for real full-text search (fuzzy matching, autocomplete, highlighted results) and Atlas Vector Search for the "I don't remember the words, but it was about *this*" case. Search for "how do I make queries faster" and you'll get your note on indexes, even though it never uses the word "faster."

It's also a local-first desktop app, because a notes app that stops working on an airplane isn't a notes app.

> **Note:** Inkleaf is a personal project and a demo, not a product. It's a single-user desktop app built in spare time, and it's developed on macOS, so Windows and Linux are under-tested. Poke around, steal the patterns, but maybe don't move your life's work into it just yet.

## What it looks like

Here's the editor, the tag sidebar, and the semantic "Related Notes" panel, in both themes (`Cmd+Shift+T` toggles):

![Inkleaf in dark theme](docs/screenshot-dark.png)

![Inkleaf in light theme](docs/screenshot-light.png)

## Features

- **Markdown Editor**: CodeMirror-powered editor with live preview, syntax highlighting, and auto-save
- **Atlas Search**: full-text search with fuzzy matching, autocomplete, and highlighted results via the `$search` aggregation stage
- **Atlas Vector Search**: semantic search powered by embeddings and `$vectorSearch`, plus a related notes panel. Pick your embedding provider: MongoDB's **Voyage AI** `voyage-4-lite` (the default) or OpenAI `text-embedding-3-small`
- **Offline-first**: every note lives in a local SQLite store, so you can read and write with no connection. Changes sync to Atlas on their own once you're back (last write wins), and text search falls back to SQLite FTS5 while you're offline
- **Search palette**: `Cmd+K` for text search, `Cmd+Shift+K` for semantic search
- **Desktop app**: a native window via Tauri v2, light and dark themes, and a keyboard-driven workflow

## How the pieces fit together

Three moving parts: a webview, a local Node process, and MongoDB Atlas. The interesting bit is that SQLite (not Atlas) is what the UI reads from, which is what makes the offline story work.

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

Want the full story? [Saving a note](docs/save-note.md) and [semantic search](docs/semantic-search.md) trace a single action all the way through the stack.

## What you'll need

- [Node.js](https://nodejs.org/) v22.5 or newer, since the offline store uses the built-in `node:sqlite` module. This is enforced through `engines`, so `pnpm install` will stop you early on an older version. Node 24+ is the happy path, because before that `node:sqlite` was experimental and grumbles a warning on every startup.
- [pnpm](https://pnpm.io/)
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster. The free M0 tier is plenty for following along.
- [Rust](https://www.rust-lang.org/tools/install), but only for the desktop window. See below.
- Optional: an embedding provider API key if you want vector search, either a MongoDB [Voyage AI](https://www.mongodb.com/products/platform/voyage-ai) key (the default) or an [OpenAI API key](https://platform.openai.com/). Editing, syncing, and text search all work fine without one.

### Do I need Rust?

Only for the desktop window (`pnpm dev:tauri`). Browser mode (`pnpm dev`) runs the exact same app in a tab with no Rust in sight, which is the faster way to kick the tires.

```bash
# Official installer (rustup)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Or with Homebrew on macOS
brew install rust
```

> **Pro tip:** `brew install rustup` also exists, and it will waste ten minutes of your life. It's keg-only, so its binaries never land on your PATH and `rustup-init` isn't found. Use `brew install rust` instead. On macOS you'll also want the Xcode Command Line Tools (`xcode-select --install`).

The first `pnpm dev:tauri` compiles every Tauri crate and takes a few minutes. Go get coffee. Later builds take seconds.

## Getting started

Five steps: clone, configure, index, seed, run.

### Step 1: Clone and install

```bash
git clone https://github.com/reverentgeek/inkleaf.git
cd inkleaf
pnpm install
```

### Step 2: Configure the environment

```bash
cp .env.example .env
```

Open `.env` and add your Atlas connection string, plus an embedding key if you want semantic search:

```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/inkleaf?retryWrites=true&w=majority

# Embeddings. Pick a provider (voyage is the default). Only the matching key is needed.
EMBEDDING_PROVIDER=voyage
VOYAGE_API_KEY=...

# ...or use OpenAI instead:
# EMBEDDING_PROVIDER=openai
# OPENAI_API_KEY=sk-...
```

One thing that trips up everybody, me included: make sure your current IP address is in the Atlas **Network Access** IP Access List. Otherwise you'll get a connection timeout that looks like a bug in the app.

#### All the configuration options

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | Atlas connection string |
| `EMBEDDING_PROVIDER` | No (default `voyage`) | Embedding backend: `voyage` (MongoDB Voyage AI) or `openai` |
| `VOYAGE_API_KEY` | For Vector Search (voyage) | Voyage AI key, used against `https://ai.mongodb.com/v1/embeddings` |
| `OPENAI_API_KEY` | For Vector Search (openai) | OpenAI API key with `text-embedding-3-small` access |
| `EMBEDDING_MODEL` | No | Override the model. Defaults: `voyage-4-lite` (voyage), `text-embedding-3-small` (openai) |
| `EMBEDDING_DIMENSIONS` | No | Override vector dimensions. Defaults: `1024` (voyage), `1536` (openai). Must match both the model and the Atlas vector index |
| `MONGODB_DB` | No (default `inkleaf`) | Database name |
| `PORT` | No (default `3001`) | Backend port |
| `SQLITE_PATH` | No (default `backend/data/inkleaf.db`) | Where the local offline store lives |
| `SYNC_INTERVAL_MS` | No (default `15000`) | How often the background sync ticks |

> **Note:** thinking of switching embedding providers later? OpenAI (1536 dimensions) and Voyage (1024) vectors aren't interchangeable. They're different sizes living in different vector spaces, so mixing them gives you errors or nonsense results. After changing `EMBEDDING_PROVIDER`, stop the app and run `pnpm reembed`, which rebuilds the vector index when the dimensions change, re-embeds every note with the new provider, and makes sure the full-text index survived the process.

### Step 3: Create the indexes

```bash
pnpm create-indexes
```

This creates both the Atlas Search index and the Vector Search index. They take one to five minutes to build, so check the Atlas UI if search comes back suspiciously empty at first.

### Step 4: Seed some sample data

```bash
pnpm seed
```

That drops in 17 sample notes about MongoDB, React, TypeScript, and friends. If your embedding provider key is set, it generates vector embeddings for each one too, which is what makes semantic search interesting on a fresh install.

> **Heads up:** seeding an empty database is uneventful. Re-seeding deletes every existing note first, so if the `notes` collection already has data, the script refuses and makes you type `pnpm seed --force`. That guard exists because I once clobbered my own notes. You're welcome.

### Step 5: Run it

Desktop window:

```bash
pnpm dev:tauri
```

Browser only:

```bash
pnpm dev
```

Then open [http://localhost:5173](http://localhost:5173) and start typing. `Cmd+N` makes a new note.

## How offline mode works

Your notes live in a local SQLite database (`backend/data/inkleaf.db`) and the app always reads from there. Atlas gets updated in the background, which means the UI never waits on the network:

- **Edit anywhere, sync later**: create, edit, and delete offline. A background engine pushes to Atlas when a connection comes back, and pulls remote changes down, so two machines pointed at the same cluster stay in step.
- **Conflicts**: settled per note, newest `updatedAt` wins. Simple, predictable, occasionally ruthless.
- **Offline search**: text search quietly falls back to SQLite FTS5, highlights included. Semantic search needs a connection, since generating a query embedding means calling an API.
- **Status indicator**: the cloud icon in the header shows sync state and how many changes are pending. Click it to force a sync (`POST /api/sync/now`).
- **Switching clusters**: point `MONGODB_URI` somewhere new and the app re-seeds that cluster from your local store, rather than reading an empty remote as "the user deleted everything."

## Keyboard shortcuts

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

## Tech stack

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
| Database | MongoDB Atlas (Node.js driver v7) |
| Local store | SQLite via the built-in `node:sqlite` module (FTS5) |
| Embeddings | Voyage AI `voyage-4-lite` or OpenAI `text-embedding-3-small` |

## Docs

The [`docs/`](docs/) folder has walkthroughs of how the app actually works today ([saving a note](docs/save-note.md), [semantic search](docs/semantic-search.md)), plus a few exploratory sketches of directions Inkleaf *could* go. Those sketches are labeled **possible future ideas**, and that label is doing real work: none of it is planned, scheduled, or built.

## Contributing

Bug reports and fixes are very welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers setup, scope, and what to check before opening a pull request. Please open an issue before starting anything large, so neither of us wastes an afternoon. Found a security problem? Please [report it privately](SECURITY.md) instead of filing a public issue. Everyone here follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Now go find that note

Every notes app is a bet that you'll want this thing again someday. The trick isn't storing it, it's finding it six months later when you've forgotten which words you used. That's the whole reason Atlas Search and Atlas Vector Search are in here.

Clone it, seed it, and try searching for something using entirely the wrong words. When it finds the right note anyway, that's `$vectorSearch` earning its keep.

- [MongoDB Atlas Search docs](https://www.mongodb.com/docs/atlas/atlas-search/)
- [MongoDB Atlas Vector Search docs](https://www.mongodb.com/docs/atlas/atlas-vector-search/)
- [Tauri v2 docs](https://v2.tauri.app/)

Now go forth and build something cool. If you do something interesting with it, I'd genuinely like to hear about it.

## License

[MIT](LICENSE)

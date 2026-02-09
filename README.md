<p align="center">
  <img src="docs/inkleaf-logo.svg" width="120" alt="Inkleaf logo" />
</p>

# Inkleaf

A desktop Markdown knowledge base built with **Tauri v2**, **React**, and **MongoDB Atlas** — showcasing Atlas Search, Atlas Vector Search, and Client-Side Field Level Encryption (CSFLE).

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

- **Markdown Editor** — CodeMirror-powered editor with live preview, syntax highlighting, and auto-save
- **Atlas Search** — Full-text search with fuzzy matching, autocomplete, and highlighted results via `$search` aggregation
- **Vector Search** — Semantic search powered by OpenAI `text-embedding-3-small` embeddings and `$vectorSearch`, plus a related notes panel
- **CSFLE Vault** — Encrypted notes using Client-Side Field Level Encryption — the server never sees plaintext, with a raw endpoint to prove it
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
│  - Vault mode toggle            │
└──────────────┬──────────────────┘
               │ fetch (HTTP)
               ▼
┌─────────────────────────────────┐
│  Node.js / Express (port 3001)  │
│  - Notes CRUD                   │
│  - Atlas Search pipelines       │
│  - Vector Search pipelines      │
│  - CSFLE encrypted vault CRUD   │
│  - OpenAI embedding generation  │
└──────────────┬──────────────────┘
               │ MongoDB Driver
               ▼
┌─────────────────────────────────┐
│  MongoDB Atlas                  │
│  - notes collection             │
│  - vault_notes collection       │
│  - encryption_keyVault          │
│  - Atlas Search index           │
│  - Vector Search index          │
└─────────────────────────────────┘
```

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install) (for Tauri desktop builds)
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- (Optional) An [OpenAI API key](https://platform.openai.com/) for vector search / embeddings
- (Optional) The `mongo_crypt_v1` shared library for CSFLE

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

Inserts 18 sample notes covering MongoDB, React, TypeScript, and more. If `OPENAI_API_KEY` is set, it also generates vector embeddings for each note.

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

## CSFLE Vault Setup (Optional)

To enable the encrypted vault:

```bash
# Generate a 96-byte local master key
pnpm generate-master-key

# Create a data encryption key in Atlas
pnpm create-data-key
```

The `create-data-key` script outputs a base64 key ID. Add it to `.env`:

```bash
ENCRYPTION_KEY_PATH=./master-key.bin
CSFLE_DATA_KEY_ID=<base64 key from above>
CRYPT_SHARED_LIB_PATH=/path/to/mongo_crypt_v1.dylib
```

Restart the backend, then toggle vault mode with the lock icon or `Cmd+Shift+V`.

**Demo tip:** Use the `GET /api/vault/:id/raw` endpoint to show that the `markdown` field is stored as binary ciphertext — it decrypts transparently through the normal vault endpoint.

## Keyboard Shortcuts

| Shortcut | Action |
| ---------- | -------- |
| `Cmd+K` | Open command palette (text search) |
| `Cmd+Shift+K` | Open command palette (semantic search) |
| `Cmd+E` | Switch to edit mode |
| `Cmd+Shift+E` | Switch to preview mode |
| `Cmd+Shift+F` | Format markdown |
| `Cmd+Shift+V` | Toggle vault mode |
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
| Encryption | mongodb-client-encryption v7 |
| Embeddings | OpenAI `text-embedding-3-small` |

## License

[MIT](LICENSE)

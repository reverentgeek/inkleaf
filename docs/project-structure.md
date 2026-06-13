# Tauri Demo Notes

1. Backend (`/backend`)

A Node.js/Express 5 REST API server running on localhost:3001. It provides these route groups:

- `/notes` — CRUD for regular notes stored in MongoDB
- `/search` — Full-text search powered by MongoDB Atlas Search indexes on title, markdown, and tags
- `/semantic` — Vector similarity search using OpenAI embeddings (1536-dim) and Atlas Vector Search, plus "related notes" lookups

It also includes utility scripts for seeding data and creating Atlas indexes.

1. Frontend (`/frontend`)

A React 19 + Vite 7 + Tailwind CSS 4 web app. This is the UI layer with:

- A 3-column layout: sidebar (note list), CodeMirror markdown editor, and a rendered markdown preview
- A command palette (cmdk) for text search (Cmd+K) and semantic search (Cmd+Shift+K)
- Zustand for state management, a typed fetch client (`api/client.ts`) for all backend calls, and custom hooks (useNotes, useSearch)

When you run `pnpm dev`, this is served by Vite at localhost:5173 and opens in a browser.

1. Tauri Desktop Shell (`/frontend/src-tauri`)

This is a Tauri project nested inside the frontend workspace. Its purpose is to wrap the React frontend into a native desktop application (macOS, Windows, Linux) instead of running it in a browser.

The Rust code is minimal — lib.rs just calls tauri::Builder::default().run() and main.rs calls that. There's no custom Rust logic; Tauri handles:

- Native window management — creates a 1400x900 window with the React app loaded from the Vite dev server (localhost:5173) or the production build (../dist)
- Security — enforces a Content Security Policy that restricts network access to localhost:3001 (the backend)
- App bundling — packages the app with icons for distribution on each platform
- Dev orchestration — its beforeDevCommand runs pnpm dev (backend + Vite), so `pnpm dev:tauri` launches everything together with the app in a native window instead of a browser tab

The target/ directory inside src-tauri is the Rust/Cargo build cache (the one we just cleaned).

## How they connect

```text
pnpm dev:tauri
│
├── Express backend (localhost:3001) ──► MongoDB Atlas
│
└── Tauri native window
└── loads React app (localhost:5173)
└── fetches from backend via HTTP
```

The backend and frontend are independent processes launched together with `concurrently`. Tauri is just the desktop container — all app logic lives in React and Express.

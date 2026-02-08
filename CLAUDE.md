# Inkleaf

A Tauri v2 desktop app: personal Markdown knowledge base demonstrating MongoDB Atlas Search, Atlas Vector Search, and Client-Side Field Level Encryption (CSFLE).

## Architecture

- **Frontend**: React 19 + Vite 7 + Tailwind CSS 4, runs in Tauri v2 webview (localhost:5173)
- **Backend**: Express 5 + TypeScript on Node.js, standalone process (localhost:3001)
- **Database**: MongoDB Atlas — `notes` collection (searchable), `vault_notes` (CSFLE encrypted), `encryption_keyVault`
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
│   │   │   ├── connection.ts # Standard MongoClient singleton
│   │   │   └── encryption.ts # CSFLE-enabled MongoClient + schema map
│   │   ├── routes/           # notes, search, semantic, vault
│   │   ├── services/         # Business logic for each route
│   │   ├── middleware/       # errorHandler
│   │   └── types/            # Note, VaultNote, SearchResult interfaces
│   └── scripts/              # seed, create-indexes, generate-master-key, create-data-key
└── frontend/
    ├── src/
    │   ├── App.tsx           # Root + keyboard shortcuts
    │   ├── api/client.ts     # Typed fetch wrapper for all API endpoints
    │   ├── stores/appStore.ts # Zustand global state
    │   ├── hooks/            # useNotes, useSearch, useVault
    │   ├── components/
    │   │   ├── layout/       # Layout (3-column), Sidebar, Header
    │   │   ├── editor/       # MarkdownEditor (CodeMirror), MarkdownPreview
    │   │   ├── search/       # CommandPalette (cmdk), SearchResults
    │   │   ├── notes/        # NoteList, NoteCard, RelatedNotes
    │   │   ├── vault/        # VaultToggle, VaultBadge
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
pnpm seed             # Seed 18 sample notes (+ embeddings if OPENAI_API_KEY set)
pnpm create-indexes   # Create Atlas Search + Vector Search indexes
pnpm generate-master-key  # CSFLE: generate 96-byte local master key
pnpm create-data-key      # CSFLE: create data encryption key in Atlas
```

## Environment Variables (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | Atlas connection string |
| `OPENAI_API_KEY` | For Vector Search | OpenAI API key (needs `text-embedding-3-small` access) |
| `PORT` | No (default 3001) | Backend port |
| `ENCRYPTION_KEY_PATH` | For CSFLE | Path to `master-key.bin` |
| `CSFLE_DATA_KEY_ID` | For CSFLE | Base64 data encryption key ID |
| `CRYPT_SHARED_LIB_PATH` | For CSFLE | Path to `mongo_crypt_v1.dylib` |

## Key Dependencies

**Backend**: express 5, mongodb 7, mongodb-client-encryption 7, openai 6, cors, dotenv 17, zod 4, tsx

**Frontend**: react 19, @uiw/react-codemirror, @codemirror/lang-markdown, @codemirror/theme-one-dark, cmdk, react-markdown 10, remark-gfm, rehype-highlight, zustand 5, lucide-react, @tauri-apps/api 2, tailwindcss 4, vite 7

## Data Models

### `notes` collection
```
_id, title, markdown, tags[], notebookId, createdAt, updatedAt, embedding[] (1536 dims)
```

### `vault_notes` collection (CSFLE)
```
_id, title, markdown (encrypted via CSFLE Random), tags[], createdAt, updatedAt
```

## Atlas Indexes

- **`notes_search_index`** (Atlas Search): title (string + autocomplete edgeGram), markdown (string), tags (keyword + token)
- **`notes_vector_index`** (Vector Search): embedding field, 1536 dimensions, cosine similarity

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+K | Open command palette (text search) |
| Cmd+Shift+K | Open command palette (semantic search) |
| Cmd+Shift+V | Toggle vault mode |
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
- Embedding generation is fire-and-forget on note create/update
- CSFLE vault routes use lazy initialization middleware — encrypted client connects on first vault request
- `create-indexes` script auto-creates the `notes` collection if it doesn't exist

### Frontend
- Tailwind v4: CSS-first config via `@import "tailwindcss"` in globals.css, uses `@tailwindcss/vite` plugin (no tailwind.config.js or postcss.config.js)
- Dark theme: slate-900 bg, emerald-500 accent, amber-500 vault accent
- Tauri v2 CSP must include `connect-src http://localhost:3001` for backend API access
- `useSearch` hook: all returned functions must be wrapped in `useCallback` to prevent infinite re-render loops in consumers

### Tauri
- `beforeDevCommand` in tauri.conf.json must use `pnpm dev` (not `npm run dev`)
- `app.title` is not a valid field in Tauri v2 config — title only goes on individual windows
- Icon files required at build time in `src-tauri/icons/`

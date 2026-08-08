---
name: inkleaf-reference
description: Inkleaf lookup reference — the .env environment variables (MongoDB/embedding provider/sync/hybrid-weight settings and their defaults) and the app's keyboard shortcuts. Use when configuring .env, changing embedding or sync behavior, or adding/changing a keyboard shortcut.
---

# Inkleaf reference

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
| `HYBRID_TEXT_WEIGHT` | No (default 0.4) | `$rankFusion` weight for the full-text sub-pipeline |
| `HYBRID_VECTOR_WEIGHT` | No (default 0.6) | `$rankFusion` weight for the vector sub-pipeline |

Changing `EMBEDDING_PROVIDER` or `EMBEDDING_MODEL` is **not hot-swappable** — see the "Switching providers" note in `CLAUDE.md` and run `pnpm reembed`.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+N | Create a new note (focuses the title input) |
| Cmd+K | Open command palette (hybrid search) |
| Cmd+Shift+T | Toggle light/dark theme |
| Cmd+\ | Toggle sidebar |
| ↑ / ↓ | Previous / next note when the note list is focused |
| Cmd+O | Import a Markdown file as a new note (desktop menu accelerator) |
| Cmd+S | Export the active note as a Markdown file (desktop menu accelerator) |
| Escape | Close command palette |

When adding a shortcut, note the macOS gotcha in `CLAUDE.md`: `e.key` stays lowercase even with Shift held when Cmd is pressed.

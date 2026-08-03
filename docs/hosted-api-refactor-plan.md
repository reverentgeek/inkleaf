# Hosted API Refactor: A Possible Future Idea

> **Status: exploratory sketch, not planned, scheduled, or committed.** This
> describes a direction Inkleaf *could* take. It reads like a checklist because
> that was the easiest way to think it through, but none of it is implemented.
> Inkleaf today is a single-user desktop app whose backend runs locally and
> talks to Atlas directly. See the [README](../README.md) for what actually
> exists. Kept around because the reasoning may be useful to someone.

Split the monolithic `backend/` into a **hosted API server** (Atlas + OpenAI +
auth) and a **local offline agent** (SQLite + sync driver), so MongoDB code runs
on Azure while offline-first is preserved and **the client carries no secrets**.

## Context

Today `backend/` is one local Node process that is both the offline source of
truth (SQLite via `node:sqlite`, `services/sync.service.ts`) and the holder of
all secrets (`db/connection.ts` → Atlas, `services/embeddings.ts` → OpenAI). The
offline store can't move (needs a local Node process; frontend must work with no
connection), so the desktop keeps a small **local agent** that drives sync over
an authenticated HTTP boundary to a new stateless **hosted server**.

### Target architecture

```
Tauri webview (frontend)
  → http://localhost:3001   LOCAL AGENT (desktop): SQLite, local CRUD + FTS5,
                            sync DRIVER, proxies login + online search/semantic,
                            stores JWT (from login) in sync_state
      → https://<app>.azurewebsites.net   HOSTED SERVER (Azure): Atlas + OpenAI
                            + JWT_SECRET, auth, sync push/pull/embeddings,
                            $search / $vectorSearch
```

- Frontend still talks only to `localhost:3001` (contract unchanged + login).
- No secret shipped in the client build; JWT obtained at runtime on login.
- Conflict logic unchanged: LWW by `updatedAt`, ID reconciliation, checkpoint =
  max remote `updatedAt`, `updateOne`+`$set` (never replace).

---

## Phase 0: Workspace restructure
- [ ] Add `server/` and `shared/` to `pnpm-workspace.yaml` (alongside `frontend`, `local-agent`).
- [ ] Rename `backend/` → `local-agent/` (or keep name to reduce churn, but decide up front).
- [ ] Update root `package.json` scripts + `concurrently` to reference `local-agent` and add `dev:server`.
- [ ] Update Tauri `beforeDevCommand` / backend process spawn to launch `local-agent`.

## Phase 1: `shared/` types
- [ ] Extract wire types from `backend/src/types/index.ts`: `NoteDTO`, `SyncStatus`, `SearchResult`, `AutocompleteResult`, `SemanticResult`.
- [ ] Keep Atlas-only `Note` (ObjectId + `embedding`) server-side, not in shared.
- [ ] Add `authRequired: boolean` to `SyncStatus`.
- [ ] Point both `local-agent` and `server` at `shared`.

## Phase 2: Scaffold `server/` (Atlas/OpenAI, no sync/auth yet)
- [ ] Move `db/connection.ts`, `services/embeddings.ts`, `services/semantic.service.ts`.
- [ ] Copy `middleware/errorHandler.ts`.
- [ ] Split `search.service.ts`: keep only `atlasSearch` / `atlasAutocomplete` (drop `isOnline`/`localSearch` branch).
- [ ] Move `scripts/seed.ts`, `scripts/create-indexes.ts` (Atlas + OpenAI live here now).
- [ ] New `server/config.ts`: `MONGODB_URI`, `MONGODB_DB`, `OPENAI_API_KEY`, `PORT`, `JWT_SECRET`, `AUTH_USERNAME`, `AUTH_PASSWORD_HASH`.
- [ ] New `server/index.ts`: Express entry, **no SQLite, no sync loop**; keep fast-fail Atlas connect (`serverSelectionTimeoutMS: 5000`, listen before connect).
- [ ] Verify: `create-indexes`, `seed`, and search/semantic work against Atlas directly.

## Phase 3: Server auth (user login + JWT)
- [ ] Add deps `jsonwebtoken` + `bcryptjs` to `server`.
- [ ] `POST /auth/login` `{username,password}` → verify against `AUTH_USERNAME` + `AUTH_PASSWORD_HASH` (bcrypt) → return `{token, expiresAt}` (JWT signed with `JWT_SECRET`, ~30-day expiry).
- [ ] `requireAuth` middleware validating `Authorization: Bearer`.
- [ ] Put `/search`, `/semantic` behind `requireAuth`.
- [ ] Verify: bad password rejected; token unlocks search/semantic.

## Phase 4: Server sync endpoints (absorb Atlas-write logic)
- [ ] `POST /sync/push` `{changes:[{id,title,markdown,tags,notebookId,createdAt,updatedAt,deleted}]}` → `{results:[{id,status:"pushed"|"deleted"|"superseded"}]}`. Tombstone→`deleteOne`; remote newer→`superseded`; else `updateOne`+`$set`+`upsert` (never replace). Mirrors `pushDirtyNotes`.
- [ ] `POST /sync/embeddings` `{ids:[...]}` → `{embedded:[...],skipped:[...]}`. Read note from Atlas → `prepareTextForEmbedding` + `generateEmbedding` → `$set embedding`. Mirrors `pushPendingEmbeddings`.
- [ ] `GET /sync/pull?since=<ms>` → `{notes:[docs w/o embedding], remoteIds:[...allIds], remoteId:"<redacted hash of cluster+db>"}`. The two reads from `pullRemoteChanges`, as JSON.
- [ ] All three behind `requireAuth`; `GET /health` stays unauth.
- [ ] Verify with `curl` + Bearer token.

## Phase 5: Convert `local-agent` (strip secrets)
- [ ] Delete `db/connection.ts` and `services/embeddings.ts` from the agent.
- [ ] Trim `local-agent/config.ts` to `SQLITE_PATH`, `PORT`, `SYNC_INTERVAL_MS`; add `HOSTED_API_URL`.
- [ ] New `services/hosted-client.ts`: typed fetch wrapper; attaches `Authorization: Bearer` (token from `sync_state`); on 401 sets `authRequired`.
- [ ] New `routes/auth.ts`: `POST /api/auth/login` proxies to hosted, stores token in `sync_state`; `GET /api/auth/status` reports token validity.
- [ ] Move as-is (already SQLite-only): `db/sqlite.ts`, `services/notes.service.ts`, `services/local-search.service.ts`, `routes/notes.ts`, `routes/sync.ts`.

## Phase 6: Rewrite agent sync driver
Rewrite `local-agent/services/sync.service.ts`, **keeping its public surface**
(`isOnline`, `getSyncStatus`, `startSyncLoop`, `requestSync`, `syncNow`) so
`notes.service.ts` / `routes/sync.ts` are untouched.
- [ ] `tick()` step 1: `GET /health` → set `online`; keep existing backoff.
- [ ] Step 2: replace `ensureRemoteIdentity` (read `MONGODB_URI`) with a check against `remoteId` from the pull response; on change → mark all rows dirty + reset `last_pull_at` (preserves "empty remote ≠ mass delete" guard).
- [ ] Step 3 push: select `dirty=1` → `POST /sync/push` → apply results (`pushed`→clear dirty w/ `updated_at` guard; `deleted`→hard-delete local; `superseded`→clear dirty, let pull overwrite).
- [ ] Step 4 embeddings: select `embedding_pending=1 AND deleted=0 AND dirty=0` → `POST /sync/embeddings` → clear flag on returned ids.
- [ ] Step 5 pull: `GET /sync/pull?since=<checkpoint>` → feed JSON into the **existing** `pullRemoteChanges` SQLite merge logic moved verbatim into the agent (upsert + delete-missing + checkpoint = max remote `updatedAt`).
- [ ] `isOnline()` now = hosted reachable + authed; `getSyncStatus()` surfaces `authRequired`.
- [ ] Repoint `search.service.ts` online path at hosted client (keep `localSearch` offline fallback); `semantic.service.ts` online→hosted, offline→existing `503 {code:"OFFLINE"}`.

## Phase 7: Frontend login
- [ ] `frontend/src/api/client.ts`: keep `localhost:3001` base; add `api.auth.login()` / `api.auth.status()`.
- [ ] New `components/auth/LoginScreen.tsx`, shown when `authRequired`.
- [ ] `stores/appStore.ts` / `useSyncStatus`: surface `authRequired`, gate app / show login; header indicator reflects offline + pending + auth state.
- [ ] CSP (`tauri.conf.json:22`) and agent CORS (`index.ts`): unchanged (webview still only talks to localhost; agent proxies to hosted).

## Phase 8: Config, infra, docs
- [ ] `.env.example`: split vars between agent (`SQLITE_PATH`, `PORT`, `HOSTED_API_URL`, `SYNC_INTERVAL_MS`) vs server (`MONGODB_URI`, `MONGODB_DB`, `OPENAI_API_KEY`, `JWT_SECRET`, `AUTH_USERNAME`, `AUTH_PASSWORD_HASH`).
- [ ] Azure App Service: Node 22 LTS, "Always On", B1 tier (warm Mongo pool); secrets in App Settings / Key Vault; Atlas Network Access allowlists App Service egress IP (or Private Endpoint).
- [ ] Update `CLAUDE.md` (architecture, structure, env tables, sync notes) and `README.md` for the three tiers.

---

## Verification (end to end)
- [ ] **Server standalone**: `pnpm --filter server dev`; `create-indexes`; `seed`; `curl /auth/login` → token; then `/search`, `/semantic`, `/sync/pull`, `/sync/push` with Bearer.
- [ ] **Online round-trip**: agent + server + frontend; create/edit/delete → notes appear in Atlas, `pendingEmbeddings→0`, a second agent pulls them.
- [ ] **Offline-first**: stop server → CRUD works, text search falls back to FTS5, semantic returns `503 OFFLINE`, header shows offline + pending; restart → pending flushes.
- [ ] **No-secrets check**: grep frontend build + `local-agent` for `MONGODB_URI`/`OPENAI_API_KEY` → none; login required; bad password rejected; 401 re-triggers login screen.
- [ ] **Re-seed guard**: point server at a fresh empty Atlas DB → agent re-pushes local notes instead of wiping local store.
- [ ] `pnpm build` across all workspaces passes.

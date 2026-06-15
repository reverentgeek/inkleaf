# Cross-Platform Client Architecture

**Status:** Draft — three candidates under evaluation
**Scope:** How Inkleaf should be structured to run on desktop and mobile once
the backend moves to a hosted, multi-tenant API.

## Background

Inkleaf today is a Tauri v2 desktop app: a React + Vite frontend in the webview
and an Express/Node backend as a separate process, with a local SQLite store
(`node:sqlite`) for offline and a background sync engine that talks to MongoDB
Atlas directly.

Two decisions are already driving a rearchitecture:

- **Multi-tenant hosting.** To offer the app to other people, MongoDB access and
  other secrets (the Atlas connection string, the OpenAI key) cannot ship inside
  the client. They must live behind a hosted API with authentication and
  per-user data isolation.
- **Mobile.** We want the app on iOS and Android, not just desktop.

So the device becomes a local-first client that syncs to a hosted API, and the
question this doc answers is: **what shells do we build that client in?**

Three candidates are on the table:

- **Electron + Capacitor** — keeps the whole stack in TypeScript/JavaScript and
  reuses the existing React DOM UI in a webview.
- **Tauri** — reuses the React DOM UI in a webview, but puts the on-device core
  in Rust.
- **Flutter** — a ground-up rewrite in Dart with its own rendering engine,
  trading all reuse for one codebase across every platform.

Note the split: Electron+Capacitor and Tauri both render *your existing React
UI* in a webview, so for those two the decision is about the on-device core
language and footprint, not the UI. Flutter is a different bet entirely — no
React, no webview — so it's compared on different terms.

## Goals

- Maximize shared code across desktop, mobile, and (optionally) web.
- Preserve a strong offline experience on every platform.
- Minimize long-term maintenance burden (number of languages and codebases).
- Keep a good — ideally native-feeling — mobile experience.

## Options Considered

### Option A — Electron (desktop) + Capacitor (mobile)

Both shells run the same React DOM application: Electron (bundled Chromium) on
the desktop, a system WebView on mobile. The on-device core — local SQLite store
and the sync client that talks to the hosted API — is TypeScript, running in
Electron's Node main process on desktop and as JS in the WebView (via Capacitor
plugins) on mobile. Native device features come through Capacitor plugins.

- **Code sharing:** highest. UI **and** the TS core/sync logic are shared across
  desktop and mobile, and can also feed a browser/PWA build.
- **Effort:** lowest. Reuses the existing Express/TypeScript sync and storage
  logic, adapted to run on-device rather than as a server.
- **Footprint:** heavy. Electron ships Chromium (~150 MB+ desktop binaries,
  higher memory).
- **Rendering:** consistent Chromium on desktop; mobile uses platform WebViews.
- **Mobile maturity:** Capacitor's mobile tooling is mature and battle-tested.

### Option B — Tauri (desktop and mobile)

The architecture Tauri is designed for: the on-device core is a Rust crate, and
the React UI calls it via `invoke()` (IPC) instead of `fetch()`. Tauri uses the
OS webview on every platform (WebView2 / WKWebView / WebKitGTK).

- **Code sharing:** UI (React DOM) shares across Tauri desktop and mobile; the
  Rust core shares across both too — but it cannot serve a web/PWA build (no Rust
  in the browser).
- **Effort:** higher. Requires porting the storage layer and sync client to
  Rust. More tractable than it once was: under the hosted-API direction the
  on-device core no longer needs the MongoDB driver or OpenAI — it is just local
  SQLite (`rusqlite`/`sqlx`, FTS5) plus an HTTP sync client (`reqwest`).
- **Footprint:** lean. OS webview, no bundled Chromium — small binaries, low
  memory.
- **Rendering:** relies on per-platform webview engines, so rendering can vary.
- **Mobile maturity:** Tauri's mobile targets are newer and less battle-tested.

### Option C — Flutter (all platforms)

A single Dart codebase compiled to native ARM, rendering its own UI (Impeller).
One codebase targets iOS, Android, macOS, Windows, Linux, and web. The on-device
core (SQLite + sync client) and UI are all rewritten in Dart; the app talks to
the same hosted API over HTTP.

- **Code sharing:** none with the current React/TS code — but one Dart codebase
  covers *all six* platforms, collapsing the desktop and mobile shells into one.
- **Effort:** highest upfront. A full rewrite in a new (if JS-friendly) language;
  the editor and preview are rebuilt rather than reused.
- **Footprint:** medium. AOT-compiled native, with an engine baseline — bigger
  than truly native, far smaller than Electron.
- **Rendering:** its own engine, pixel-consistent across every platform.
- **Mobile maturity:** mature on mobile; desktop is stable but younger; the web
  target is the weakest (heavy payload, SEO-unfriendly).
- **Forward-looking upside (the reason it's not just equivalent):**
  - **On-device AI / offline semantic search.** Semantic search is currently
    online-only. Flutter has clean paths to on-device embeddings (TensorFlow
    Lite / LiteRT, MLKit) and a local vector store (ObjectBox's Dart SDK has
    on-device vector search; `sqlite-vec` via `dart:ffi`), which could make
    semantic search work offline.
  - **Mature notes-editor ecosystem.** `super_editor`, `flutter_quill`, and
    AppFlowy (an open-source Notion alternative built in Flutter) are proof that
    an offline-first knowledge-base editor is a solved shape here.
  - **Custom canvas-grade UI** (linked-note graph views, ink/handwriting,
    diagrams) and high-performance large-document handling without webview limits.
- **Honest costs:** the Dart rewrite with zero reuse; text/IME/accessibility
  edge cases in a text-heavy editor (Flutter draws its own text — prototype this
  early); and a weak web target.

## Comparison

| Dimension | A: Electron + Capacitor | B: Tauri | C: Flutter |
| --- | --- | --- | --- |
| Core language | TS/JS everywhere | Rust core + TS UI | Dart (full rewrite) |
| Reuses today's React/TS | High | UI yes, core → Rust | None (rewrite) |
| Shared UI (desktop↔mobile) | Yes (React DOM) | Yes (React DOM) | Yes (one Dart UI) |
| Editor (CodeMirror) reuse | Yes | Yes | No (rebuild) |
| Rendering | Chromium desktop / webview mobile | Per-platform webviews | Own engine, consistent |
| Platform reach | Desktop + mobile (+ PWA) | Desktop + mobile | All six, one codebase |
| Desktop binary / memory | Large (Chromium) | Small (OS webview) | Medium (engine baseline) |
| Mobile tooling maturity | Mature | Newer | Mature (mobile); web weak |
| Native device APIs | Capacitor plugins | Tauri plugins (Rust) | Flutter plugins / `dart:ffi` |

A and B reuse your React UI, so the choice between *them* is core language and
footprint. C trades all reuse for a single codebase across every platform and the
highest long-term ceiling.

## Choosing Between Them

There is no single winner; it depends on which priority dominates.

**Lean Electron + Capacitor if:**

- Speed to ship and lowest effort matter most — it reuses the existing
  TypeScript logic instead of a rewrite or a Rust port.
- One language across the whole stack is a hard preference.
- A browser/PWA build is wanted (the TS core serves it).
- A consistent desktop rendering engine is valued.

**Lean Tauri if:**

- Small, low-memory binaries and a more native footprint matter most.
- The team is comfortable maintaining Rust, and the well-scoped on-device core
  (SQLite + HTTP sync) is an acceptable port now that Mongo and OpenAI calls have
  moved server-side.
- The longer-term native direction outweighs Capacitor's more mature mobile
  tooling today.

**Lean Flutter if:**

- You'll trade a Dart rewrite for one codebase across all six platforms — no
  separate desktop and mobile shells to maintain.
- The long-term product ceiling matters: on-device AI (offline semantic search),
  rich custom/canvas UI, and high-performance large-document handling.
- The team can absorb a new language and is willing to prototype the editor's
  text/IME behavior early.

A reasonable read: **Electron + Capacitor** is the pragmatic path to ship fast
with one team and one language; **Tauri** is the durable native-core bet if the
team can absorb Rust; **Flutter** has the highest long-term ceiling (one codebase
everywhere, on-device AI, custom UI) at the cost of the largest upfront switch.

## Shared-Core Structure

For the two React-based options, reuse only materializes if platform-specific
concerns are isolated behind interfaces. Inkleaf is already a pnpm monorepo, so
under **Electron + Capacitor**:

```text
packages/
  core/         # domain types, API client, Zustand stores, Zod schemas,
                # sync orchestration — no platform APIs
  storage/      # storage interface + per-platform implementations
  ui/           # shared React DOM components, editor, preview
apps/
  desktop/      # Electron shell — mounts packages/ui
  mobile/       # Capacitor shell — mounts packages/ui
  web/          # optional browser / PWA build
```

Under **Tauri**, the `ui` package stays shared, but `core`/`storage`/sync become
a Rust crate behind the `invoke()` boundary instead of TS packages, and there is
no `web` target. Under **Flutter**, none of this applies — it is a separate Dart
project with its own structure that shares only the hosted-API contract, not
code. (That shared contract is what keeps even the no-reuse path single-sourced
on the server side.)

## Friction Points

Budget for these regardless of choice.

- **Local SQLite layer (biggest one).** Today's `node:sqlite` is Node-only. The
  storage layer needs a per-target implementation behind one interface:
  - Electron: `node:sqlite` or `better-sqlite3` (Node main process).
  - Capacitor: `@capacitor-community/sqlite`, or `wa-sqlite` + OPFS in the WebView.
  - Tauri: `rusqlite` / `sqlx` (with FTS5) in the Rust core.
  - Flutter: `drift` / `sqflite` (FTS5), or ObjectBox (adds on-device vectors).

- **The editor.** CodeMirror is DOM-based, so it reuses cleanly on Electron+
  Capacitor and Tauri (both render the UI in a webview). Flutter is the exception
  — the editor is rebuilt (`super_editor` / `flutter_quill`), and its text/IME/
  accessibility behavior should be prototyped early.

- **Background sync.** Mobile OSes (iOS especially) restrict background
  execution. Plan for foreground-driven sync plus a constrained background task
  (Capacitor Background Runner, a Tauri mobile equivalent, or Flutter's
  background-task plugins), not a long-running daemon.

- **Secure token storage.** The user's auth token needs platform secure storage
  (Keychain / Keystore) — a Capacitor plugin, a Tauri Rust plugin, or a Flutter
  secure-storage package.

## What Does Not Change

The hosted-API direction simplifies the client on all three paths: every platform
talks to the **same HTTP API**, so there is no per-platform sync target. Atlas
Search, Vector Search, and embedding generation already run server-side and
online-only, so moving them behind the hosted API costs nothing in offline
capability — the device keeps SQLite FTS5 as its offline search. (Flutter could
later go further and add on-device semantic search, but that is upside, not a
requirement.)

## Open Questions

- Auth provider (Clerk / Auth0 / Supabase Auth / other) and how the token flows
  into the on-device API client.
- Whether the hosted API is serverless functions or a small always-on service
  (MongoDB connection pooling favors the latter).
- Offline vector search on device, or accept that semantic search is online-only
  (current behavior). Flutter makes the on-device path notably easier.
- Per-user scoping of the existing last-write-wins sync model.
- Tauri path: how much the Rust core port actually costs once scoped to
  SQLite + HTTP sync only.
- Flutter path: prototype the markdown editor early to validate text/IME and
  selection behavior before committing.

## Further Reading

- Capacitor — <https://capacitorjs.com/docs> (see the chat thread for the
  annotated resource list).
- Tauri v2, incl. mobile — <https://v2.tauri.app>.
- Flutter — <https://docs.flutter.dev>; AppFlowy (Flutter notes app) —
  <https://github.com/AppFlowy-IO/AppFlowy>.

# Inkleaf Docs

Two very different kinds of documents live here. Please don't read the second
group as a roadmap.

## How the app works today

Accurate descriptions of the shipped code:

- [save-note.md](save-note.md) — end-to-end walkthrough of editing a note, from
  keystrokes to Atlas and async embedding generation
- [semantic-search.md](semantic-search.md) — end-to-end walkthrough of a
  semantic search, from `Cmd+Shift+K` through embeddings to `$vectorSearch`
- [project-structure.md](project-structure.md) — quick tour of the backend and
  frontend layout

## Possible future ideas

Exploratory sketches. **Nothing in these is planned, scheduled, or committed** —
they're thinking-out-loud documents about directions Inkleaf *could* take, kept
in the repo because the reasoning may be useful to others. None of it is built.

- [future-features.md](future-features.md) — scratch list of feature ideas
- [hosted-api-refactor-plan.md](hosted-api-refactor-plan.md) — what splitting
  the backend into a hosted API plus a local offline agent would involve
- [multi-tenant-saas-plan.md](multi-tenant-saas-plan.md) — what multi-tenancy
  would require; there is no hosted Inkleaf service, and none is intended
- [cross-platform-architecture.md](cross-platform-architecture.md) — candidate
  approaches for running beyond the macOS desktop

# Contributing to Inkleaf

Thanks for your interest! Inkleaf is a personal project and a demo of MongoDB
Atlas Search and Atlas Vector Search, maintained in spare time. That shapes what
contributions fit best — please read the scope note before starting anything
large.

## Scope

Inkleaf is deliberately small: a **single-user, offline-first desktop Markdown
notebook** that shows off Atlas Search and Vector Search. It is not trying to
become a multi-user product, a hosted service, or a general-purpose note app.

Most welcome:

- Bug fixes, with steps to reproduce
- Cross-platform fixes — it is developed and tested on macOS, so Windows and
  Linux are under-exercised (the keyboard shortcuts in particular assume Cmd)
- Documentation corrections, especially anywhere the docs drift from the code
- Accessibility and keyboard-navigation improvements

Please **open an issue before** starting on:

- New features or UI surfaces
- New dependencies
- Anything touching the sync engine, soft-delete/tombstone behavior, or the
  SQLite schema — these have subtle correctness constraints and are easy to
  break in ways tests would not currently catch
- Anything in the `docs/` sketches labeled *possible future idea*; those are
  thought experiments, not an invitation to implement them

This keeps you from spending time on something that may not get merged.

## Getting set up

See the [README](README.md) for full setup. In short:

```bash
pnpm install         # requires Node 22.5+ (enforced) — Node 24+ recommended
cp .env.example .env # add your MONGODB_URI
pnpm create-indexes
pnpm seed
pnpm dev             # browser, no Rust needed
pnpm dev:tauri       # desktop window, needs Rust
```

You need your own MongoDB Atlas cluster (the free M0 tier is enough). Vector
search additionally needs a Voyage AI or OpenAI key; text search, editing, and
sync all work without one.

## Before you open a pull request

There is **no automated test suite yet**, so please verify by hand and say what
you checked. At minimum:

- [ ] `pnpm build` passes (type-checks backend and frontend)
- [ ] The app runs and the area you touched still works
- [ ] If you touched sync or delete behavior: verify offline editing, coming back
      online, soft delete, undo/restore, and permanent delete
- [ ] If you touched search: verify both online (Atlas) and offline (SQLite
      FTS5) paths — stop your network to exercise the fallback

Adding tests alongside a fix is very welcome, and setting up a first test
harness or CI workflow would be a genuinely useful contribution.

## Conventions

- **Style:** no linter or formatter is configured for the repo. Match the file
  you are editing — indentation is inconsistent across the tree, and a PR that
  reformats untouched lines is hard to review. Please keep diffs minimal.
- **Backend imports** use `.js` extensions (NodeNext module resolution).
- **Commits:** plain descriptive subject lines. Explain *why* in the body when
  the reason is not obvious.
- **Version bumps:** the app version lives in six files that must move together
  (both root and workspace `package.json`s, `tauri.conf.json`, `Cargo.toml`, and
  `Cargo.lock` via `cargo update -p inkleaf`). Maintainers normally handle this —
  you do not need to bump versions in a PR.
- **Never commit secrets.** `.env` is gitignored; keep real connection strings
  and API keys out of code, tests, screenshots, and issue reports.

## Reporting bugs

Use the issue templates. Please include your OS, Node version (`node -v`), and
whether you are running desktop (`pnpm dev:tauri`) or browser (`pnpm dev`) mode,
and redact your connection string.

For anything security-related, **do not open a public issue** — see
[SECURITY.md](SECURITY.md).

## Code of conduct

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Licensing

Inkleaf is [MIT licensed](LICENSE). By contributing, you agree your
contributions are licensed under the same terms.

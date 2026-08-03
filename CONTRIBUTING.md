# Contributing to Inkleaf

Thanks for being here! Inkleaf is a personal project and a demo of Atlas Search and Atlas Vector Search, built in spare time. That shapes what fits well, so please skim the scope note before you start anything big.

## What's in scope

Inkleaf is deliberately small: a **single-user, offline-first desktop Markdown notebook** that shows off Atlas Search and Atlas Vector Search. It isn't trying to become a multi-user product, a hosted service, or a general-purpose note app that does everything.

Things I'd love help with:

- **Bug fixes**, ideally with steps to reproduce
- **Cross-platform fixes**, since it's developed and tested on macOS and the keyboard shortcuts all assume Cmd. Windows and Linux need attention.
- **Documentation corrections**, especially anywhere the docs have drifted from the code
- **Accessibility and keyboard navigation** improvements

Please **open an issue first** for:

- New features or new UI surfaces
- New dependencies
- Anything touching the sync engine, the soft-delete and tombstone behavior, or the SQLite schema. These have subtle correctness constraints and are easy to break in ways nothing would currently catch.
- Anything in the `docs/` sketches labeled *possible future idea*. Those are thought experiments, not a to-do list.

This isn't gatekeeping. It's so you don't spend a weekend on something that turns out not to fit.

## Getting set up

The [README](README.md) has the full walkthrough. The short version:

```bash
pnpm install         # needs Node 22.5+ (enforced), Node 24+ preferred
cp .env.example .env # add your MONGODB_URI
pnpm create-indexes
pnpm seed
pnpm dev             # browser, no Rust required
pnpm dev:tauri       # desktop window, needs Rust
```

You'll need your own MongoDB Atlas cluster, and the free M0 tier is plenty. Vector search also wants a Voyage AI or OpenAI key, but text search, editing, and sync all work without one.

## Before you open a pull request

There's **no automated test suite yet**, so verification is manual. Please tell me what you actually exercised:

- [ ] `pnpm build` passes (this type-checks both backend and frontend)
- [ ] The app runs and the part you touched still behaves
- [ ] Touched sync or delete? Check offline editing, reconnecting, soft delete, undo/restore, and permanent delete.
- [ ] Touched search? Check both the online Atlas path and the offline SQLite FTS5 fallback. Turning off your network is the easy way to exercise the fallback.

Adding tests alongside a fix is very welcome. Honestly, setting up the first test harness or a CI workflow would be one of the most useful contributions this repo could get.

## Conventions

- **Style**: there's no linter or formatter configured for the repo, so match the file you're editing. Indentation is inconsistent across the tree (sorry), and a diff that reformats untouched lines is painful to review. Small diffs, please.
- **Backend imports** use `.js` extensions, thanks to NodeNext module resolution.
- **Commits**: plain, descriptive subject lines. Use the body to explain *why* when the reason isn't obvious from the diff.
- **Version bumps**: the app version lives in six files that have to move together (the root and workspace `package.json` files, `tauri.conf.json`, `Cargo.toml`, and `Cargo.lock` via `cargo update -p inkleaf`). I normally handle this, so you don't need to bump anything in a PR.
- **Never commit secrets.** `.env` is gitignored. Keep real connection strings and API keys out of code, screenshots, and issue reports.

## Reporting bugs

The issue templates will ask, so save yourself a round trip: include your OS, your Node version (`node -v`), and whether you're in desktop (`pnpm dev:tauri`) or browser (`pnpm dev`) mode. Redact your connection string.

Security issues are different. Please **don't** open a public issue for those. See [SECURITY.md](SECURITY.md).

## Code of conduct

Everyone here follows the [Code of Conduct](CODE_OF_CONDUCT.md). Be decent to each other.

## Licensing

Inkleaf is [MIT licensed](LICENSE). By contributing, you agree your contributions ship under the same license.

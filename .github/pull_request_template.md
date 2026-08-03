<!--
Thanks for contributing! For anything beyond a small fix, please open an issue
first — see CONTRIBUTING.md.
-->

## What does this change?

<!-- A sentence or two, plus "Fixes #123" if it closes an issue. -->

## Why?

<!-- The motivation, if it isn't obvious from the above. -->

## How was it verified?

There is no automated test suite yet, so please say what you exercised by hand.

- [ ] `pnpm build` passes
- [ ] Ran the app and confirmed the affected area works
- [ ] If sync or delete changed: checked offline editing, reconnecting, soft
      delete, undo/restore, and permanent delete
- [ ] If search changed: checked both the Atlas path and the offline SQLite FTS5
      fallback

<!-- Screenshots are helpful for UI changes — light and dark theme if relevant. -->

## Checklist

- [ ] No secrets, connection strings, or private note content in the diff,
      screenshots, or commit messages
- [ ] Diff is limited to the change — no drive-by reformatting of untouched lines
- [ ] Docs updated if behavior or setup changed

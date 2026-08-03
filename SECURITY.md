# Security Policy

## Reporting a vulnerability

Please **don't open a public issue** for a security problem.

Instead, report it privately through GitHub's [private vulnerability reporting](https://github.com/reverentgeek/inkleaf/security/advisories/new) (Security tab, then "Report a vulnerability"), or email **david@reverentgeek.com**.

Tell me what you found, how to reproduce it, and what impact you think it has. Please **redact connection strings, API keys, and note contents** from anything you send along.

Inkleaf is a spare-time project rather than a commercial product, so I can't promise a response window. I will acknowledge your report as soon as I reasonably can, and I'll credit you in the fix unless you'd rather stay anonymous.

## Supported versions

Only the latest commit on `main`. There are no backported fixes for older tags.

## Threat model, or: what's a bug and what's just Tuesday

Inkleaf is a **single-user local desktop app**, and a few things that look alarming are working exactly as intended:

- **The local API has no authentication.** The backend on port 3001 has no login. It binds to `127.0.0.1` only, so other machines can't reach it, and it trusts anything already running as you on your own computer. That's the normal model for a local-first desktop app. "Another local process can call the API" is expected behavior, not a vulnerability.
- **Notes aren't encrypted at rest.** The SQLite store (`backend/data/inkleaf.db`) is a plain file protected by your OS file permissions, and Atlas documents are stored as they are. Inkleaf adds no application-layer encryption.
- **Secrets sit in `.env` in plaintext.** Standard for local development. Just keep the file out of version control, which `.gitignore` already handles.
- **Rendered Markdown is your own content.** Notes get rendered in the webview, which is fine when you wrote them. A note that can escape the renderer to reach Tauri APIs or exfiltrate data *is* worth reporting, though, especially through the import path, since those files may come from someone else.

Things I'd really like to hear about:

- Anything reachable from **outside** the local machine
- Sandbox or CSP escapes in the Tauri webview, or filesystem access beyond the scoped `$HOME/**` capability
- Secret leakage, meaning API keys or connection strings showing up in logs, error responses, exported files, or the built frontend bundle
- Injection into the MongoDB query or aggregation pipelines by way of note content or search input
- Data-destroying bugs in the sync or delete paths, such as notes vanishing, tombstones coming back from the dead, or the wrong cluster getting wiped

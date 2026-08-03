# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report privately via GitHub's
[private vulnerability reporting](https://github.com/reverentgeek/inkleaf/security/advisories/new)
(Security tab → Report a vulnerability), or by email to **david@reverentgeek.com**.

Please include what you found, how to reproduce it, and the impact you think it
has. **Redact connection strings, API keys, and note contents** from anything you
send.

Inkleaf is a spare-time project, not a commercial product, so there is no
guaranteed response window — but I will acknowledge reports as soon as I
reasonably can and credit you in the fix unless you would rather stay anonymous.

## Supported versions

Only the latest commit on `main` is supported. There are no backported fixes for
older tags.

## Threat model — please read before reporting

Inkleaf is a **single-user local desktop app**, and some things that look like
vulnerabilities are working as designed:

- **The local API is unauthenticated.** The backend on port 3001 has no login.
  It binds to `127.0.0.1` only, so it is not reachable from other machines, and
  it trusts anything already running as your user on your own machine. That is
  the intended model for a local-first desktop app. A report that another
  *local* process can call the API is expected behavior, not a vulnerability.
- **Your notes are not encrypted at rest.** The SQLite store
  (`backend/data/inkleaf.db`) is a plain file with your OS file permissions, and
  Atlas documents are stored as-is. Inkleaf adds no application-layer encryption.
- **Your secrets live in `.env` in plaintext.** This is standard for local
  development; keep the file out of version control (it is gitignored).
- **Rendered Markdown is your own content.** Notes you write or import are
  rendered in the webview. A note that can escape the renderer and reach Tauri
  APIs or exfiltrate data *is* worth reporting — especially via imported files,
  since those may come from someone else.

Things I would very much like to hear about:

- Anything reachable from **outside** the local machine
- Sandbox or CSP escapes in the Tauri webview, or filesystem access beyond the
  scoped `$HOME/**` capability
- Secret leakage — API keys or connection strings reaching logs, error
  responses, exported files, or the built frontend bundle
- Injection into the MongoDB query/aggregation pipelines via note content or
  search input
- Data-destroying bugs in the sync or delete paths (notes lost, tombstones
  resurrecting, a wrong cluster being wiped)

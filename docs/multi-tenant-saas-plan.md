# Multi-Tenant SaaS Variant — Design Sketch

A companion to `hosted-api-refactor-plan.md`. That plan splits the backend into a
hosted API + local offline agent for a **single user**. This sketch describes
what changes if Inkleaf becomes a **multi-tenant SaaS** that many people/orgs use.

> **Framing:** the framework choice (Express → Fastify) is a line item here, not
> the crux. Tenancy isolation, auth, and the client model reshape the product far
> more. Resolve those three first (see "Decisions to make up front").

## Context

The current design bakes in single-user assumptions that break under
multi-tenancy:
- One `notes` collection, one Atlas Search index, one vector index — **no tenant
  dimension** anywhere.
- Planned auth is a single env-configured user (`AUTH_USERNAME` / `AUTH_PASSWORD_HASH`).
- The offline-first **local agent + SQLite** is a *desktop* feature; "lots of
  people" usually implies a browser app instead.

---

## Decisions to make up front

These gate everything else — answer before writing code.

1. **Client model: web app or many desktop installs?**
   - **Web SaaS (recommended for "lots of people")** → drop the local Node agent
     and SQLite entirely; the browser talks to the hosted API; server is
     authoritative. Offline, if wanted later, becomes an in-browser concern
     (IndexedDB + sync), a separate large effort.
   - **Desktop-per-user** → keep the Tauri app + local agent from the base plan,
     but the agent authenticates as a tenant user and all sync carries `tenantId`.
   - This sketch assumes **web SaaS**; call-outs mark where desktop differs.

2. **Tenancy isolation model** (see below) — shared collection vs. DB-per-tenant
   vs. cluster-per-tenant.

3. **Build auth or buy it** — strongly recommend **buy** (Auth0 / Clerk / WorkOS
   / Supabase Auth). This is where SaaS teams lose months.

---

## 1. Tenancy & data isolation

### Model options
| Model | Isolation | Cost | Search/Vector index | Verdict |
|---|---|---|---|---|
| **Shared collection + `tenantId`** | Logical (query-enforced) | Lowest | One shared index, filtered by `tenantId` | **Recommended** to start |
| **DB-per-tenant** | Strong | Medium (index per DB) | Index per DB — multiplies index count | For enterprise/compliance tiers |
| **Cluster-per-tenant** | Hardest | Highest | Fully isolated | Only for large/regulated customers |

### Recommended: shared collection + `tenantId`
- Add `tenantId` (and `userId`, and probably `orgId`) to every `notes` document.
- **Every** query, `$search`, and `$vectorSearch` pipeline MUST filter by
  `tenantId`. A missing filter is a cross-tenant data leak — the #1 SaaS bug class.
  - `$search`/`$vectorSearch`: add a `filter`/`$match` on `tenantId`
    (`$vectorSearch` supports a `filter` on indexed fields — add `tenantId` to the
    vector index definition as a filter field).
  - Enforce structurally: a repository layer that **requires** a tenant context
    and injects the filter, so no route can forget it. Never build raw pipelines
    in route handlers.
- Add compound indexes leading with `tenantId` (e.g. `{tenantId:1, updatedAt:-1}`).
- Consider a per-tenant document cap / plan quota.

### Atlas Search / Vector at scale
- Keep **one** `notes_search_index` and **one** `notes_vector_index`, both
  tenant-filtered — avoids index sprawl and per-tenant index build cost.
- Add `tenantId` as a `token`/filter field to `notes_search_index` and as a
  `filter` field to `notes_vector_index`.

## 2. Auth & tenant resolution

- **Buy an identity provider.** Signup, login, password reset, MFA, social login,
  refresh tokens, and (critically) **organizations/teams** are all solved by
  Auth0/Clerk/WorkOS. Rolling your own is a multi-month liability.
- JWT from the provider carries `sub` (user) + org/tenant claim. A Fastify
  `onRequest` hook (or Express middleware) resolves `{tenantId, userId, roles}`
  into a request-scoped context consumed by the repository layer.
- **Authorization**, not just authentication: roles (owner/admin/member),
  per-note or per-notebook sharing, org-level settings.
- Replace the base plan's `AUTH_USERNAME`/`AUTH_PASSWORD_HASH` entirely.

## 3. API server (Fastify)

Build the hosted server on **Fastify** (greenfield anyway):
- `@fastify/jwt` (verify provider tokens) + tenant-resolution hook.
- Per-route **JSON Schema** validation + `fast-json-stringify` serialization.
- `@fastify/rate-limit` **keyed by tenant/plan** (noisy-neighbor protection).
- `@fastify/helmet`, `@fastify/cors`, `@fastify/under-pressure` (shed load).
- **pino** structured logging with `tenantId`/`requestId` on every line.
- All the sync/search/semantic endpoints from the base plan, now tenant-scoped.

## 4. Embeddings & background jobs

- Move embedding generation **out of the request path** into a **job queue**
  (BullMQ/Redis, or a cloud queue). Inline OpenAI calls per request don't survive
  many tenants.
- Per-tenant rate limiting / batching of OpenAI calls; track embedding cost per
  tenant (it's a real COGS line item).
- Idempotent, retryable jobs; dead-letter for failures.

## 5. The offline agent & sync

- **Web SaaS:** drop the local agent + SQLite + the client/server sync protocol
  from the base plan. The browser is a thin client; server is source of truth.
  Offline becomes a later, separate feature (IndexedDB + a documented sync
  protocol) if the market wants it.
- **Desktop-per-user:** keep the base plan's agent, but every push/pull carries
  the tenant JWT; the server scopes all Atlas access by `tenantId`. The
  `remoteId`/re-seed guard still applies, per tenant.

## 6. Billing, plans, quotas
- Stripe (or similar) for subscriptions; map plan → limits (note count, storage,
  embedding quota, seats).
- Enforce quotas in the repository/service layer, surfaced as `402/429` with
  clear upgrade messaging.

## 7. Operational concerns (new at SaaS scale)
- Per-tenant observability (traces/metrics/logs filterable by `tenantId`).
- Data export / deletion (GDPR "right to be forgotten" — easy with `tenantId`
  filter; verify it cascades to Atlas indexes).
- Backups + point-in-time recovery; tenant-level restore story.
- Multi-region / data residency for enterprise (ties back to tenancy model).
- Secrets management, per-environment (dev/staging/prod) isolation.

---

## Suggested migration path (from the base plan)

1. Land the base single-user hosted-API refactor first (it's a prerequisite —
   secrets off client, hosted server exists).
2. Introduce `tenantId`/`userId` on `notes` + repository layer that enforces the
   tenant filter everywhere (add tenant fields to both Atlas indexes).
3. Integrate the bought identity provider; replace single-user auth; add tenant
   resolution hook.
4. Rebuild the hosted server on Fastify with schema validation + rate limiting +
   pino (or migrate incrementally, tenant-filter first).
5. Move embeddings to a background job queue.
6. Decide the client model; for web SaaS, build the browser client and retire the
   local agent; for desktop, tenant-scope the existing agent.
7. Add billing/plans/quotas.
8. Harden ops: observability, GDPR delete/export, backups, multi-region as needed.

## Verification additions (beyond the base plan)
- **Cross-tenant isolation tests** (highest priority): tenant A can never read,
  search, or vector-match tenant B's notes via any endpoint or pipeline.
- Quota enforcement returns `402/429` at plan limits.
- Auth: token from provider resolves correct tenant; expired/forged tokens rejected.
- Load test: rate limiting isolates a noisy tenant; `under-pressure` sheds load.
- GDPR: tenant delete removes docs **and** purges them from Atlas Search/Vector indexes.

## Open questions for you
- Web app, desktop-per-user, or both?
- Team/org accounts, or individual users only?
- Compliance requirements (SOC 2 / GDPR / HIPAA) that would force stronger
  isolation (DB- or cluster-per-tenant) for some tiers?

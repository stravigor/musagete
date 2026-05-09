```
slice_id:      001-auth-magic-link-and-oauth
status:        Signed
date:          2026-05-09
signed by:     Liva
references:
  slice:       ./001-auth-magic-link-and-oauth.md
  design:      ../10-design.md
  adrs:
    - ../adr/0002-auth-strategy-strav-native-only.md
    - ../adr/0001-architecture-strav-islands-over-spa.md
    - ../adr/0003-styling-tokens-css-modules.md
  adapter:     ../adapters/strav.md
```

---

## Interface contract

### `POST /auth/magic`

- **Kind:** HTTP route (form or JSON).
- **Input schema:**
  ```
  {
    email: string (RFC 5322; lowercased server-side; max 254 chars)
  }
  ```
- **Success response:**
  - Status: `202 Accepted`
  - Body: `{ status: "sent", expires_in_seconds: 900 }`
- **Error modes:**
  - `400` — invalid email shape; body `{ error: "invalid_email" }`.
  - `429` — rate limit exceeded; body `{ error: "rate_limited", retry_after: <seconds> }`.
- **Authz:** public.
- **Idempotency / rate limits:** ≤ 5 magic-link requests per email per rolling 10-minute window. (Per-IP cap dropped — per-email is the operative bound.)

### `GET /auth/magic/:token`

- **Kind:** HTTP route.
- **Input:** `:token` is a URL-safe random ≥ 32 bytes, base64url-encoded.
- **Success response:**
  - Status: `302 Found`, `Location: /` (or `/auth/2fa/verify` if the user has TOTP enabled).
  - Sets a session cookie (HTTPOnly, Secure, SameSite=Lax).
- **Error modes:**
  - `400` — token unknown, consumed, or expired; renders the auth screen with an "expired link" callout.
- **Authz:** public.

### `GET /auth/oauth/:provider/start`

- **Kind:** HTTP route. `:provider ∈ { google, github }`.
- **Success response:** `302 Found`, `Location: <provider authorization URL with PKCE state>`.
- **Error modes:** `404` if provider not configured.
- **Authz:** public.

### `GET /auth/oauth/:provider/callback`

- **Kind:** HTTP route.
- **Input:** OAuth provider returns `code` + `state`; `state` is verified against the session-bound PKCE value.
- **Success response:** `302 Found`, `Location: /` (or `/auth/2fa/verify` if TOTP enabled). Sets the session cookie.
- **Error modes:**
  - `400` — state mismatch or missing code.
  - `502` — provider error; body identifies the provider only, never echoes the error message.
- **Authz:** public.

### `POST /auth/2fa/setup`

- **Kind:** HTTP route (XHR from the setup island).
- **Authz:** session required, must not yet have TOTP enabled.
- **Output:** `{ secret_otpauth_url: string, recovery_codes: string[] }` — recovery codes shown once, never returned again.

### `POST /auth/2fa/verify`

- **Kind:** HTTP route.
- **Input:** `{ code: string (6 digits) }` or `{ recovery_code: string }`.
- **Authz:** session present in "step-1" state.
- **Success:** `200 OK` and the session cookie is upgraded to "fully authenticated".

### `POST /auth/sign-out`

- **Kind:** HTTP route.
- **Authz:** session required (any state).
- **Success:** `200 OK`; session row deleted; cookie cleared.

---

## Data model

### New resources

Table names follow the Strav singular convention (`user`, not `users`). Email is stored as `varchar(254)` and lowercased before storage (the application enforces case-insensitivity; `citext` is unnecessary). Provider/state/kind enums are real PostgreSQL enums (cleaner than CHECK constraints).

| Resource         | Boundary | Columns & types                                                                                              | Indexes                  | FKs                                | Unique                              | Notes |
|------------------|----------|--------------------------------------------------------------------------------------------------------------|--------------------------|------------------------------------|-------------------------------------|-------|
| `user`           | platform | id bigserial, email varchar(254) NOT NULL, name varchar(120), avatar_idx int NOT NULL DEFAULT 0, last_seen_at timestamptz, created_at timestamptz, updated_at timestamptz, deleted_at timestamptz                  | idx_user_email (email) UNIQUE                            | —                                          | unique(email)                       | |
| `session`        | platform | id bigserial, user_id bigint NOT NULL, cookie_hash bytea NOT NULL, state session_state NOT NULL, expires_at timestamptz NOT NULL, ip inet, user_agent text, created_at timestamptz, updated_at timestamptz                                       | idx_session_user_id, idx_session_cookie_hash UNIQUE      | session.user_id → user.id (CASCADE)        | unique(cookie_hash)                 | |
| `oauth_identity` | platform | id bigserial, user_id bigint NOT NULL, provider oauth_identity_provider NOT NULL, provider_user_id varchar(255) NOT NULL, created_at timestamptz, updated_at timestamptz                                                                          | idx_oauth_identity_user_id                                | oauth_identity.user_id → user.id (CASCADE) | unique(provider, provider_user_id)  | |
| `magic_link`     | platform | id bigserial, email varchar(254) NOT NULL, token_hash bytea NOT NULL, expires_at timestamptz NOT NULL, consumed_at timestamptz, ip inet, created_at timestamptz                                                                                    | idx_magic_link_email, idx_magic_link_token_hash UNIQUE   | —                                          | unique(token_hash)                  | token_hash = SHA-256 of the random token |
| `totp_secret`    | platform | id bigserial, user_id bigint NOT NULL, secret_encrypted bytea NOT NULL `.sensitive()`, enabled boolean NOT NULL DEFAULT false, enabled_at timestamptz, created_at timestamptz, updated_at timestamptz                                              | idx_totp_secret_user_id                                   | totp_secret.user_id → user.id (CASCADE)    | unique(user_id) — 1:1 invariant     | secret_encrypted via app-level AES-GCM with key from APP_KEY |
| `recovery_code`  | platform | id bigserial, user_id bigint NOT NULL, code_hash bytea NOT NULL, used_at timestamptz, created_at timestamptz, updated_at timestamptz                                                                                                              | idx_recovery_code_user_id                                 | recovery_code.user_id → user.id (CASCADE)  | unique(user_id, code_hash)          | |
| `login_attempt`  | platform | id bigserial, email varchar(254), ip inet, kind login_attempt_kind NOT NULL, success boolean NOT NULL, created_at timestamptz                                                                                                                     | idx_login_attempt_email, idx_login_attempt_ip            | —                                          | —                                   | feeds rate-limit windows |

### Migration

- **Forward:** `bun strav generate:migration -m "001_auth"` then `bun strav migrate`.
- **Reverse:** forward-only; rollback drops the auth surface and is destructive — listed in the adapter's "AI must never run".
- **Deploy safety:** all-new tables; no online-rewrites; no lock risk.
- **All three integrity-critical UNIQUE constraints** are emitted natively by `@strav/database`'s schema DSL: `parents: [{ name: 'user', unique: true }]` on `totp_secret` for the 1:1 invariant, and schema-level `uniques: [...]` on `oauth_identity` (`provider`, `providerUserId`) and `recovery_code` (`user`, `codeHash`).

### v1 simplifications (deferred to a later slice if needed)

- **No composite or descending indexes.** Earlier drafts asked for `magic_link (email, created_at desc)` and `login_attempt (email, created_at desc)` / `(ip, created_at desc)`. At v1 scale (Discovery success criterion: 250-doc workspaces) the single-column indexes Strav generates are sufficient; if the planner ever surfaces a hot path that needs them, add via a new migration.

---

## Policy & invariants

- **Authz:**
  - `POST /auth/magic`, `GET /auth/magic/:token`, `GET /auth/oauth/:provider/start`, `GET /auth/oauth/:provider/callback` — public.
  - `POST /auth/2fa/setup`, `POST /auth/2fa/verify` — require an authenticated session, any state. The verify handler picks its behavior from `totp_secret.enabled` and `session.state`: setup-confirmation when `enabled=false` (flips to true), sign-in second factor when state is `step1` (promotes to `full`).
  - `POST /auth/sign-out` — requires any session.
- **Validation:**
  - `email` matches RFC 5322 and ≤ 254 characters; lowercased before storage.
  - `token` in `/auth/magic/:token` is exactly the URL-safe encoding of a 32-byte random; mismatched length is rejected at the route layer.
  - `code` in TOTP verify is six ASCII digits; `recovery_code` is the project's recovery-code format.
- **Business / domain rules:**
  - Magic-link expiry is 15 minutes from issue (decided here).
  - A magic link is consumed on first successful redemption (`consumed_at` set); subsequent attempts on the same token return 400 with "consumed".
  - OAuth verified email is the authoritative email; if a user already exists by that email, the OAuth identity is linked to that user; if not, a new user is created.
  - A user may have at most one OAuth identity per `(provider, user_id)` pair.
  - Recovery codes are single-use (`used_at` set on consumption).
- **State transitions:**
  - Session: `step1 → full` on TOTP success or on sign-in if user has no TOTP enabled.
  - Magic link: `pending → consumed` (one-way) or `pending → expired` (implicit by `expires_at`).
- **Boundary rules:**
  - All entities in this slice are **platform**-scoped; no `workspace_id` columns.
  - Tenant resources do not exist yet; this slice cannot accidentally violate RLS.
- **Cross-cutting invariants:**
  - Every login attempt writes a row to `login_attempt` regardless of outcome (used for rate-limit windows and the future audit log).
  - Tokens are stored as SHA-256 hashes only; the random part is delivered to the user via the magic link or cookie and never appears in logs.
  - Cookie value is high-entropy; only its SHA-256 (`cookie_hash`) is stored.

---

## Slice-specific NFR targets

- **Latency:** `POST /auth/magic` p95 < 150ms (excluding mail dispatch, which is async).
- **Throughput:** sustained 50 req/s for 60s without error on the magic-link endpoint.
- **Storage:** `magic_link` rows pruned by a daily job after `consumed_at` is older than 30 days or `expires_at` older than 30 days.
- **Data retention:** `login_attempt` rows pruned after 90 days.

---

## Dependencies

- **Upstream slices:** none (this is the foundation slice).
- **Framework features:** `@strav/auth` (sessions, magic links, TOTP); `@strav/social` (Google + GitHub OAuth); `@strav/http` (sessions middleware, route groups); `@strav/signal` (`mail` facade for magic-link send via `MailProvider`); `@strav/database` (migrations + ORM); `@strav/cli` (generators).
- **Third-party services:** Google OAuth, GitHub OAuth, an SMTP transport in production (configurable; dev uses `@strav/signal`'s log transport).

---

## Observability

- **Logs (structured JSON):**
  - `INFO auth.magic_request { email_hash, ip_hash, success, rate_limited }`.
  - `INFO auth.magic_consume { email_hash, success, reason? }`.
  - `INFO auth.oauth_callback { provider, success, error_code? }`.
  - `INFO auth.totp_verify { user_id_hash, success, attempts_in_window }`.
  - `INFO auth.signed_in { user_id_hash, method ∈ {magic, oauth_google, oauth_github} }`.
- **Metrics:**
  - Counter: `auth_attempts_total{kind, success}`.
  - Histogram: `auth_magic_consume_duration_seconds`.
  - Histogram: `auth_oauth_callback_duration_seconds{provider}`.
- **Alerts:** none in v1; metrics are surfaced for inspection.

---

## Test strategy

- Scenario 1 → `tests/auth/magic_link_request.test.ts`.
- Scenario 2 → `tests/auth/magic_link_consume.test.ts`.
- Scenario 3 → `tests/auth/magic_link_expired.test.ts`.
- Scenario 4 → `tests/auth/oauth_google.test.ts` (provider transport mocked at `@strav/social`).
- Scenario 5 → `tests/auth/oauth_github.test.ts`.
- Scenario 6 → `tests/auth/totp_setup.test.ts`.
- Scenario 7 → `tests/auth/totp_signin.test.ts`.
- Scenario 8 → `tests/auth/rate_limit.test.ts`.
- Scenario 9 → `tests/auth/sign_out.test.ts`.
- **Fixtures:** `users.factory.ts`, `magic-links.factory.ts`.
- **Known test limits:** OAuth provider HTTP is mocked at the `@strav/social` boundary; full end-to-end Google/GitHub test is out of scope for the build pipeline.

---

## Open questions

*(All resolved before signing; answers captured in *Policy & invariants* and confirmed at sign time. Listed here for audit only.)*

- [x] Confirm magic-link expiry of 15 minutes. *Confirmed by Liva.*
- [x] Confirm rate-limit window numbers. *Resolved: 5 magic-link requests per email per rolling 10-minute window. The IP cap (originally 20/10min) is dropped — per-email is the operative bound.*

---

## Signature

```
Signed by: Liva
Date: 2026-05-09
```

---

## Amendment log

### 2026-05-09 — Close open questions in record; drop per-IP magic-link cap
Changed: `Open questions` and `Interface contract › POST /auth/magic › Idempotency / rate limits`
From:
  - Open questions still listed two unticked boxes with `=>` answers below them, despite the section's *Must be empty at signing* note.
  - Rate-limit line read: "≤ 5 magic-link requests per email per rolling 10-minute window; ≤ 20 per IP per 10-minute window."
To:
  - Open questions both ticked `[x]`, with the resolutions inlined.
  - Rate-limit line keeps the per-email cap (5/10min) and drops the per-IP cap.
Why: Both questions were resolved at sign time (Liva's inline `=>` answers), but the document state didn't formalize that. Per-IP rate limit was originally hedge; user confirmed per-email is sufficient — the IP cap added a noisy false-positive risk for shared NAT environments without buying real spam protection beyond what per-email already gives.
By: Liva

### 2026-05-09 — Reconcile data model with `bun strav generate:migration` reality (Build-T1 Checkpoint 1)
Changed: `Data model › New resources` and `Cross-cutting invariants` and `NFR targets` and added `### Migration › Hand-edited block` and `### v1 simplifications`.
From:
  - Plural table names (`users`, `sessions`, `oauth_identities`, `magic_links`, `totp_secrets`, `recovery_codes`, `login_attempts`).
  - `email citext NOT NULL`; CHECK-constraint enums (`state IN ('step1','full')`, `provider IN ('google','github')`, `kind IN (…)`).
  - `totp_secrets`: `user_id bigint PRIMARY KEY`.
  - Composite + descending indexes specified for `magic_links` and `login_attempts`.
  - No mention of a hand-edited UNIQUE block in the migration.
To:
  - Singular table names (`user`, `session`, `oauth_identity`, `magic_link`, `totp_secret`, `recovery_code`, `login_attempt`) — Strav convention; `defineSchema('user', …)` produces table `user`.
  - `email varchar(254)`; PostgreSQL enums named `oauth_identity_provider`, `session_state`, `login_attempt_kind` instead of CHECK constraints. Application lowercases email before storage; `citext` is unnecessary.
  - `totp_secret`: `id bigserial primary key`, plus an explicit `unique(user_id)` constraint enforcing the 1:1 invariant.
  - Composite + descending indexes dropped at v1; single-column indexes only. Documented in *v1 simplifications*.
  - New paragraph in *Migration* describes the hand-edited UNIQUE block and links the framework-issue ticket.
Why: `bun strav generate:migration` produces table/column/enum shapes that are framework-canonical. Aligning the Tech Spec to what generates removes hand-edits from the data path and shrinks the surface where Build-T1 must work around the framework. Composite/descending indexes are deferred to a later slice if a hot path emerges. v1 scale (50 small workspaces / 5000 docs/workspace) does not need them.
By: Liva

### 2026-05-09 — Defer `.strav` auth view + global `tokens.css` to slice 003
Changed: slice 001 effective scope (no Tech Spec section deletion; clarification only)
From:    Slice 001 DoD listed two auth-UI items: "(9) `.strav` view at `resources/views/auth/index.strav` rendering the auth split layout" and "(10) Tokens (per ADR-0003) loaded by the auth view's root template".
To:      Both items move to slice 003 (Reader — editorial layout). Slice 003 is the canonical owner of `resources/css/tokens.css` (it's the first reading surface that consumes the global token sheet) and of the auth view's editorial layout (which shares the same typography + density + accent tokens). Slice 001 ships the auth *contract* — endpoints, policy, tests, mail dispatch — without an HTML rendering layer; the auth route currently returns JSON.
Why:    Surfaced during Build-T1 closure DoD audit. The HTML view would force slice 001 to invent the global `tokens.css` and the `.strav` template scaffolding ahead of the slice that genuinely owns them. Slice 003's editorial reading surface is where the typography, density, and accent tokens get their first integration test; reusing that foundation for the auth view is cheaper than duplicating it. Slice 001's BDD scenarios already pass without the HTML layer (they assert HTTP behavior). The deferral is recorded in slice 003's backlog notes so it isn't lost.
By:      Liva

### 2026-05-09 — Relax `/auth/2fa/verify` authz to "session required, any state"
Changed: `Policy & invariants › Authz`
From:    "`POST /auth/2fa/setup`, `POST /auth/2fa/verify` — require an authenticated session (state may be `step1`)."
To:      "`POST /auth/2fa/setup`, `POST /auth/2fa/verify` — require an authenticated session, any state. The verify handler picks its behavior from `totp_secret.enabled` and `session.state`: setup-confirmation when `enabled=false` (flips to true), sign-in second factor when state is `step1` (promotes to `full`)."
Why:    Surfaced during Build-T1 Scenario 6 implementation. The original wording read as "session present in step-1 state", which conflicts with the Scenario-6 happy path: the user is signed in (state=`full`) when they go to `/auth/2fa/setup` and confirm the QR via `/auth/2fa/verify`. A strict `state==='step1'` policy would 403 that flow. The endpoint legitimately serves both setup-confirmation (`full`/`enabled=false`) and sign-in second factor (`step1`/`enabled=true`); pushing the state-vs-enabled decision into the handler is simpler than splitting endpoints. `canSetupTotp` is unaffected (still gated on `enabled=false`).
By:     Liva

### 2026-05-09 — Adopt native composite-unique DSL; drop hand-edit + framework ticket
Changed: `Migration › Hand-edited block` paragraph; the prior amendment's wording about hand-edits.
From:
  - Migration paragraph claimed three UNIQUE constraints were added by hand-edit because the schema DSL could not express them, and pointed at `docs/notes/strav-parent-fk-uniqueness.md`.
To:
  - All three UNIQUE constraints are emitted natively: `parents: [{ name: 'user', unique: true }]` on `totp_secret`, and schema-level `uniques: [...]` on `oauth_identity` and `recovery_code`. The framework-issue ticket file has been deleted; the migration is fully generator-clean (no hand-edits).
Why: `@strav/database` shipped the missing DSL surface (per [docs/database/schema.md § Composite UNIQUE](https://github.com/stravigor/strav/blob/master/docs/database/schema.md#composite-unique-across-multiple-columns) and § Parent FK column). Regenerating the migration produces the same constraints the hand-edit was adding, so the workaround is obsolete and removable.
By: Liva

```
slice_id:      001-auth-magic-link-and-oauth
status:        Draft
date:          2026-05-09
signed by:
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
- **Idempotency / rate limits:** ≤ 5 magic-link requests per email per rolling 10-minute window; ≤ 20 per IP per 10-minute window.

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

| Resource         | Boundary | Columns & types                                                                                              | Indexes                                  | FKs                          | Unique                              | Notes |
|------------------|----------|--------------------------------------------------------------------------------------------------------------|------------------------------------------|------------------------------|-------------------------------------|-------|
| `users`          | platform | id bigserial, email citext NOT NULL, name text, avatar_idx int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL, last_seen_at timestamptz                                                                       | idx_users_email (email)                  | —                            | unique(email)                       | |
| `sessions`       | platform | id bigserial, user_id bigint NOT NULL, cookie_hash bytea NOT NULL, state text NOT NULL CHECK (state IN ('step1','full')), expires_at timestamptz NOT NULL, ip inet, user_agent text, created_at timestamptz NOT NULL | idx_sessions_user (user_id), idx_sessions_cookie (cookie_hash) | sessions.user_id → users.id   | unique(cookie_hash)                 | |
| `oauth_identities` | platform | id bigserial, user_id bigint NOT NULL, provider text NOT NULL CHECK (provider IN ('google','github')), provider_user_id text NOT NULL, created_at timestamptz NOT NULL                                              | idx_oauth_user (user_id)                 | oauth_identities.user_id → users.id | unique(provider, provider_user_id) | |
| `magic_links`    | platform | id bigserial, email citext NOT NULL, token_hash bytea NOT NULL, expires_at timestamptz NOT NULL, consumed_at timestamptz, ip inet, created_at timestamptz NOT NULL                                                  | idx_magic_email (email, created_at desc) | —                            | unique(token_hash)                  | token_hash = SHA-256 of the random token |
| `totp_secrets`   | platform | user_id bigint PRIMARY KEY, secret_encrypted bytea NOT NULL, enabled boolean NOT NULL DEFAULT false, enabled_at timestamptz                                                                                          | —                                        | totp_secrets.user_id → users.id | —                                  | secret_encrypted via app-level AES-GCM with key from env |
| `recovery_codes` | platform | id bigserial, user_id bigint NOT NULL, code_hash bytea NOT NULL, used_at timestamptz                                                                                                                                | idx_recovery_user (user_id)              | recovery_codes.user_id → users.id | unique(user_id, code_hash)        | |
| `login_attempts` | platform | id bigserial, email citext, ip inet, kind text NOT NULL CHECK (kind IN ('magic_request','magic_consume','oauth','totp')), success boolean NOT NULL, created_at timestamptz NOT NULL                                | idx_attempts_email (email, created_at desc), idx_attempts_ip (ip, created_at desc) | — | — | feeds rate-limit windows |

### Migration

- **Forward:** `bun strav make:migration --from-schema 001_auth` then `bun strav db:migrate`.
- **Reverse:** forward-only; rollback drops the auth surface and is destructive — listed in the adapter's "AI must never run".
- **Deploy safety:** all-new tables; no online-rewrites; no lock risk.

---

## Policy & invariants

- **Authz:**
  - `POST /auth/magic`, `GET /auth/magic/:token`, `GET /auth/oauth/:provider/start`, `GET /auth/oauth/:provider/callback` — public.
  - `POST /auth/2fa/setup`, `POST /auth/2fa/verify` — require an authenticated session (state may be `step1`).
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
  - Every login attempt writes a row to `login_attempts` regardless of outcome (used for rate-limit windows and the future audit log).
  - Tokens are stored as SHA-256 hashes only; the random part is delivered to the user via the magic link or cookie and never appears in logs.
  - Cookie value is high-entropy; only its SHA-256 (`cookie_hash`) is stored.

---

## Slice-specific NFR targets

- **Latency:** `POST /auth/magic` p95 < 150ms (excluding mail dispatch, which is async).
- **Throughput:** sustained 50 req/s for 60s without error on the magic-link endpoint.
- **Storage:** `magic_links` rows pruned by a daily job after `consumed_at` is older than 30 days or `expires_at` older than 30 days.
- **Data retention:** `login_attempts` rows pruned after 90 days.

---

## Dependencies

- **Upstream slices:** none (this is the foundation slice).
- **Framework features:** `@strav/auth` (sessions, magic links, TOTP); `@strav/social` (Google + GitHub OAuth); `@strav/http` (sessions middleware, mailer for magic-link send); `@strav/database` (migrations + ORM); `@strav/cli` (generators).
- **Third-party services:** Google OAuth, GitHub OAuth, an SMTP transport in production (configurable; dev uses log mailer).

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

*(Must be empty at signing.)*

- [ ] Confirm magic-link expiry of 15 minutes.
- [ ] Confirm rate-limit window numbers (5 per email per 10 min; 20 per IP per 10 min).

---

## Signature

```
Signed by:
Date:
```

---

## Amendment log

*(Append-only.)*

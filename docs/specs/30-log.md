# Log — musagete-kb

Integrate-phase entries. One entry per shipped slice,
plus release entries when a version is tagged.

Append-only. Read top-to-bottom for status; read each entry's
"what surprised us" section for retro content.

---

## Slice 001 — Auth (magic link + Google/GitHub OAuth + TOTP)

- **Built in:** `Build-T1` (2026-05-09) — preceded by `Build-T0` setup precursor.
- **Shipped:** 2026-05-09
- **Commit:** [`1bf1915`](https://github.com/stravigor/musagete/commit/1bf1915) — *Build slice 001: auth surface (magic link + Google/GitHub OAuth + TOTP)*
- **Turn chain:** `Planning` (signed at slice ready / Tech Spec sign) → `Build-T0` → `Build-T1` (with redo loops on planning/harness/practice causes) → `Integrate-T1`

### What was built

Auth contract for the showcase. Slice 001 ships endpoints + storage + tests; the editorial HTML for the auth screen is owned by slice 003 per the deferral amendment.

- **Magic-link sign-in.** `POST /auth/magic` issues a 32-byte URL-safe token, stores its SHA-256 in `magic_link`, dispatches the email through `@strav/signal`'s `mail` facade. `GET /auth/magic/:token` consumes atomically (TOCTOU-guarded), find-or-creates the user, opens a session, sets the `musagete_session` cookie, and redirects.
- **OAuth sign-in for Google + GitHub.** `GET /auth/oauth/:provider/{start,callback}` — `@strav/social` (`SocialProvider` + per-provider classes) handles the OAuth dance with `@strav/http`'s `session()` middleware binding CSRF state. Verified email is the authoritative key for find-or-create + `oauth_identity` upsert.
- **TOTP 2FA.** `POST /auth/2fa/setup` provisions the secret (encrypted via `EncryptionManager`) and 10 hashed recovery codes, returns the otpauth URL. `POST /auth/2fa/verify` accepts a 6-digit code or a recovery code; the same endpoint covers both *setup confirmation* (flips `enabled=true`) and *sign-in second factor* (promotes session `step1 → full`).
- **Sign-out.** `POST /auth/sign-out` deletes the session row and clears the cookie.
- **Rate limit.** ≤ 5 magic-link requests per email per rolling 10-minute window, fed by `login_attempt` rows the slice writes for every attempt regardless of outcome.
- **Schema layer.** Seven platform tables (`user`, `session`, `oauth_identity`, `magic_link`, `totp_secret`, `recovery_code`, `login_attempt`) with three PG enums, CASCADE FKs to `user`, single + composite UNIQUEs emitted natively by `@strav/database`'s `parents:[{name,unique}]` and schema-level `uniques:` syntax — both shipped upstream during this slice's Build phase. Migration `1778313714015` is the single bundle, no hand-edits.

### Acceptance criteria → verification

All 9 BDD scenarios from `spec/slices/001-auth-magic-link-and-oauth.md` mapped to a green test:

- [x] Scenario 1: First-time user signs in with a magic link → `tests/auth/magic_link_request.test.ts` (also asserts the email dispatch via memory `MailTransport`).
- [x] Scenario 2: User redeems a valid magic link → `tests/auth/magic_link_consume.test.ts`.
- [x] Scenario 3: An expired magic link is rejected → `tests/auth/magic_link_expired.test.ts`.
- [x] Scenario 4: User signs in with Google OAuth → `tests/auth/oauth_google.test.ts` (`GoogleProvider.prototype.user` mocked).
- [x] Scenario 5: User signs in with GitHub OAuth → `tests/auth/oauth_github.test.ts`.
- [x] Scenario 6: User enables TOTP 2FA (setup + first verify) → `tests/auth/totp_setup.test.ts`.
- [x] Scenario 7: User signs in with TOTP enabled (valid + invalid code) → `tests/auth/totp_signin.test.ts`.
- [x] Scenario 8: Rate limit on magic-link requests → `tests/auth/rate_limit.test.ts`.
- [x] Scenario 9: Sign-out destroys the session → `tests/auth/sign_out.test.ts`.

Test surface at ship: **13 pass / 0 fail / 78 expect() calls / 10 files**. Zero project-local TypeScript errors.

### What surprised us

**What took longer than expected, and why?** The OAuth pair (Scenarios 4 + 5) — not because of the OAuth dance itself, but because `@strav/social` requires `@strav/http`'s `SessionProvider` for state binding (non-optional after a security fix). That meant registering Strav's session machinery alongside this project's own `session` table, renaming our cookie to `musagete_session` to avoid collision with framework-default `strav_session`, and accepting that two session schemes coexist (Strav's for OAuth state, ours for app auth). Worth it — the alternative of subclassing `AbstractProvider` to plug in custom state would have doubled the code volume.

**What was easier than expected, and why?** The schema layer. Mid-slice, `@strav/database` shipped the missing composite-UNIQUE DSL features (`parents: [{ name, unique }]` and schema-level `uniques: […]`); the framework-issue ticket I'd written and the hand-edited migration both got removed in a single regenerate. From hand-edited workaround to fully generator-clean migration in one Turn redo.

**What did we learn that the Discovery / Design / slice file didn't capture?**

- **Project-wide conventions surface during Build, not Planning.** Two of them came up here: subpath imports (`#policies/auth_policy` rather than `../../policies/auth_policy`) and the cookie-hash convention (writer ↔ reader must agree on whether they hash raw bytes or the encoded string). Subpath imports got promoted to a Design `V*` (`V8`); the cookie-hash helper was centralized in `session_service.ts` as `hashCookieValue()`. **Pattern for future slices:** any project-wide invariant discovered during Build that survives past one slice belongs in Design's Conventions section, cited from each Tech Spec by `V-ID`.
- **The slice DoD is a real gate, not boilerplate.** The first close attempt missed three unfilled DoD items (mail dispatch, auth `.strav` view, global tokens.css). The second close was honest: mail dispatch landed in this slice; auth view + tokens.css formally deferred to slice 003 via Tech Spec amendment. The deferral pattern is reusable: when a slice's DoD strays into territory that another slice owns more naturally, amend the Tech Spec and update the inheriting slice's backlog row.
- **Tests force precision.** The `canVerifyTotp` policy ("session in step1") was wrong as written — the same endpoint serves both setup-confirmation (`full`) and sign-in second factor (`step1`). Surfaced when the Scenario 6 test needed verify with `state='full'`. Tech Spec amended; policy relaxed to "session required, any state"; handler branches at runtime. Without the test, this would have shipped as a 403 bug.

### Harness signals

- **`redo` count:** 5 across Build-T1.
  - Causes: `planning` (×3 — Tech Spec singularization, totp_secret PK, verify-policy state-strict), `harness` (×1 — `@strav/database` shipped composite-UNIQUE DSL upstream mid-slice), `practice` (×1 — cookie-hash convention bug between writer and reader).
  - All resolved within the same Turn; no escalations to upstream phases.
- **`escalate` count:** 0.
- **Checkpoint halts:** 3 (Build-T1's three AGON-mandated checkpoints) + 1 (Build-T0's single ack gate) + 4 inner-loop halts (one per BDD scenario pair).
- **Notes:** Build-T1 was opened too eagerly with the full slice scope — paused immediately at its `ai_of_human` gate; setup work carved into Build-T0 as a predecessor. Pattern worth remembering: Build Turns that bundle setup and feature work tend to surface their preconditions later than they should.

### Follow-ups / backlog deltas

- **Slice 003 inherits two scope items** from this slice: `resources/css/tokens.css` and the auth `.strav` view + AuthForm Vue island. Backlog row 3 records the inheritance.
- **Mail templating.** Slice 001 dispatches plain HTML/text bodies for the magic-link email. A follow-up Micro-Turn (or a future polishing slice) could move to `mail.to(...).template('auth.magic_link', { url })` once the editorial mail templates exist.
- **OAuth provider HTTP** is mocked in tests at the `@strav/social` boundary per Tech Spec § Test strategy — full end-to-end Google / GitHub flow is out of scope for the build pipeline. If we ever add a manual smoke-test ceremony, this is where it goes.
- **No new Patterns promoted.** Three candidate patterns are watch-listed in `spec/20-backlog.md`: AI tool-restricted agent (slice 005), Vue island with server-streamed AI calls (slice 004), RLS-aware service (slice 002) — slice 001 is platform-only so it didn't surface a tenancy pattern.
- **No ADR amendments triggered.** ADR-0001..0007 still describe what's being built; the spec deltas all landed as Design / Tech-Spec / adapter amendments.

### Signed

- Integrate closed by: Liva — 2026-05-09

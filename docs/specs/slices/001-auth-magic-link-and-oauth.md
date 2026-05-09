```yaml
slice_id:        001
status:          shipped
owner_turn:      Build-T1
resource_type:   Entity
tenancy:         platform
runtime:         web
strav_packages:  [@strav/auth, @strav/social, @strav/http, @strav/signal, @strav/database, @strav/cli]
```

---

## Story

As a **developer evaluating Strav** (audience-as-user, per Discovery `Implicit audience`)
I want to **sign in to Musagete with a magic link, Google OAuth, or GitHub OAuth, and optionally enable TOTP 2FA**
so that **I can reach a workspace and start exercising the rest of the showcase**.

---

## Context

This is the foundation slice. It bootstraps the full Strav schema → migration → model → controller → route → BDD test pipeline (Discovery `G1`) on the auth surface, and delivers the Strav-native-only auth contract (`G7`) as a single coherent unit. No tenant data exists yet; every entity in this slice is platform-scoped.

Links:

- Discovery: [`../00-discovery.md`](../00-discovery.md) § Showcase Subject, Showcase goals — addresses `G1`, `G7`; non-goal `P5` is honored.
- Design: [`../10-design.md`](../10-design.md) § In scope for v1 — instantiates `C1`.
- Tech Spec: [`./001-auth-magic-link-and-oauth.tech.md`](./001-auth-magic-link-and-oauth.tech.md).
- Relevant ADRs: [ADR-0001](../adr/0001-architecture-strav-islands-over-spa.md), [ADR-0002](../adr/0002-auth-strategy-strav-native-only.md), [ADR-0003](../adr/0003-styling-tokens-css-modules.md).
- Depends on slices: none.

---

## BDD Scenarios

```gherkin
Scenario 1: First-time user signs in with a magic link
  Given there is no existing user with email "ada@example.com"
  When the user submits the email "ada@example.com" on the auth screen and chooses "Email me a link"
  Then a magic-link record is created with a 15-minute expiry
    And exactly one email is dispatched to "ada@example.com" containing a one-time link
    And the response renders the "magic link sent" callout

Scenario 2: User redeems a valid magic link
  Given a valid, unconsumed magic-link token "tok_abc"
  When the user opens "/auth/magic/tok_abc"
  Then a User row is created (or fetched) with email "ada@example.com"
    And a Session row is created and a session cookie is set
    And the response redirects to "/" (which redirects to the user's last-opened doc, or to "/welcome" for new users)

Scenario 3: An expired magic link is rejected
  Given a magic-link token "tok_xyz" whose expires_at is in the past
  When the user opens "/auth/magic/tok_xyz"
  Then no User or Session row is created
    And the response renders an "expired link" message with a "request a new link" form

Scenario 4: User signs in with Google OAuth
  Given the OAuth Google provider is configured
  When the user clicks "Continue with Google" and completes the provider flow
  Then a User row exists with the verified Google email
    And an OAuthIdentity row links (user_id, "google", provider_user_id)
    And a Session row is created and a session cookie is set
    And the response redirects to "/"

Scenario 5: User signs in with GitHub OAuth
  Given the OAuth GitHub provider is configured
  When the user clicks "Continue with GitHub" and completes the provider flow
  Then a User row exists with the verified GitHub email
    And an OAuthIdentity row links (user_id, "github", provider_user_id)
    And a Session row is created and a session cookie is set

Scenario 6: User enables TOTP 2FA
  Given the user is signed in with no TOTP secret on file
  When the user opens "/auth/2fa/setup", scans the QR, and submits a valid 6-digit code
  Then the User row's totp_secret is stored encrypted-at-rest
    And the User row's totp_enabled flag is true
    And ten recovery codes are generated, hashed, and stored

Scenario 7: User signs in with TOTP enabled
  Given a user with totp_enabled = true
  When the user completes step-1 auth (magic link or OAuth) and is prompted for a TOTP code
  Then the session cookie is not yet set as "fully authenticated"
    And submitting a valid 6-digit TOTP code marks the session "fully authenticated"
    And submitting an invalid code returns to the prompt with one attempt counted

Scenario 8: Rate limit on magic-link requests
  Given five magic-link requests for "ada@example.com" within the last 10 minutes
  When a sixth request is submitted within the same window
  Then no new magic-link record is created
    And the response is 429 with a body indicating retry-after

Scenario 9: Sign-out destroys the session
  Given a signed-in user with a session cookie
  When the user POSTs to "/auth/sign-out"
  Then the Session row is deleted
    And the response clears the session cookie
    And subsequent requests with the cleared cookie are anonymous
```

---

## Definition of Done

- [x] Implementation matches the signed Tech Spec (interface shapes, data model, policy & invariants, NFR numbers).
- [x] Schemas committed (singular per Strav convention; see Tech Spec amendment 2026-05-09): `user`, `session`, `oauth_identity`, `magic_link`, `totp_secret`, `recovery_code`, `login_attempt`.
- [x] Migration generated via `bun strav generate:migration -m "001_auth"`, reviewed, and applied locally via `bun strav migrate` (batch 1, directory `1778313714015`).
- [x] `@strav/social` configured for `google` and `github` providers; environment variables documented in `.env.example` and the README quick-start.
- [x] Magic-link sender wired through `@strav/signal`'s `mail` facade (`MailProvider` registered in `start/providers.ts`); dev uses the log transport, prod uses SMTP (or any provider transport supported by `@strav/signal/mail`). Asserted by Scenario 1's memory-transport capture.
- [x] TOTP setup uses `@strav/auth`'s TOTP primitive (RFC 6238).
- [x] Every BDD scenario above has a corresponding green test in `tests/auth/`.
- [x] Rate limiting implemented and asserted by Scenario 8.
- [x] Routes registered in `routes/auth.ts`. **`.strav` view + AuthForm Vue island deferred to slice 003** — see Tech Spec amendment 2026-05-09. Slice 001 ships the auth *contract* (endpoints + policy + tests + mail dispatch); slice 003 owns the editorial reading surface that the auth view shares.
- [x] Tokens (per [ADR-0003](../adr/0003-styling-tokens-css-modules.md)) — **`resources/css/tokens.css` deferred to slice 003** (same amendment). Slice 003 is the first surface that consumes the global token sheet.
- [x] Slice file updated: `status: built`, `owner_turn: Build-T1`.
- [x] `bun test` exits 0 globally.
- [ ] `spec/30-log.md` has an Integrate entry after ship. *(Pending Integrate Turn.)*

---

## Turn chain (index)

*(Append entries here as Turns close. Order: logical sequence — Build-T0 is a setup predecessor carved out after Build-T1 was paused.)*

- `Build-T0` — ai — *bootstrap deps, providers, config, dirs* — `advance` — 2026-05-09 — [full](./001-auth-magic-link-and-oauth.turns.md#build-t0)
- `Build-T1` — ai — *implement signed slice 001 auth surface end-to-end* — `advance` (9/9 scenarios green) — 2026-05-09 — [full](./001-auth-magic-link-and-oauth.turns.md#build-t1)
- `Integrate-T1` — shared — *commit + push + log entry + status flip* — `advance` — 2026-05-09 — [full](./001-auth-magic-link-and-oauth.turns.md#integrate-t1)

---

## Built / Shipped status

- **Built** (Build Turn closed with `decision: advance`): 2026-05-09 in Build-T1 (after Build-T0 setup precursor).
- **Shipped** (Integrate Turn closed): 2026-05-09 in Integrate-T1.
- **Merged commit(s):** [`1bf1915`](https://github.com/stravigor/musagete/commit/1bf1915) — *Build slice 001: auth surface (magic link + Google/GitHub OAuth + TOTP)*
- **Log entry:** [`spec/30-log.md` § Slice 001](../30-log.md#slice-001--auth-magic-link--googlegithub-oauth--totp)

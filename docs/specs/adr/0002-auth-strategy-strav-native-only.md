# ADR-0002 — Auth: Strav-native only (magic link + OAuth + TOTP)

Status:       Accepted
Relationship:
Date:         2026-05-09
Decided by:   Liva

---

## Context

Outline (the Reference) ships an auth surface comprising email/password, magic link, OAuth (Google, GitHub, GitLab, Slack, …), and SAML/SCIM in the enterprise tier — captured in `P5`. Strav, however, ships only what `@strav/auth` and `@strav/social` natively support: magic links, TOTP 2FA, sessions, signed opaque tokens, and OAuth via `@strav/social` for Google, GitHub, Discord, Facebook, LinkedIn. There is no SAML, no SCIM, no GitLab provider.

Discovery makes this explicit: `G7` requires "Strav-native only" auth, and `P5` is captured as a non-goal. The decision now is what Musagete's actual auth surface is in v1.

---

## Decision

Auth in v1 is limited to **magic link (default for new users), Google OAuth, GitHub OAuth, and TOTP 2FA**, all via `@strav/auth` and `@strav/social`. Sessions are managed by `@strav/http` session middleware with database-backed cookies. No passwords. No SAML, SCIM, GitLab, or passkeys.

---

## Tradeoffs

**What we gain:**
- Zero non-Strav identity code; the showcase honors its Subject (`G7`).
- A small auth surface that ships and tests cleanly in one slice.
- Magic link as primary keeps onboarding friction low and removes password storage entirely.

**What we give up:**
- Enterprise-tier auth (SAML/SCIM) — buyers expecting it must wait for a v2 Strav primitive or a third-party adapter slice we don't yet plan.
- GitLab users see Google + GitHub only.
- No password-based legacy login path.

**Why the exchange is worth it:**
Strav doesn't ship SAML/SCIM today. Implementing them outside the framework would smuggle a dependency into a *framework reference app* — the most expensive shape of decision-debt.

---

## Alternatives considered

### Option A — Implement SAML/SCIM via a third-party library (e.g. `samlify`)
- **Pros:** Matches Outline parity.
- **Cons:** Adds an external auth layer the framework doesn't own; testing surface large; contradicts `G7`.
- **Why rejected:** violates the "Strav-native only" Discovery goal.

### Option B — Drop OAuth entirely; use magic link + TOTP only
- **Pros:** Smallest possible surface; everything magic-linkable.
- **Cons:** Reduces showcase value of `@strav/social`; users with no email-app ergonomics suffer.
- **Why rejected:** under-uses an installed Strav package.

### Option C — Magic link + Google + GitHub OAuth + TOTP (chosen)
- **Pros:** Exercises `@strav/auth` and `@strav/social`; covers the dominant developer-tool auth shapes; matches what Strav natively supports.
- **Cons:** No GitLab; no enterprise SSO.
- **Chosen because:** maximal coverage of Strav's native auth without smuggling non-Strav code.

---

## Consequences

- **Positive:** Slice 001 implements the entire auth surface in one cohesive Tech Spec; rate-limiting and lockout policies live in `app/services/auth/` only.
- **Negative:** Enterprise customers will ask for SAML; the answer in v1 is "filed against v2; the showcase exists to demonstrate Strav, not to ship enterprise SSO."
- **Neutral / follow-ups:** When `@strav/social` adds GitLab, a small amendment to slice 001's Tech Spec adds the button; no new ADR is needed.

---

## Verification hooks

- [ ] No `samlify`, `passport-saml`, or similar package in `package.json`.
- [ ] Auth route group exposes exactly: magic-link request, magic-link verify, OAuth start (Google, GitHub), OAuth callback, TOTP setup, TOTP verify, sign-out.
- [ ] No `password_hash` column on `users`.

---

## Signature

```
Decided by: Liva
Date: 2026-05-09
```

---

## Amendment log

*(Append-only.)*

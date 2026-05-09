import { allow, deny, type PolicyResult } from '@strav/http'

/**
 * Authorization for the slice-001 auth surface.
 *
 * Encodes the rules in `docs/specs/slices/001-auth-magic-link-and-oauth.tech.md`
 * § Policy & invariants › Authz, exactly as written. Every method below is
 * consumed by `@strav/http`'s `authorize(policy, methodName, …)` middleware
 * factory: it expects each method to return a `PolicyResult` (use `allow()`
 * for permitted, `deny(status, reason)` otherwise). Missing session yields
 * 401 from `authorize()` itself before the policy method is called.
 *
 * Public endpoints (`/auth/magic`, `/auth/magic/:token`, OAuth start +
 * callback) do NOT use `authorize()` and are therefore not represented
 * here — they are reachable without a session by design.
 */

export type CurrentUser = {
  id: number
  email: string
  /** Snapshot of `session.state` from the request's session row. */
  sessionState: 'step1' | 'full'
  /** Snapshot of `totp_secret.enabled` for this user (false if no row). */
  totpEnabled: boolean
}

export const authPolicy: Record<string, (actor: CurrentUser) => PolicyResult> = {
  /**
   * `POST /auth/2fa/setup` — session required, must not yet have TOTP enabled.
   * Once enabled, setup is forbidden (use a separate "rotate" path in a
   * future slice if/when needed).
   */
  canSetupTotp(actor: CurrentUser): PolicyResult {
    if (!actor) return deny(401, 'session_required')
    if (actor.totpEnabled) return deny(403, 'totp_already_enabled')
    return allow()
  },

  /**
   * `POST /auth/2fa/verify` — session required, any state.
   *
   * The endpoint serves two flows:
   *   - **Setup confirmation.** Session is `full`, `totp_secret.enabled=false`;
   *     a valid code flips `enabled` to `true` (no session change).
   *   - **Sign-in second factor.** Session is `step1`, `totp_secret.enabled=true`;
   *     a valid code promotes the session to `full`.
   *
   * The handler picks the behavior based on the `enabled` flag and current
   * session state — the policy just gates "is this a real authenticated
   * caller". (See Tech Spec amendment 2026-05-09 for the relax.)
   */
  canVerifyTotp(actor: CurrentUser): PolicyResult {
    if (!actor) return deny(401, 'session_required')
    return allow()
  },

  /**
   * `POST /auth/sign-out` — any session (step1 or full) is allowed to
   * destroy itself.
   */
  canSignOut(actor: CurrentUser): PolicyResult {
    if (!actor) return deny(401, 'session_required')
    return allow()
  },
}

export default authPolicy

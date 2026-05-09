import type { Context } from '@strav/http'
import { validate, required, string, regex } from '@strav/http'
import type { CurrentUser } from '#policies/auth_policy'
import { setupTotp, verifyTotp } from '#services/auth/totp_service'
import { promoteToFull, SESSION_COOKIE_NAME } from '#services/auth/session_service'

/**
 * Slice 001 — TOTP setup + verification.
 *
 * Routes:
 *   POST /auth/2fa/setup    → setup()    (authPolicy.canSetupTotp)
 *   POST /auth/2fa/verify   → verify()   (authPolicy.canVerifyTotp)
 */
export default class TotpController {
  /**
   * `POST /auth/2fa/setup`
   * Returns the otpauth URL for QR rendering and the 10 plaintext recovery
   * codes. Both are returned exactly once; the recovery codes never appear
   * in any subsequent response.
   */
  async setup(ctx: Context) {
    const user = ctx.get('user') as CurrentUser
    const result = await setupTotp(user.id, user.email)
    return ctx.json({
      secret_otpauth_url: result.secretOtpauthUrl,
      recovery_codes: result.recoveryCodes,
    })
  }

  /**
   * `POST /auth/2fa/verify`
   * Body: `{ code: string }` (6 ASCII digits) or `{ recovery_code: string }`.
   * 200 on success; promotes the session from `step1` to `full`.
   */
  async verify(ctx: Context) {
    const body = await ctx.body() as Record<string, unknown>

    const useRecovery = typeof body['recovery_code'] === 'string'
    const { data, errors } = useRecovery
      ? validate(body, { recovery_code: [required(), string()] })
      : validate(body, { code: [required(), string(), regex(/^\d{6}$/)] })

    if (errors) {
      return ctx.json({ error: 'invalid_code' }, 400)
    }

    const user = ctx.get('user') as CurrentUser
    const submitted = useRecovery ? (data.recovery_code as string) : (data.code as string)
    const result = await verifyTotp(user.id, submitted)

    if (result.kind !== 'verified' && result.kind !== 'recovery_used') {
      return ctx.json({ error: 'invalid_code' }, 400)
    }

    const cookie = ctx.cookie(SESSION_COOKIE_NAME)
    if (cookie) await promoteToFull(cookie)
    return ctx.json({ status: 'verified' })
  }
}

import type { Context } from '@strav/http'

/**
 * Slice 002 Build-T2 — auth view.
 *
 * Rescinds slice 001's "auth UI deferred to slice 003" Tech Spec amendment
 * (the deferral was the original sin per the method-feedback note).
 * Renders `auth/sign_in.strav` which mounts the `AuthForm` Vue island.
 *
 * Public route — no `currentUser` middleware needed; if the user IS
 * already signed in, the controller could redirect to `/`, but for
 * simplicity we just render the form and let the user submit again.
 */
export default class AuthViewController {
  async signIn(ctx: Context) {
    return ctx.view('auth/sign_in', {})
  }
}

import { router, authorize, session } from '@strav/http'
import { currentUser } from '#middleware/current_user'
import authPolicy from '#policies/auth_policy'
import MagicLinkController from '#controllers/magic_link_controller'
import OAuthController from '#controllers/oauth_controller'
import TotpController from '#controllers/totp_controller'
import SessionController from '#controllers/session_controller'

/**
 * Slice 001 — auth route registrations.
 *
 * Mounted as a side-effect import from `start/routes.ts`. Eight endpoints,
 * grouped under `/auth`. Public endpoints sit in the outer group; gated
 * endpoints sit in nested groups whose `middleware:` chains (`currentUser`
 * + the matching `authorize(policy, …)` call) Strav stacks before the
 * route handler runs. `RouteRef` has no per-route `.middleware()` setter,
 * so per-route gating is expressed as a one-route nested group.
 */

router.group({ prefix: '/auth' }, () => {
  // --- Public --------------------------------------------------------------
  router.post('/magic',                                [MagicLinkController, 'request'])
  router.get('/magic/:token',                          [MagicLinkController, 'redeem'])

  // OAuth routes need `@strav/http`'s session() middleware so `@strav/social`
  // can stash the CSRF state during redirect() and verify it on user().
  router.group({ prefix: '/oauth/:provider', middleware: [session()] }, () => {
    router.get('/start',    [OAuthController, 'start'])
    router.get('/callback', [OAuthController, 'callback'])
  })

  // --- Session-gated -------------------------------------------------------
  router.group(
    { prefix: '/2fa', middleware: [currentUser, authorize(authPolicy, 'canSetupTotp')] },
    () => {
      router.post('/setup', [TotpController, 'setup'])
    },
  )

  router.group(
    { prefix: '/2fa', middleware: [currentUser, authorize(authPolicy, 'canVerifyTotp')] },
    () => {
      router.post('/verify', [TotpController, 'verify'])
    },
  )

  router.group(
    { middleware: [currentUser, authorize(authPolicy, 'canSignOut')] },
    () => {
      router.post('/sign-out', [SessionController, 'destroy'])
    },
  )
})

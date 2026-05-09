import { router, authorize } from '@strav/http'
import { currentUser } from '#middleware/current_user'
import { tenantContext } from '#middleware/tenant_context'
import workspacePolicy from '#policies/workspace_policy'
import spacePolicy from '#policies/space_policy'
import LandingController from '#controllers/landing_controller'
import AuthViewController from '#controllers/auth_view_controller'
import WorkspaceController from '#controllers/workspace_controller'
import SpaceController from '#controllers/space_controller'
import SpaceDefaultsController from '#controllers/space_defaults_controller'

/**
 * Slice 002 — workspace + space route registrations.
 *
 * Mounted as a side-effect import from `start/routes.ts`.
 *
 * Layout (after Build-T2 hoist of UI):
 *   GET  /                                           → landing redirect
 *   GET  /auth                                       → sign-in view (public)
 *   GET  /workspaces/new                             → workspace creation form
 *   POST /workspaces                                 → workspace creation
 *   /workspaces/:slug/...                            → tenant-scoped routes:
 *     GET   /                                        → workspace landing
 *     GET   /spaces/new                              → wizard
 *     POST  /spaces                                  → space creation
 *     GET   /spaces/:space_slug                      → space read view
 *     PATCH /spaces/:space_slug/defaults             → defaults toggle
 *
 * The workspace-creation routes do NOT use `tenantContext` — they create
 * the tenant row itself or precede tenant context. Every nested route under
 * `/workspaces/:slug/...` runs under `tenantContext`.
 */

// --- Public landing + auth -------------------------------------------------
router.group({ middleware: [currentUser] }, () => {
  router.get('/', [LandingController, 'index'])
})
router.get('/auth', [AuthViewController, 'signIn'])

// --- Workspace creation (auth required, no tenant context yet) -------------
router.group(
  { middleware: [currentUser, authorize(workspacePolicy, 'canCreateWorkspace')] },
  () => {
    router.get('/workspaces/new', [WorkspaceController, 'newForm'])
    router.post('/workspaces', [WorkspaceController, 'create'])
  },
)

// --- Workspace-scoped routes (tenant context bound) ------------------------
//
// IMPORTANT — route ordering: literal paths (`/spaces/new`) MUST register
// before parametric paths that would otherwise capture them
// (`/spaces/:space_slug`). Strav matches in registration order, so
// /workspaces/acme/spaces/new would be caught by `:space_slug` (resolved
// to "new") and yield 404 from SpaceController.show. Hence: canCreateSpace
// group first (literal /spaces/new), then canViewSpace (parametric
// /spaces/:space_slug + workspace landing), then canUpdateSpaceDefaults.
router.group(
  {
    prefix: '/workspaces/:slug',
    middleware: [currentUser, tenantContext, authorize(spacePolicy, 'canCreateSpace')],
  },
  () => {
    router.get('/spaces/new', [SpaceController, 'newForm'])
    router.post('/spaces', [SpaceController, 'create'])
  },
)

router.group(
  {
    prefix: '/workspaces/:slug',
    middleware: [currentUser, tenantContext, authorize(spacePolicy, 'canViewSpace')],
  },
  () => {
    // Empty path — matches `/workspaces/<slug>` without a trailing slash.
    // (Strav's router treats `/` as requiring a trailing slash; controllers
    // redirect to the no-slash form, so the empty-path version is the
    // canonical landing.)
    router.get('', [WorkspaceController, 'show'])
    router.get('/spaces/:space_slug', [SpaceController, 'show'])
  },
)

router.group(
  {
    prefix: '/workspaces/:slug',
    middleware: [currentUser, tenantContext, authorize(spacePolicy, 'canUpdateSpaceDefaults')],
  },
  () => {
    router.patch('/spaces/:space_slug/defaults', [SpaceDefaultsController, 'update'])
  },
)

import { router, authorize } from '@strav/http'
import { currentUser } from '#middleware/current_user'
import { tenantContext } from '#middleware/tenant_context'
import workspacePolicy from '#policies/workspace_policy'
import spacePolicy from '#policies/space_policy'
import WorkspaceController from '#controllers/workspace_controller'
import SpaceController from '#controllers/space_controller'
import SpaceDefaultsController from '#controllers/space_defaults_controller'

/**
 * Slice 002 — workspace + space route registrations.
 *
 * Mounted as a side-effect import from `start/routes.ts`.
 *
 * Layout:
 *   POST /workspaces                → workspace creation (any signed-in user)
 *   /workspaces/:slug/...           → tenant-scoped routes:
 *     POST   /spaces                → space creation (≥ editor)
 *
 * The workspace-creation route does NOT use `tenantContext` — it creates
 * the tenant row itself. Every nested route under `/workspaces/:slug/...`
 * runs under the `tenantContext` middleware, which resolves the slug,
 * verifies membership, and binds the request body in `withTenant(...)`.
 */

router.group(
  { middleware: [currentUser, authorize(workspacePolicy, 'canCreateWorkspace')] },
  () => {
    router.post('/workspaces', [WorkspaceController, 'create'])
  },
)

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
    middleware: [currentUser, tenantContext, authorize(spacePolicy, 'canUpdateSpaceDefaults')],
  },
  () => {
    router.patch('/spaces/:space_slug/defaults', [SpaceDefaultsController, 'update'])
  },
)

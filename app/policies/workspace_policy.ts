import { allow, deny, type PolicyResult } from '@strav/http'
import type { CurrentUser } from '#policies/auth_policy'

/**
 * Authorization for the slice-002 workspace surface.
 *
 * Encodes the rules in `docs/specs/slices/002-workspace-and-space-bootstrap.tech.md`
 * § Policy & invariants › Authz. Consumed by `@strav/http`'s
 * `authorize(policy, methodName, …)` middleware factory.
 *
 * Workspace creation is the only workspace-level write in v1; deletion
 * and rename are deferred to a v2 admin slice.
 */
export const workspacePolicy: Record<string, (actor: CurrentUser) => PolicyResult> = {
  /**
   * `POST /workspaces` — any signed-in user may create a workspace.
   * The creating user becomes its `owner` (the controller writes both
   * `workspace.owner_id` and `membership(role='owner')` atomically).
   */
  canCreateWorkspace(actor: CurrentUser): PolicyResult {
    if (!actor) return deny(401, 'session_required')
    return allow()
  },
}

export default workspacePolicy

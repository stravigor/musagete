import { allow, deny, type PolicyResult } from '@strav/http'
import type { CurrentUser } from '#policies/auth_policy'

/**
 * Authorization for the slice-002 space surface.
 *
 * Encodes the rules in `docs/specs/slices/002-workspace-and-space-bootstrap.tech.md`
 * § Policy & invariants › Authz. Every space-surface route runs under the
 * `tenant_context` middleware (mounted on `/workspaces/:slug/...`), which
 * stashes the actor's `membershipRole` on the context. The policy methods
 * receive a {@link SpaceActor} that augments {@link CurrentUser} with the
 * resolved role.
 *
 * The Tech Spec ships the full role enum `{owner, admin, editor, reader,
 * guest}` even though only a subset are written by this slice — forward-
 * compatible with v2 People & Access. Role rank is owner > admin > editor
 * > reader > guest.
 */

export type Role = 'owner' | 'admin' | 'editor' | 'reader' | 'guest'

export type SpaceActor = CurrentUser & {
  membershipRole: Role
}

const ROLE_RANK: Record<Role, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  reader: 1,
  guest: 0,
}

function hasRole(actor: SpaceActor | undefined, min: Role): boolean {
  if (!actor || !actor.membershipRole) return false
  return ROLE_RANK[actor.membershipRole] >= ROLE_RANK[min]
}

export const spacePolicy: Record<string, (actor: SpaceActor) => PolicyResult> = {
  /**
   * `POST /workspaces/:slug/spaces` — member with role ≥ `editor`.
   * `tenant_context` returns 404 first if the user isn't a member at all,
   * so by the time this method runs, `actor.membershipRole` is set.
   */
  canCreateSpace(actor: SpaceActor): PolicyResult {
    if (!actor) return deny(401, 'session_required')
    if (!hasRole(actor, 'editor')) return deny(403, 'role_insufficient')
    return allow()
  },

  /**
   * `GET /workspaces/:slug/spaces/:space_slug` — member with role ≥ `reader`.
   * Visibility filtering (`protected` vs. `private`) is layered on top in
   * the controller for `private` spaces, but the role floor is reader.
   */
  canViewSpace(actor: SpaceActor): PolicyResult {
    if (!actor) return deny(401, 'session_required')
    if (!hasRole(actor, 'reader')) return deny(403, 'role_insufficient')
    return allow()
  },

  /**
   * `PATCH /workspaces/:slug/spaces/:space_slug/defaults` — admin or owner.
   */
  canUpdateSpaceDefaults(actor: SpaceActor): PolicyResult {
    if (!actor) return deny(401, 'session_required')
    if (!hasRole(actor, 'admin')) return deny(403, 'role_insufficient')
    return allow()
  },
}

export default spacePolicy

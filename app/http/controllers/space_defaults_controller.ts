import type { Context } from '@strav/http'
import { updateSpaceDefaults } from '#services/spaces/space_defaults_service'

/**
 * Slice 002 — per-space default toggles.
 *
 * Routes:
 *   PATCH /workspaces/:slug/spaces/:space_slug/defaults  → update()
 *
 * Mounted under the `/workspaces/:slug` route group with `tenantContext`
 * + `authorize(spacePolicy, 'canUpdateSpaceDefaults')` (admin or owner).
 */
export default class SpaceDefaultsController {
  /**
   * `PATCH /workspaces/:slug/spaces/:space_slug/defaults`
   * Body: any subset of `{ requireReview, allowComments, aiIndex }`.
   * Each field is optional; missing fields keep their current value.
   *
   * Returns 200 with the post-update toggle state on success;
   * 404 if the space slug doesn't resolve in the current tenant.
   */
  async update(ctx: Context) {
    const spaceSlug = ctx.params.space_slug
    if (!spaceSlug) return ctx.json({ error: 'invalid_input' }, 400)

    const body = (await ctx.body()) as Record<string, unknown>
    const fields: Parameters<typeof updateSpaceDefaults>[0]['fields'] = {}
    if (typeof body.requireReview === 'boolean') fields.requireReview = body.requireReview
    if (typeof body.allowComments === 'boolean') fields.allowComments = body.allowComments
    if (typeof body.aiIndex === 'boolean') fields.aiIndex = body.aiIndex

    const result = await updateSpaceDefaults({ spaceSlug, fields })

    if (result.kind === 'not_found') {
      return ctx.json({ error: 'not_found' }, 404)
    }

    return ctx.json({
      requireReview: result.requireReview,
      allowComments: result.allowComments,
      aiIndex: result.aiIndex,
    })
  }
}

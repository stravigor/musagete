import type { Context } from '@strav/http'
import { validate, required, string } from '@strav/http'
import type { CurrentUser } from '#policies/auth_policy'
import { createSpace } from '#services/spaces/space_service'
import { SPACE_TEMPLATES } from '#services/spaces/space_templates'

/**
 * Slice 002 — space creation from a wizard template.
 *
 * Routes:
 *   POST /workspaces/:slug/spaces  → create()
 *
 * Mounted under the `/workspaces/:slug/...` route group, which runs
 * `tenantContext` middleware (resolves `:slug` → `workspace.id`, binds
 * `withTenant(...)`) and `authorize(spacePolicy, 'canCreateSpace')`
 * (≥ editor role).
 */
/**
 * Map of template id → human label, kept alongside the template registry
 * so the wizard view can render readable choices without leaking the
 * registry's runtime shape into the UI.
 */
const TEMPLATE_LABELS: Record<string, string> = {
  blank: 'Blank',
  engineering: 'Engineering',
  product: 'Product',
  'people-and-process': 'People & Process',
  'security-and-compliance': 'Security & Compliance',
  'public-api-docs': 'Public API Docs',
}

export default class SpaceController {
  /**
   * `GET /workspaces/:slug/spaces/new`
   * Renders the wizard view (mounts the `CreateSpaceWizard` Vue island).
   * `tenantContext` middleware has already resolved the workspace + the
   * actor's role; the view only needs the workspace slug + the template
   * list (id + label) to drive the wizard.
   */
  async newForm(ctx: Context) {
    const workspace = ctx.get<{ id: number; slug: string; name: string }>('workspace')
    const templates = Object.values(SPACE_TEMPLATES).map((t) => ({
      id: t.id,
      label: TEMPLATE_LABELS[t.id] ?? t.id,
      defaults: t.defaults,
    }))
    return ctx.view('spaces/new', { workspace, templates })
  }

  /**
   * `POST /workspaces/:slug/spaces`
   * Body: `{ template, name, slug, visibility }` per the wizard's submission.
   *
   * 302 redirect to `/workspaces/<workspace-slug>/spaces/<space-slug>` on
   * success; 400 invalid_input; 409 slug_taken; 422 unknown_template.
   */
  async create(ctx: Context) {
    const user = ctx.get<CurrentUser>('user')
    const workspace = ctx.get<{ id: number; slug: string }>('workspace')

    const body = (await ctx.body()) as Record<string, unknown>
    const { data, errors } = validate<{
      template: string
      name: string
      slug: string
      visibility: 'protected' | 'private'
    }>(body, {
      template: [required(), string()],
      name: [required(), string()],
      slug: [required(), string()],
      visibility: [required(), string()],
    })
    if (errors) return ctx.json({ error: 'invalid_input' }, 400)
    if (data.visibility !== 'protected' && data.visibility !== 'private') {
      return ctx.json({ error: 'invalid_input' }, 400)
    }

    // Wizard step 3 toggles. Each is optional; only booleans are honored
    // (anything else falls through to the template default in the service).
    const defaultOverrides: NonNullable<Parameters<typeof createSpace>[0]['defaultOverrides']> = {}
    if (typeof body.requireReview === 'boolean') defaultOverrides.requireReview = body.requireReview
    if (typeof body.allowComments === 'boolean') defaultOverrides.allowComments = body.allowComments
    if (typeof body.aiIndex === 'boolean') defaultOverrides.aiIndex = body.aiIndex

    const result = await createSpace({
      workspaceId: workspace.id,
      template: data.template,
      name: data.name,
      slug: data.slug.toLowerCase(),
      visibility: data.visibility,
      authorId: user.id,
      defaultOverrides,
    })

    if (result.kind === 'slug_taken') {
      return ctx.json({ error: 'slug_taken' }, 409)
    }
    if (result.kind === 'unknown_template') {
      return ctx.json({ error: 'unknown_template' }, 422)
    }

    return ctx.redirect(`/workspaces/${workspace.slug}/spaces/${result.slug}`)
  }
}

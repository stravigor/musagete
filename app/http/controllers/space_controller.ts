import type { Context } from '@strav/http'
import { validate, required, string } from '@strav/http'
import { sql } from '@strav/database'
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
    const user = ctx.get<CurrentUser>('user')
    const workspace = ctx.get<{ id: number; slug: string; name: string }>('workspace')
    const membershipRole = ctx.get<string>('membershipRole')
    const templates = Object.values(SPACE_TEMPLATES).map((t) => ({
      id: t.id,
      label: TEMPLATE_LABELS[t.id] ?? t.id,
      defaults: t.defaults,
    }))
    const sidebarSpaces = (await sql`
      SELECT "slug", "name", "template"
      FROM "space"
      ORDER BY "id" ASC
    `) as Array<{ slug: string; name: string; template: string }>

    return ctx.view('spaces/new', {
      user,
      workspace,
      membershipRole,
      templates,
      sidebarSpaces,
    })
  }

  /**
   * `GET /workspaces/:slug/spaces/:space_slug`
   * Space read view — folder tree + seeded docs. Per Tech Spec § Interface
   * contract; under `tenantContext` so RLS scopes the queries.
   */
  async show(ctx: Context) {
    const user = ctx.get<CurrentUser>('user')
    const workspace = ctx.get<{ id: number; slug: string; name: string }>('workspace')
    const membershipRole = ctx.get<string>('membershipRole')
    const spaceSlug = ctx.params.space_slug

    const spaces = (await sql`
      SELECT "id", "slug", "name", "template", "visibility"
      FROM "space"
      WHERE "slug" = ${spaceSlug}
      LIMIT 1
    `) as Array<{
      id: number
      slug: string
      name: string
      template: string
      visibility: string
    }>
    if (spaces.length === 0) return ctx.json({ error: 'not_found' }, 404)
    const space = spaces[0]!

    const docs = (await sql`
      SELECT "slug", "title", "folder_path"
      FROM "doc"
      WHERE "space_id" = ${space.id}
      ORDER BY "folder_path", "slug"
    `) as Array<{ slug: string; title: string; folder_path: string }>

    // Group by folder_path for the view.
    const byFolder = new Map<string, Array<{ slug: string; title: string }>>()
    for (const doc of docs) {
      if (!byFolder.has(doc.folder_path)) byFolder.set(doc.folder_path, [])
      byFolder.get(doc.folder_path)!.push({ slug: doc.slug, title: doc.title })
    }
    const folders = Array.from(byFolder.entries()).map(([path, docs]) => ({
      path,
      docs,
    }))

    // Sidebar uses the workspace's full spaces list — separate SELECT so
    // we don't conflate the "single space lookup" with the chrome data.
    const sidebarSpaces = (await sql`
      SELECT "slug", "name", "template"
      FROM "space"
      ORDER BY "id" ASC
    `) as Array<{ slug: string; name: string; template: string }>

    return ctx.view('spaces/show', {
      user,
      workspace,
      membershipRole,
      space,
      folders,
      sidebarSpaces,
    })
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

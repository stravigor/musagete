import { sql } from '@strav/database'

/**
 * Sidebar / shell data — the spaces tree shown in the workspace shell.
 *
 * Called from controllers that render inside `layouts/shell.strav`. The
 * call must happen inside a `withTenant(...)` block (the `tenant_context`
 * middleware binds it for `/workspaces/:slug/...` routes), so the SELECT
 * is RLS-scoped to the current workspace.
 */
export type SidebarSpace = {
  slug: string
  name: string
  template: string
}

export async function loadSidebarSpaces(): Promise<SidebarSpace[]> {
  return (await sql`
    SELECT "slug", "name", "template"
    FROM "space"
    ORDER BY "id" ASC
  `) as SidebarSpace[]
}

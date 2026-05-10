import { ViewEngine } from '@strav/view'

/**
 * App-wide template defaults. Bare identifiers in `.strav` (`{{ theme }}`)
 * throw ReferenceError when missing from `__data` AND not registered as
 * globals — so layouts/partials referencing `theme`, `density`, `display`,
 * `accent`, `title`, `sidebarSpaces`, `user`, `workspace`, `membershipRole`,
 * `space`, `doc` need either a per-render override or a safe default here.
 *
 * Per-render `ctx.view(name, { theme, ... })` wins over the globals because
 * ViewEngine merges `__data` last.
 */
export function setupViewGlobals(): void {
  ViewEngine.setGlobal('theme', 'light')
  ViewEngine.setGlobal('density', 'regular')
  ViewEngine.setGlobal('display', 'serif')
  ViewEngine.setGlobal('accent', '#B8442C')
  ViewEngine.setGlobal('title', 'Musagete')

  ViewEngine.setGlobal('sidebarSpaces', [])
  ViewEngine.setGlobal('user', { email: '', id: 0 })
  ViewEngine.setGlobal('workspace', { id: 0, slug: '', name: '' })
  ViewEngine.setGlobal('membershipRole', '')
  ViewEngine.setGlobal('space', null)
  ViewEngine.setGlobal('doc', null)
}

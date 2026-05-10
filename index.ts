import 'reflect-metadata'
import { app } from '@strav/kernel'
import { IslandBuilder, ViewEngine } from '@strav/view'
import { providers } from './start/providers'
import './start/routes'

// Build islands + CSS before the server starts
// Outputs: public/css/app.css (from SCSS) and public/builds/islands.js (Vue components)
const builder = new IslandBuilder({
  css: {
    entry: 'resources/css/app.scss',
    outDir: './public/css',
  },
  outDir: './public/builds',
})
await builder.build()

// Register service providers
app
  .useProviders(providers)
  .onBooted(async() => {
    // Default user-preference globals. Every view's `<html>` reads
    // these via `data-theme` / `data-density` / `data-display` and the
    // inline `--accent` style on layouts/app.strav. A future Topbar
    // island (slice 003+) will let users override via cookies; until
    // then, every render uses these defaults. Per-render `ctx.view(name, data)`
    // can still override (data wins over globals in the merge).
    ViewEngine.setGlobal('theme', 'light')
    ViewEngine.setGlobal('density', 'regular')
    ViewEngine.setGlobal('display', 'serif')
    ViewEngine.setGlobal('accent', '#B8442C') // terracotta — design default
    ViewEngine.setGlobal('title', 'Musagete')

    // Shell partial defaults. Bare identifiers in `.strav` throw ReferenceError
    // when missing from __data; partials inherit data from the parent render
    // (per ViewEngine.includeFn → `{ ...data, ...includeData }`), but setting
    // empty defaults here means a controller that forgets to pass shell data
    // gets an empty sidebar / empty user instead of a crashed page.
    // Per-render `ctx.view(name, { sidebarSpaces, user, ... })` overrides.
    ViewEngine.setGlobal('sidebarSpaces', [])
    ViewEngine.setGlobal('user', { email: '', id: 0 })
    ViewEngine.setGlobal('workspace', { id: 0, slug: '', name: '' })
    ViewEngine.setGlobal('membershipRole', '')
    ViewEngine.setGlobal('space', null)
    ViewEngine.setGlobal('doc', null)

    // Watch for island and template changes in dev
    if (Bun.env.NODE_ENV !== 'production') {
      builder.watch()
      ViewEngine.instance.watch()
    }
  })

await app.start()
import 'reflect-metadata'
import { app } from '@strav/kernel'
import { IslandBuilder, ViewEngine } from '@strav/view'
import { providers } from './start/providers'
import { setupViewGlobals } from './start/view_globals'
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
    setupViewGlobals()

    if (Bun.env.NODE_ENV !== 'production') {
      builder.watch()
      ViewEngine.instance.watch()
    }
  })

await app.start()
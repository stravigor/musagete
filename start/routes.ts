// Route registration entrypoint.
//
// Hand-written route files live under `routes/<area>.ts` and register
// themselves against `@strav/http`'s router for their side-effects on
// import. This file pulls them all in once at boot.
//
// Generated route wiring (from `bun strav generate:api`) lands at
// `start/api_routes.ts` and gets imported here once it exists. Until
// then this file only sources hand-written routes.

// Hand-written routes:
import '#routes/auth'
import '#routes/workspaces'

// Generated API routes (uncomment once `start/api_routes.ts` is generated):
// import './api_routes'

export {} // ensure this file is treated as a module

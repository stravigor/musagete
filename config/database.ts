import { env } from '@strav/kernel'

export default {
  host: env('DB_HOST', '127.0.0.1'),
  port: env.int('DB_PORT', 5432),
  username: env('DB_USER', 'postgres'),
  password: env('DB_PASSWORD', ''),
  database: env('DB_DATABASE', 'musagete'),
  pool: env.int('DB_POOL_MAX', 10),
  idleTimeout: env.int('DB_IDLE_TIMEOUT', 20),

  // Multi-tenant (RLS) configuration. Tenant table name + idType are derived
  // by `@strav/database` from whichever schema is marked `tenantRegistry: true`
  // (slice 002: `database/schemas/workspace.ts`).
  //
  // The `app` (NOBYPASSRLS) pool runs every tenant-scoped query under the
  // `tenant_isolation` policy; the `bypass` (BYPASSRLS) pool runs migrations,
  // `TenantManager` operations, and any service code wrapped in
  // `withoutTenant(...)`. Both pools must exist before `tenant.enabled` flips
  // on; the bypass role must be a separate Postgres role with BYPASSRLS.
  tenant: {
    enabled: env.bool('DB_TENANT_ENABLED', false),
    bypass: {
      username: env('DB_BYPASS_USER', 'liva'),
      password: env('DB_BYPASS_PASSWORD', ''),
    },
  },
}

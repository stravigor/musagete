-- Create table: membership
CREATE TABLE IF NOT EXISTS "membership" (
  "id" BIGINT NOT NULL,
  "workspace_id" BIGINT NOT NULL DEFAULT current_setting('app.tenant_id', true)::bigint,
  "user_id" BIGINT NOT NULL,
  "role" "membership_role" NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pk_membership" PRIMARY KEY ("workspace_id", "id")
);

-- Enable row-level security for tenant isolation
ALTER TABLE "membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "membership" USING ("workspace_id" = current_setting('app.tenant_id', true)::bigint) WITH CHECK ("workspace_id" = current_setting('app.tenant_id', true)::bigint);

-- Per-tenant id assignment trigger
DROP TRIGGER IF EXISTS "membership_assign_tenanted_id" ON "membership";
CREATE TRIGGER "membership_assign_tenanted_id" BEFORE INSERT ON "membership" FOR EACH ROW EXECUTE FUNCTION strav_assign_tenanted_id('workspace_id');

-- Create table: space_defaults
CREATE TABLE IF NOT EXISTS "space_defaults" (
  "id" BIGINT NOT NULL,
  "workspace_id" BIGINT NOT NULL DEFAULT current_setting('app.tenant_id', true)::bigint,
  "space_id" BIGINT NOT NULL,
  "require_review" BOOLEAN NOT NULL DEFAULT true,
  "allow_comments" BOOLEAN NOT NULL DEFAULT true,
  "ai_index" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pk_space_defaults" PRIMARY KEY ("workspace_id", "id")
);

-- Enable row-level security for tenant isolation
ALTER TABLE "space_defaults" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "space_defaults" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "space_defaults" USING ("workspace_id" = current_setting('app.tenant_id', true)::bigint) WITH CHECK ("workspace_id" = current_setting('app.tenant_id', true)::bigint);

-- Per-tenant id assignment trigger
DROP TRIGGER IF EXISTS "space_defaults_assign_tenanted_id" ON "space_defaults";
CREATE TRIGGER "space_defaults_assign_tenanted_id" BEFORE INSERT ON "space_defaults" FOR EACH ROW EXECUTE FUNCTION strav_assign_tenanted_id('workspace_id');

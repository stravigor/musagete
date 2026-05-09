-- Create table: space
CREATE TABLE IF NOT EXISTS "space" (
  "id" BIGINT NOT NULL,
  "workspace_id" BIGINT NOT NULL DEFAULT current_setting('app.tenant_id', true)::bigint,
  "slug" VARCHAR(80) NOT NULL DEFAULT '',
  "name" VARCHAR(80) NOT NULL DEFAULT '',
  "icon" VARCHAR(40),
  "visibility" "space_visibility" NOT NULL,
  "template" VARCHAR(40) NOT NULL DEFAULT '',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ,
  CONSTRAINT "pk_space" PRIMARY KEY ("workspace_id", "id")
);

-- Enable row-level security for tenant isolation
ALTER TABLE "space" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "space" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "space" USING ("workspace_id" = current_setting('app.tenant_id', true)::bigint) WITH CHECK ("workspace_id" = current_setting('app.tenant_id', true)::bigint);

-- Per-tenant id assignment trigger
DROP TRIGGER IF EXISTS "space_assign_tenanted_id" ON "space";
CREATE TRIGGER "space_assign_tenanted_id" BEFORE INSERT ON "space" FOR EACH ROW EXECUTE FUNCTION strav_assign_tenanted_id('workspace_id');

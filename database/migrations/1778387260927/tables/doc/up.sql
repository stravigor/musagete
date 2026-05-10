-- Create table: doc
CREATE TABLE IF NOT EXISTS "doc" (
  "id" BIGINT NOT NULL,
  "workspace_id" BIGINT NOT NULL DEFAULT current_setting('app.tenant_id', true)::bigint,
  "space_id" BIGINT NOT NULL,
  "slug" VARCHAR(80) NOT NULL DEFAULT '',
  "title" VARCHAR(200) NOT NULL DEFAULT '',
  "folder_path" VARCHAR(255) NOT NULL DEFAULT '/',
  "current_revision_id" BIGINT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pk_doc" PRIMARY KEY ("workspace_id", "id")
);

-- Enable row-level security for tenant isolation
ALTER TABLE "doc" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "doc" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "doc" USING ("workspace_id" = current_setting('app.tenant_id', true)::bigint) WITH CHECK ("workspace_id" = current_setting('app.tenant_id', true)::bigint);

-- Per-tenant id assignment trigger
DROP TRIGGER IF EXISTS "doc_assign_tenanted_id" ON "doc";
CREATE TRIGGER "doc_assign_tenanted_id" BEFORE INSERT ON "doc" FOR EACH ROW EXECUTE FUNCTION strav_assign_tenanted_id('workspace_id');

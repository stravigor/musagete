-- Create table: revision
CREATE TABLE IF NOT EXISTS "revision" (
  "id" BIGINT NOT NULL,
  "workspace_id" BIGINT NOT NULL DEFAULT current_setting('app.tenant_id', true)::bigint,
  "doc_id" BIGINT NOT NULL,
  "author_id" BIGINT NOT NULL,
  "message" TEXT,
  "content" TEXT NOT NULL DEFAULT '',
  "parent_revision_id" BIGINT,
  "status" "revision_status" NOT NULL DEFAULT 'draft',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pk_revision" PRIMARY KEY ("workspace_id", "id")
);

-- Enable row-level security for tenant isolation
ALTER TABLE "revision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "revision" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "revision" USING ("workspace_id" = current_setting('app.tenant_id', true)::bigint) WITH CHECK ("workspace_id" = current_setting('app.tenant_id', true)::bigint);

-- Per-tenant id assignment trigger
DROP TRIGGER IF EXISTS "revision_assign_tenanted_id" ON "revision";
CREATE TRIGGER "revision_assign_tenanted_id" BEFORE INSERT ON "revision" FOR EACH ROW EXECUTE FUNCTION strav_assign_tenanted_id('workspace_id');

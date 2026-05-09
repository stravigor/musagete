-- Modify table: revision
ALTER TABLE "revision" ALTER COLUMN "id" SET DEFAULT 0;
ALTER TABLE "revision" ALTER COLUMN "workspace_id" SET DEFAULT current_setting('app.tenant_id', true)::bigint;

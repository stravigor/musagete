-- Modify table: space
ALTER TABLE "space" ALTER COLUMN "id" SET DEFAULT 0;
ALTER TABLE "space" ALTER COLUMN "workspace_id" SET DEFAULT current_setting('app.tenant_id', true)::bigint;

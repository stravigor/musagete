-- Modify table: membership
ALTER TABLE "membership" ALTER COLUMN "id" SET DEFAULT 0;
ALTER TABLE "membership" ALTER COLUMN "workspace_id" SET DEFAULT current_setting('app.tenant_id', true)::bigint;

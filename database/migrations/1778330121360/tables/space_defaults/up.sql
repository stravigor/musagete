-- Modify table: space_defaults
ALTER TABLE "space_defaults" ALTER COLUMN "id" SET DEFAULT 0;
ALTER TABLE "space_defaults" ALTER COLUMN "workspace_id" SET DEFAULT current_setting('app.tenant_id', true)::bigint;

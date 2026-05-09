-- Reverse modify table: space_defaults
ALTER TABLE "space_defaults" ALTER COLUMN "workspace_id" SET DEFAULT (current_setting('app.tenant_id'::text, true))::bigint;
ALTER TABLE "space_defaults" ALTER COLUMN "id" DROP DEFAULT;

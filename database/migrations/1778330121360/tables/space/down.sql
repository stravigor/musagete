-- Reverse modify table: space
ALTER TABLE "space" ALTER COLUMN "workspace_id" SET DEFAULT (current_setting('app.tenant_id'::text, true))::bigint;
ALTER TABLE "space" ALTER COLUMN "id" DROP DEFAULT;

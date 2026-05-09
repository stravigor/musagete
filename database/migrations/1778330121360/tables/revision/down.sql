-- Reverse modify table: revision
ALTER TABLE "revision" ALTER COLUMN "workspace_id" SET DEFAULT (current_setting('app.tenant_id'::text, true))::bigint;
ALTER TABLE "revision" ALTER COLUMN "id" DROP DEFAULT;

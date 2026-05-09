-- Reverse modify table: doc
ALTER TABLE "doc" ALTER COLUMN "workspace_id" SET DEFAULT (current_setting('app.tenant_id'::text, true))::bigint;
ALTER TABLE "doc" ALTER COLUMN "id" DROP DEFAULT;

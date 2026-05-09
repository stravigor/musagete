-- Modify table: doc
ALTER TABLE "doc" ALTER COLUMN "id" SET DEFAULT 0;
ALTER TABLE "doc" ALTER COLUMN "workspace_id" SET DEFAULT current_setting('app.tenant_id', true)::bigint;

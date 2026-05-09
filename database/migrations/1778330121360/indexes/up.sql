CREATE UNIQUE INDEX IF NOT EXISTS "idx_doc_workspace_id_space_id_slug_unique" ON "doc" ("workspace_id", "space_id", "slug");
DROP INDEX IF EXISTS "idx_doc_space_id_slug_unique";
DROP INDEX IF EXISTS "idx_doc_space_id_slug_unique";

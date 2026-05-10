-- Create table: recovery_code
CREATE TABLE IF NOT EXISTS "recovery_code" (
  "id" BIGSERIAL,
  "user_id" BIGINT NOT NULL,
  "code_hash" BYTEA NOT NULL,
  "used_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pk_recovery_code" PRIMARY KEY ("id")
);

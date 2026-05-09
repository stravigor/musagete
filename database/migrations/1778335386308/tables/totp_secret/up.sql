-- Create table: totp_secret
CREATE TABLE IF NOT EXISTS "totp_secret" (
  "id" BIGSERIAL,
  "user_id" BIGINT NOT NULL,
  "secret_encrypted" BYTEA NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "enabled_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pk_totp_secret" PRIMARY KEY ("id")
);

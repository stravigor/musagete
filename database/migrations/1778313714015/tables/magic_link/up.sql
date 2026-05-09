-- Create table: magic_link
CREATE TABLE IF NOT EXISTS "magic_link" (
  "id" BIGSERIAL,
  "email" VARCHAR(254) NOT NULL DEFAULT '',
  "token_hash" BYTEA NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumed_at" TIMESTAMPTZ,
  "ip" INET,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pk_magic_link" PRIMARY KEY ("id")
);

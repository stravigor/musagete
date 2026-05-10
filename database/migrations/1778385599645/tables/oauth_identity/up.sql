-- Create table: oauth_identity
CREATE TABLE IF NOT EXISTS "oauth_identity" (
  "id" BIGSERIAL,
  "user_id" BIGINT NOT NULL,
  "provider" "oauth_identity_provider" NOT NULL,
  "provider_user_id" VARCHAR(255) NOT NULL DEFAULT '',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pk_oauth_identity" PRIMARY KEY ("id")
);

-- Create table: session
CREATE TABLE IF NOT EXISTS "session" (
  "id" BIGSERIAL,
  "user_id" BIGINT NOT NULL,
  "cookie_hash" BYTEA NOT NULL,
  "state" "session_state" NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip" INET,
  "user_agent" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pk_session" PRIMARY KEY ("id")
);

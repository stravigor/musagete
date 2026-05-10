-- Create table: login_attempt
CREATE TABLE IF NOT EXISTS "login_attempt" (
  "id" BIGSERIAL,
  "email" VARCHAR(254),
  "ip" INET,
  "kind" "login_attempt_kind" NOT NULL,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pk_login_attempt" PRIMARY KEY ("id")
);

ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "fk_session_user_id";
ALTER TABLE "recovery_code" DROP CONSTRAINT IF EXISTS "uq_recovery_code_user_id_code_hash";
ALTER TABLE "recovery_code" DROP CONSTRAINT IF EXISTS "fk_recovery_code_user_id";
ALTER TABLE "oauth_identity" DROP CONSTRAINT IF EXISTS "uq_oauth_identity_provider_provider_user_id";
ALTER TABLE "oauth_identity" DROP CONSTRAINT IF EXISTS "fk_oauth_identity_user_id";
ALTER TABLE "totp_secret" DROP CONSTRAINT IF EXISTS "fk_totp_secret_user_id";

ALTER TABLE "totp_secret" ADD CONSTRAINT "fk_totp_secret_user_id" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_identity" ADD CONSTRAINT "fk_oauth_identity_user_id" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_identity" ADD CONSTRAINT "uq_oauth_identity_provider_provider_user_id" UNIQUE ("provider", "provider_user_id");
ALTER TABLE "recovery_code" ADD CONSTRAINT "fk_recovery_code_user_id" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recovery_code" ADD CONSTRAINT "uq_recovery_code_user_id_code_hash" UNIQUE ("user_id", "code_hash");
ALTER TABLE "session" ADD CONSTRAINT "fk_session_user_id" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

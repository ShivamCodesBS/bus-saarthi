-- Add refresh token fields for token rotation (SEC-01)
ALTER TABLE "users" ADD COLUMN "refresh_token" TEXT;
ALTER TABLE "users" ADD COLUMN "refresh_token_expires_at" TIMESTAMPTZ(6);
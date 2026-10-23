-- Add face reset request tracking
ALTER TABLE "users" ADD COLUMN "face_reset_requested_at" TIMESTAMPTZ(6);
ALTER TABLE "users" ADD COLUMN "face_reset_requested_by" VARCHAR(50);

-- Index for finding users who requested face reset
CREATE INDEX "users_face_reset_requested_idx" ON "users" ("face_reset_requested_at") WHERE "face_reset_requested_at" IS NOT NULL;

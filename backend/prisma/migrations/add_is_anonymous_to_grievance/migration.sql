-- Add is_anonymous column to grievances table
ALTER TABLE "grievances" ADD COLUMN "is_anonymous" BOOLEAN NOT NULL DEFAULT false;

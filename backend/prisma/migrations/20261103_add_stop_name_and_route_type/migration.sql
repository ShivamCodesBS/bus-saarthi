-- Add stop_name to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stop_name" VARCHAR(100);

-- Add route_type to routes table (enum will be handled by Prisma)
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "route_type" VARCHAR(20) DEFAULT 'local';

-- Create index on stop_name for faster queries
CREATE INDEX IF NOT EXISTS "users_stop_name_idx" ON "users" ("stop_name");

-- Create index on route_type for faster filtering
CREATE INDEX IF NOT EXISTS "routes_route_type_idx" ON "routes" ("route_type");
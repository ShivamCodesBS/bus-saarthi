-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('passenger', 'teacher', 'admin', 'driver', 'transport_incharge', 'tech_admin', 'parent');

-- CreateEnum
CREATE TYPE "FeeStatus" AS ENUM ('paid', 'unpaid', 'partial');

-- CreateEnum
CREATE TYPE "GrievanceStatus" AS ENUM ('pending', 'in_progress', 'resolved', 'reopened', 'closed');

-- CreateEnum
CREATE TYPE "BusStatus" AS ENUM ('active', 'maintenance', 'retired');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('log', 'warn', 'error', 'debug', 'verbose', 'fatal');

-- CreateEnum
CREATE TYPE "MergeStatus" AS ENUM ('active', 'undone', 'expired');

-- CreateEnum
CREATE TYPE "MergeReason" AS ENUM ('low_attendance', 'vehicle_breakdown', 'driver_unavailable', 'weather', 'other');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "login_id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "password" TEXT,
    "role" "UserRole" NOT NULL,
    "route_id" TEXT,
    "fee_status" "FeeStatus" NOT NULL DEFAULT 'unpaid',
    "phone" VARCHAR(20),
    "email" VARCHAR(100),
    "profile_pic" TEXT,
    "designation" VARCHAR(100),
    "last_login" TIMESTAMPTZ(6),
    "location_lat" DOUBLE PRECISION,
    "location_lng" DOUBLE PRECISION,
    "license_number" VARCHAR(50),
    "license_expiry" TIMESTAMPTZ(6),
    "experience_years" INTEGER,
    "blood_group" VARCHAR(10),
    "parent_name" VARCHAR(100),
    "parent_phone" VARCHAR(20),
    "dob" TIMESTAMPTZ(6),
    "address" TEXT,
    "grade_class" VARCHAR(50),
    "face_enrolled_at" TIMESTAMPTZ(6),
    "aws_face_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "wake_alarm" JSON,
    "subject" VARCHAR(100),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bus_number" VARCHAR(30) NOT NULL,
    "registration_number" VARCHAR(50),
    "vehicle_model" VARCHAR(100),
    "seating_capacity" INTEGER,
    "status" "BusStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "route_id" VARCHAR(50) NOT NULL,
    "route_name" VARCHAR(100) NOT NULL,
    "bus_number" VARCHAR(30) NOT NULL,
    "bus_id" UUID,
    "driver_id" VARCHAR(50),
    "stops" TEXT NOT NULL,
    "city" VARCHAR(50) NOT NULL DEFAULT 'Bareilly',
    "vehicle_model" VARCHAR(100),
    "registration_number" VARCHAR(50),
    "seating_capacity" INTEGER,
    "insurance_expiry" TIMESTAMPTZ(6),
    "speed_limit" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "passenger_id" VARCHAR(50) NOT NULL,
    "route_id" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100),
    "fee_status" "FeeStatus",
    "confidence" REAL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "original_route_id" VARCHAR(20),
    "merge_event_id" UUID,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grievances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "login_id" VARCHAR(50) NOT NULL,
    "route" VARCHAR(20) NOT NULL,
    "bus_number" VARCHAR(30),
    "text" TEXT NOT NULL,
    "real_name" VARCHAR(100),
    "type" VARCHAR(50),
    "media_url" TEXT,
    "status" "GrievanceStatus" NOT NULL DEFAULT 'pending',
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" VARCHAR(100),
    "admin_response" TEXT,
    "resolution_note" TEXT,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" VARCHAR(50),
    "confirmed_at" TIMESTAMPTZ(6),
    "reopen_count" INTEGER NOT NULL DEFAULT 0,
    "due_at" TIMESTAMPTZ(6),
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "grievances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grievance_upvotes" (
    "grievance_id" UUID NOT NULL,
    "login_id" VARCHAR(50) NOT NULL,

    CONSTRAINT "grievance_upvotes_pkey" PRIMARY KEY ("grievance_id","login_id")
);

-- CreateTable
CREATE TABLE "leaves" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "login_id" VARCHAR(50) NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "level" "LogLevel" NOT NULL DEFAULT 'log',
    "message" TEXT NOT NULL,
    "context" VARCHAR(255),
    "meta" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcasts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message" TEXT NOT NULL,
    "title" VARCHAR(200),
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "login_id" VARCHAR(50) NOT NULL,
    "subscription" JSONB NOT NULL,
    "device_type" VARCHAR(20) NOT NULL DEFAULT 'web',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "login_id" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL DEFAULT 'info',
    "grievance_id" UUID,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sos_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "login_id" VARCHAR(50) NOT NULL,
    "passenger" VARCHAR(100),
    "route" VARCHAR(20) NOT NULL,
    "time" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sos_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telemetry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "route_id" VARCHAR(20) NOT NULL DEFAULT '4',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "gps_speed_knots" REAL,
    "mpu_speed_kmh" REAL,
    "heading_deg" REAL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telemetry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_child_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parent_login_id" VARCHAR(50) NOT NULL,
    "child_login_id" VARCHAR(50) NOT NULL,
    "nickname" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_child_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merge_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cancelled_route_id" VARCHAR(50) NOT NULL,
    "target_route_id" VARCHAR(50) NOT NULL,
    "reason" "MergeReason" NOT NULL DEFAULT 'low_attendance',
    "status" "MergeStatus" NOT NULL DEFAULT 'active',
    "initiated_by" VARCHAR(50) NOT NULL,
    "students_moved" INTEGER NOT NULL DEFAULT 0,
    "cancelled_bus_number" VARCHAR(30),
    "target_bus_number" VARCHAR(30),
    "cancelled_route_name" VARCHAR(100),
    "target_route_name" VARCHAR(100),
    "notes" TEXT,
    "merged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unmerged_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merge_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_login_id_key" ON "users"("login_id");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_route_id_idx" ON "users"("route_id");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "buses_bus_number_key" ON "buses"("bus_number");

-- CreateIndex
CREATE UNIQUE INDEX "routes_route_id_key" ON "routes"("route_id");

-- CreateIndex
CREATE INDEX "routes_bus_id_idx" ON "routes"("bus_id");

-- CreateIndex
CREATE INDEX "attendance_timestamp_idx" ON "attendance"("timestamp");

-- CreateIndex
CREATE INDEX "attendance_passenger_id_timestamp_idx" ON "attendance"("passenger_id", "timestamp");

-- CreateIndex
CREATE INDEX "attendance_route_id_timestamp_idx" ON "attendance"("route_id", "timestamp");

-- CreateIndex
CREATE INDEX "grievances_status_idx" ON "grievances"("status");

-- CreateIndex
CREATE INDEX "grievances_route_idx" ON "grievances"("route");

-- CreateIndex
CREATE INDEX "grievances_login_id_idx" ON "grievances"("login_id");

-- CreateIndex
CREATE INDEX "grievances_created_at_idx" ON "grievances"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "leaves_login_id_date_key" ON "leaves"("login_id", "date");

-- CreateIndex
CREATE INDEX "system_logs_created_at_idx" ON "system_logs"("created_at");

-- CreateIndex
CREATE INDEX "push_subscriptions_login_id_idx" ON "push_subscriptions"("login_id");

-- CreateIndex
CREATE INDEX "notifications_login_id_read_idx" ON "notifications"("login_id", "read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "sos_alerts_time_idx" ON "sos_alerts"("time");

-- CreateIndex
CREATE INDEX "telemetry_route_id_timestamp_idx" ON "telemetry"("route_id", "timestamp");

-- CreateIndex
CREATE INDEX "parent_child_links_child_login_id_idx" ON "parent_child_links"("child_login_id");

-- CreateIndex
CREATE UNIQUE INDEX "parent_child_links_parent_login_id_child_login_id_key" ON "parent_child_links"("parent_login_id", "child_login_id");

-- CreateIndex
CREATE INDEX "merge_events_cancelled_route_id_status_idx" ON "merge_events"("cancelled_route_id", "status");

-- CreateIndex
CREATE INDEX "merge_events_target_route_id_status_idx" ON "merge_events"("target_route_id", "status");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("route_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_bus_id_fkey" FOREIGN KEY ("bus_id") REFERENCES "buses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_passenger_id_fkey" FOREIGN KEY ("passenger_id") REFERENCES "users"("login_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grievances" ADD CONSTRAINT "grievances_login_id_fkey" FOREIGN KEY ("login_id") REFERENCES "users"("login_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grievance_upvotes" ADD CONSTRAINT "grievance_upvotes_grievance_id_fkey" FOREIGN KEY ("grievance_id") REFERENCES "grievances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grievance_upvotes" ADD CONSTRAINT "grievance_upvotes_login_id_fkey" FOREIGN KEY ("login_id") REFERENCES "users"("login_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_login_id_fkey" FOREIGN KEY ("login_id") REFERENCES "users"("login_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_login_id_fkey" FOREIGN KEY ("login_id") REFERENCES "users"("login_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_login_id_fkey" FOREIGN KEY ("login_id") REFERENCES "users"("login_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_grievance_id_fkey" FOREIGN KEY ("grievance_id") REFERENCES "grievances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_child_links" ADD CONSTRAINT "parent_child_links_parent_login_id_fkey" FOREIGN KEY ("parent_login_id") REFERENCES "users"("login_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_child_links" ADD CONSTRAINT "parent_child_links_child_login_id_fkey" FOREIGN KEY ("child_login_id") REFERENCES "users"("login_id") ON DELETE CASCADE ON UPDATE CASCADE;


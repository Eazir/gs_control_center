-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "auth";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "projects";

-- CreateEnum
CREATE TYPE "auth"."UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'CLOSER', 'CLIENTE');

-- CreateEnum
CREATE TYPE "auth"."UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INVITED', 'DELETED');

-- CreateEnum
CREATE TYPE "projects"."ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "projects"."ProjectRole" AS ENUM ('DIRECTOR', 'CLOSER', 'CLIENTE');

-- CreateTable
CREATE TABLE "auth"."users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "auth"."UserRole" NOT NULL,
    "status" "auth"."UserStatus" NOT NULL DEFAULT 'INVITED',
    "mfa_secret_enc" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ,
    "failed_attempts" SMALLINT NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "refresh_hash" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."audit_log" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "target_id" UUID,
    "target_type" TEXT,
    "ip" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "role" "auth"."UserRole" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "invited_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "accepted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "projects"."ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "director_id" UUID,
    "products" JSONB NOT NULL DEFAULT '[]',
    "goals_config" JSONB NOT NULL DEFAULT '{}',
    "commission_config" JSONB NOT NULL DEFAULT '{}',
    "automation_config" JSONB DEFAULT '{}',
    "settings" JSONB DEFAULT '{}',
    "start_date" DATE,
    "end_date" DATE,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."project_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_in_project" "projects"."ProjectRole" NOT NULL,
    "permissions" JSONB DEFAULT '{}',
    "assigned_by" UUID,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "auth"."users"("email");

-- CreateIndex
CREATE INDEX "users_idx_users_role" ON "auth"."users"("role");

-- CreateIndex
CREATE INDEX "sessions_idx_sessions_user" ON "auth"."sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_idx_sessions_expires" ON "auth"."sessions"("expires_at");

-- CreateIndex
CREATE INDEX "audit_log_idx_audit_user" ON "auth"."audit_log"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_idx_audit_action" ON "auth"."audit_log"("action", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"."projects"("slug");

-- CreateIndex
CREATE INDEX "projects_idx_projects_status" ON "projects"."projects"("status");

-- CreateIndex
CREATE INDEX "projects_idx_projects_director" ON "projects"."projects"("director_id");

-- CreateIndex
CREATE INDEX "project_users_idx_project_users_user" ON "projects"."project_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_users_project_id_user_id_key" ON "projects"."project_users"("project_id", "user_id");

-- AddForeignKey
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."invitations" ADD CONSTRAINT "invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_users" ADD CONSTRAINT "project_users_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

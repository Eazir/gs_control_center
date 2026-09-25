-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "integrations";

-- CreateEnum
CREATE TYPE "integrations"."ProviderType" AS ENUM ('HOTMART', 'CENTRALIZE', 'GHL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "integrations"."EventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'SKIPPED_BY_DATE', 'SKIPPED_UNKNOWN_PRODUCT', 'DUPLICATE');

-- CreateTable
CREATE TABLE "integrations"."integration_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "provider" "integrations"."ProviderType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "credentials_enc" TEXT,
    "valid_from" TIMESTAMPTZ,
    "ignore_subsequent" BOOLEAN NOT NULL DEFAULT true,
    "custom_settings" JSONB NOT NULL DEFAULT '{}',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations"."integration_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "provider" "integrations"."ProviderType" NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "integrations"."EventStatus" NOT NULL DEFAULT 'RECEIVED',
    "error_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,

    CONSTRAINT "integration_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integrations_idx_config_project" ON "integrations"."integration_configs"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_configs_project_id_provider_key" ON "integrations"."integration_configs"("project_id", "provider");

-- CreateIndex
CREATE INDEX "integrations_idx_events_project_status" ON "integrations"."integration_events"("project_id", "status");

-- CreateIndex
CREATE INDEX "integrations_idx_events_created" ON "integrations"."integration_events"("created_at");

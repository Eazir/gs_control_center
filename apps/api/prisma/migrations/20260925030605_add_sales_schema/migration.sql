-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "sales";

-- CreateTable
CREATE TABLE "sales"."leads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "pipeline_stage" TEXT NOT NULL DEFAULT 'new',
    "closer_id" UUID,
    "total_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales"."sales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "external_order_id" TEXT NOT NULL,
    "external_txn_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_id" TEXT,
    "status" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "payment_method" TEXT,
    "installments" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_project_id_closer_id_idx" ON "sales"."leads"("project_id", "closer_id");

-- CreateIndex
CREATE INDEX "leads_project_id_pipeline_stage_idx" ON "sales"."leads"("project_id", "pipeline_stage");

-- CreateIndex
CREATE UNIQUE INDEX "leads_project_id_email_key" ON "sales"."leads"("project_id", "email");

-- CreateIndex
CREATE INDEX "sales_project_id_status_idx" ON "sales"."sales"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_source_external_order_id_external_txn_id_key" ON "sales"."sales"("source", "external_order_id", "external_txn_id");

-- AddForeignKey
ALTER TABLE "sales"."sales" ADD CONSTRAINT "sales_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "sales"."leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

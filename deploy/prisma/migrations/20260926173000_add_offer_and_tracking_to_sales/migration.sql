-- AlterTable
ALTER TABLE "sales"."sales" 
ADD COLUMN IF NOT EXISTS "offer_code" TEXT,
ADD COLUMN IF NOT EXISTS "sck" TEXT,
ADD COLUMN IF NOT EXISTS "closer_id" UUID,
ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sales_project_id_closer_id_idx" ON "sales"."sales"("project_id", "closer_id");

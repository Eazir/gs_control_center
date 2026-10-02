-- CreateTable
CREATE TABLE "sales"."lead_interested_products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lead_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_interested_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_interested_products_lead_id_product_id_key" ON "sales"."lead_interested_products"("lead_id", "product_id");

-- AddForeignKey
ALTER TABLE "sales"."lead_interested_products" ADD CONSTRAINT "lead_interested_products_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "sales"."leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

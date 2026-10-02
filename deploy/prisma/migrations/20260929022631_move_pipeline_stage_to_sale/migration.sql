-- AlterTable
ALTER TABLE "sales"."sales" ADD COLUMN     "pipeline_stage" TEXT NOT NULL DEFAULT 'uncontacted',
ADD COLUMN     "pipeline_substatus" TEXT;

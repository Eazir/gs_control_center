-- AlterTable
ALTER TABLE "projects"."project_users" ADD COLUMN     "sck_codes" TEXT[] DEFAULT ARRAY[]::TEXT[];

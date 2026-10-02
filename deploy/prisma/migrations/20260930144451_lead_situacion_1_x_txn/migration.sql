-- CreateEnum
CREATE TYPE "sales"."LeadSituacion" AS ENUM ('POR_PAGAR', 'SEGUIMIENTO', 'NO_RESPONDE', 'NO_CALIFICA', 'YA_HABIA_ENTRADO', 'PAGO_COMPLETO', 'PAGO_A_CUOTAS', 'RESERVA', 'SIN_WSP');

-- DropIndex
DROP INDEX "sales"."leads_project_id_email_key";

-- AlterTable
ALTER TABLE "sales"."leads" ADD COLUMN     "situacion" "sales"."LeadSituacion";

-- Comentarios requeridos por AGENTS.md
COMMENT ON COLUMN "sales"."leads"."situacion" IS 'Estado de seguimiento y clasificación comercial del lead';

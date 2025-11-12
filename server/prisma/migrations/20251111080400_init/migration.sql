-- CreateEnum
CREATE TYPE "EnumDecisionComite" AS ENUM ('favorable', 'defavorable', 'autre');

-- DropIndex
DROP INDEX "procedures_portail_statut_idx";

-- DropIndex
DROP INDEX "procedures_portail_typeProcedureId_idx";

-- AlterTable
ALTER TABLE "coordonnee_portail" ADD COLUMN     "id_zone_interdite" INTEGER;

-- AddForeignKey
ALTER TABLE "notifications_portail" ADD CONSTRAINT "notifications_portail_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "experts_miniers_portail"("id_expert") ON DELETE SET NULL ON UPDATE CASCADE;

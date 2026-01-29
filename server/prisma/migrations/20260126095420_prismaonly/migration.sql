-- AlterTable
ALTER TABLE "utilisateurs_portail" ADD COLUMN     "detenteurId" INTEGER,
ADD COLUMN     "entreprise_verified" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "utilisateurs_portail" ADD CONSTRAINT "utilisateurs_portail_detenteurId_fkey" FOREIGN KEY ("detenteurId") REFERENCES "detenteurmorale"("id_detenteur") ON DELETE SET NULL ON UPDATE CASCADE;

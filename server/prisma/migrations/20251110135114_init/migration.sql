/*
  Warnings:

  - You are about to drop the column `idEntreprise` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `idInterne` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `creeLe` on the `dossiers_fournis_documents_portail` table. All the data in the column will be lost.
  - You are about to drop the column `modifieLe` on the `dossiers_fournis_documents_portail` table. All the data in the column will be lost.
  - You are about to drop the column `statut` on the `dossiers_fournis_documents_portail` table. All the data in the column will be lost.
  - You are about to drop the column `url_fichier` on the `dossiers_fournis_documents_portail` table. All the data in the column will be lost.
  - The primary key for the `dossiers_fournis_portail` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `dossiers_fournis_portail` table. All the data in the column will be lost.
  - You are about to drop the column `idInterne` on the `dossiers_fournis_portail` table. All the data in the column will be lost.
  - You are about to drop the column `mise_en_demeure` on the `dossiers_fournis_portail` table. All the data in the column will be lost.
  - You are about to drop the column `recevabilite` on the `dossiers_fournis_portail` table. All the data in the column will be lost.
  - You are about to drop the column `statut` on the `dossiers_fournis_portail` table. All the data in the column will be lost.
  - Added the required column `updated_at` to the `dossiers_fournis_documents_portail` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "demandes_portail" DROP CONSTRAINT "demandes_portail_idEntreprise_fkey";

-- DropForeignKey
ALTER TABLE "dossiers_fournis_documents_portail" DROP CONSTRAINT "dossiers_fournis_documents_portail_id_dossierFournis_fkey";

-- DropForeignKey
ALTER TABLE "paiements_portail" DROP CONSTRAINT "paiements_portail_idProcedure_fkey";

-- DropIndex
DROP INDEX "demandes_portail_idInterne_key";

-- DropIndex
DROP INDEX "dossiers_fournis_documents_portail_statut_idx";

-- DropIndex
DROP INDEX "dossiers_fournis_portail_idInterne_key";

-- DropIndex
DROP INDEX "dossiers_fournis_portail_statut_idx";

-- AlterTable
ALTER TABLE "demandes_portail" DROP COLUMN "idEntreprise",
DROP COLUMN "idInterne",
ADD COLUMN     "id_entreprise" INTEGER;

-- AlterTable
ALTER TABLE "dossiers_fournis_documents_portail" DROP COLUMN "creeLe",
DROP COLUMN "modifieLe",
DROP COLUMN "statut",
DROP COLUMN "url_fichier",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "file_url" VARCHAR(500),
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'MANQUANT',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "dossiers_fournis_portail" DROP CONSTRAINT "dossiers_fournis_portail_pkey",
DROP COLUMN "id",
DROP COLUMN "idInterne",
DROP COLUMN "mise_en_demeure",
DROP COLUMN "recevabilite",
DROP COLUMN "statut",
ADD COLUMN     "id_dossierFournis" SERIAL NOT NULL,
ADD COLUMN     "mise_en_demeure_envoyee" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recevabilite_doss" BOOLEAN,
ADD COLUMN     "statut_dossier" VARCHAR(50) NOT NULL DEFAULT 'EN_ATTENTE',
ADD CONSTRAINT "dossiers_fournis_portail_pkey" PRIMARY KEY ("id_dossierFournis");

-- CreateIndex
CREATE INDEX "dossiers_fournis_documents_portail_status_idx" ON "dossiers_fournis_documents_portail"("status");

-- CreateIndex
CREATE INDEX "dossiers_fournis_portail_statut_dossier_idx" ON "dossiers_fournis_portail"("statut_dossier");

-- AddForeignKey
ALTER TABLE "demandes_portail" ADD CONSTRAINT "demandes_portail_id_entreprise_fkey" FOREIGN KEY ("id_entreprise") REFERENCES "entreprises_portail"("id_entreprise") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers_fournis_documents_portail" ADD CONSTRAINT "dossiers_fournis_documents_portail_id_dossierFournis_fkey" FOREIGN KEY ("id_dossierFournis") REFERENCES "dossiers_fournis_portail"("id_dossierFournis") ON DELETE CASCADE ON UPDATE CASCADE;

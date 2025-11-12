/*
  Warnings:

  - You are about to drop the column `codePermis` on the `procedures_portail` table. All the data in the column will be lost.
  - You are about to drop the column `creeLe` on the `procedures_portail` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `procedures_portail` table. All the data in the column will be lost.
  - You are about to drop the column `idInterne` on the `procedures_portail` table. All the data in the column will be lost.
  - You are about to drop the column `idUtilisateur` on the `procedures_portail` table. All the data in the column will be lost.
  - You are about to drop the column `modifieLe` on the `procedures_portail` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `procedures_portail` table. All the data in the column will be lost.
  - You are about to drop the `documents_procedure_portail` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[num_proc]` on the table `procedures_portail` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `date_debut_proc` to the `procedures_portail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `num_proc` to the `procedures_portail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `statut_proc` to the `procedures_portail` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "documents_procedure_portail" DROP CONSTRAINT "documents_procedure_portail_idProcedure_fkey";

-- DropForeignKey
ALTER TABLE "procedures_portail" DROP CONSTRAINT "procedures_portail_idUtilisateur_fkey";

-- DropForeignKey
ALTER TABLE "procedures_portail" DROP CONSTRAINT "procedures_portail_typeProcedureId_fkey";

-- DropIndex
DROP INDEX "procedures_portail_codePermis_idx";

-- AlterTable
ALTER TABLE "procedures_portail" DROP COLUMN "codePermis",
DROP COLUMN "creeLe",
DROP COLUMN "description",
DROP COLUMN "idInterne",
DROP COLUMN "idUtilisateur",
DROP COLUMN "modifieLe",
DROP COLUMN "type",
ADD COLUMN     "date_debut_proc" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "date_fin_proc" TIMESTAMP(3),
ADD COLUMN     "num_proc" TEXT NOT NULL,
ADD COLUMN     "observations" TEXT,
ADD COLUMN     "resultat" TEXT,
ADD COLUMN     "statut_proc" "StatutProcedure" NOT NULL;

-- DropTable
DROP TABLE "documents_procedure_portail";

-- CreateIndex
CREATE UNIQUE INDEX "procedures_portail_num_proc_key" ON "procedures_portail"("num_proc");

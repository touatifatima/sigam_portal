/*
  Warnings:

  - You are about to drop the column `created_at` on the `Facture` table. All the data in the column will be lost.
  - You are about to drop the column `date_echeance` on the `Facture` table. All the data in the column will be lost.
  - You are about to drop the column `id_proc` on the `Facture` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `Facture` table. All the data in the column will be lost.
  - The `devise` column on the `Facture` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `statut` column on the `Facture` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[id_demande]` on the table `Facture` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `id_demande` to the `Facture` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StatutFacture" AS ENUM ('BROUILLON', 'EMISE', 'PAYEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "DeviseFacture" AS ENUM ('DZD', 'EUR', 'USD');

-- CreateEnum
CREATE TYPE "FactureType" AS ENUM ('INVESTISSEUR', 'OPERATEUR');

-- AlterTable
ALTER TABLE "Facture" DROP COLUMN "created_at",
DROP COLUMN "date_echeance",
DROP COLUMN "id_proc",
DROP COLUMN "updated_at",
ADD COLUMN     "id_demande" INTEGER NOT NULL,
ADD COLUMN     "type_facture" "FactureType" NOT NULL DEFAULT 'INVESTISSEUR',
DROP COLUMN "devise",
ADD COLUMN     "devise" "DeviseFacture" NOT NULL DEFAULT 'DZD',
DROP COLUMN "statut",
ADD COLUMN     "statut" "StatutFacture" NOT NULL DEFAULT 'BROUILLON';

-- CreateIndex
CREATE UNIQUE INDEX "Facture_id_demande_key" ON "Facture"("id_demande");

-- AddForeignKey
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_id_demande_fkey" FOREIGN KEY ("id_demande") REFERENCES "demande"("id_demande") ON DELETE CASCADE ON UPDATE CASCADE;

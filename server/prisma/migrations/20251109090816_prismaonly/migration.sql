/*
  Warnings:

  - The values [IGNORE] on the enum `MissingAction` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `taille_max` on the `documents_portail` table. All the data in the column will be lost.
  - You are about to drop the column `creeLe` on the `utilisateurs_portail` table. All the data in the column will be lost.
  - You are about to drop the column `motDePasse` on the `utilisateurs_portail` table. All the data in the column will be lost.
  - You are about to drop the column `nomComplet` on the `utilisateurs_portail` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[username]` on the table `utilisateurs_portail` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `taille_doc` to the `documents_portail` table without a default value. This is not possible if the table is not empty.
  - Made the column `description` on table `documents_portail` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `Prenom` to the `utilisateurs_portail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nom` to the `utilisateurs_portail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password` to the `utilisateurs_portail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `utilisateurs_portail` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MissingAction_new" AS ENUM ('BLOCK_NEXT', 'REJECT', 'WARNING');
ALTER TABLE "dossier_documents_portail" ALTER COLUMN "missing_action" DROP DEFAULT;
ALTER TABLE "dossier_documents_portail" ALTER COLUMN "missing_action" TYPE "MissingAction_new" USING ("missing_action"::text::"MissingAction_new");
ALTER TYPE "MissingAction" RENAME TO "MissingAction_old";
ALTER TYPE "MissingAction_new" RENAME TO "MissingAction";
DROP TYPE "MissingAction_old";
ALTER TABLE "dossier_documents_portail" ALTER COLUMN "missing_action" SET DEFAULT 'BLOCK_NEXT';
COMMIT;

-- DropForeignKey
ALTER TABLE "utilisateurs_portail" DROP CONSTRAINT "utilisateurs_portail_roleId_fkey";

-- AlterTable
ALTER TABLE "documents_portail" DROP COLUMN "taille_max",
ADD COLUMN     "taille_doc" TEXT NOT NULL,
ALTER COLUMN "nom_doc" SET DATA TYPE TEXT,
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "format" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "utilisateurs_portail" DROP COLUMN "creeLe",
DROP COLUMN "motDePasse",
DROP COLUMN "nomComplet",
ADD COLUMN     "Prenom" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "nom" TEXT NOT NULL,
ADD COLUMN     "password" TEXT NOT NULL,
ADD COLUMN     "username" TEXT NOT NULL,
ALTER COLUMN "roleId" DROP NOT NULL,
ALTER COLUMN "email" SET DATA TYPE TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_portail_username_key" ON "utilisateurs_portail"("username");

-- AddForeignKey
ALTER TABLE "utilisateurs_portail" ADD CONSTRAINT "utilisateurs_portail_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

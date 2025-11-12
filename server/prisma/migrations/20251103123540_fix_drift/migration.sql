/*
  Warnings:

  - You are about to drop the column `idRedevance` on the `substances` table. All the data in the column will be lost.
  - You are about to drop the column `libelle` on the `superficiaire_bareme` table. All the data in the column will be lost.
  - You are about to drop the column `montant` on the `superficiaire_bareme` table. All the data in the column will be lost.
  - You are about to drop the column `unite` on the `superficiaire_bareme` table. All the data in the column will be lost.
  - Added the required column `autre_renouv` to the `superficiaire_bareme` table without a default value. This is not possible if the table is not empty.
  - Added the required column `devise` to the `superficiaire_bareme` table without a default value. This is not possible if the table is not empty.
  - Added the required column `droit_fixe` to the `superficiaire_bareme` table without a default value. This is not possible if the table is not empty.
  - Added the required column `periode_initiale` to the `superficiaire_bareme` table without a default value. This is not possible if the table is not empty.
  - Added the required column `premier_renouv` to the `superficiaire_bareme` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "substances" DROP CONSTRAINT "substances_idRedevance_fkey";

-- AlterTable
ALTER TABLE "substances" DROP COLUMN "idRedevance",
ADD COLUMN     "id_redevance" INTEGER;

-- AlterTable
ALTER TABLE "superficiaire_bareme" DROP COLUMN "libelle",
DROP COLUMN "montant",
DROP COLUMN "unite",
ADD COLUMN     "autre_renouv" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "devise" TEXT NOT NULL,
ADD COLUMN     "droit_fixe" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "periode_initiale" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "premier_renouv" DOUBLE PRECISION NOT NULL;

-- AddForeignKey
ALTER TABLE "substances" ADD CONSTRAINT "substances_id_redevance_fkey" FOREIGN KEY ("id_redevance") REFERENCES "redevance_bareme"("id_redevance") ON DELETE SET NULL ON UPDATE CASCADE;

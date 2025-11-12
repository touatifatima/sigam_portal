/*
  Warnings:

  - Made the column `id_redevance` on table `substances` required. This step will fail if there are existing NULL values in that column.
  - Made the column `zone` on table `wilayas_portail` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "substances" DROP CONSTRAINT "substances_id_redevance_fkey";

-- AlterTable
ALTER TABLE "substances" ALTER COLUMN "id_redevance" SET NOT NULL;

-- AlterTable
ALTER TABLE "wilayas_portail" ALTER COLUMN "code_wilaya" SET DATA TYPE TEXT,
ALTER COLUMN "zone" SET NOT NULL,
ALTER COLUMN "zone" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "substances" ADD CONSTRAINT "substances_id_redevance_fkey" FOREIGN KEY ("id_redevance") REFERENCES "redevance_bareme"("id_redevance") ON DELETE RESTRICT ON UPDATE CASCADE;

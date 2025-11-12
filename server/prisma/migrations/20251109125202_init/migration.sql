/*
  Warnings:

  - You are about to drop the column `id_typeProcedure` on the `dossiers_administratifs_portail` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[id_typePermis,id_typeproc]` on the table `dossiers_administratifs_portail` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `id_typeproc` to the `dossiers_administratifs_portail` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "dossiers_administratifs_portail" DROP CONSTRAINT "dossiers_administratifs_portail_id_typeProcedure_fkey";

-- DropIndex
DROP INDEX "dossiers_administratifs_portail_id_typePermis_id_typeProced_key";

-- DropIndex
DROP INDEX "dossiers_administratifs_portail_id_typePermis_idx";

-- DropIndex
DROP INDEX "dossiers_administratifs_portail_id_typeProcedure_idx";

-- AlterTable
ALTER TABLE "audit_logs_portail" ADD COLUMN     "additionalData" JSONB,
ALTER COLUMN "contextId" SET DATA TYPE TEXT,
ALTER COLUMN "sessionId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "dossiers_administratifs_portail" DROP COLUMN "id_typeProcedure",
ADD COLUMN     "id_typeproc" INTEGER NOT NULL,
ALTER COLUMN "nombre_doc" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "dossiers_administratifs_portail_id_typePermis_id_typeproc_key" ON "dossiers_administratifs_portail"("id_typePermis", "id_typeproc");

-- AddForeignKey
ALTER TABLE "dossiers_administratifs_portail" ADD CONSTRAINT "dossiers_administratifs_portail_id_typeproc_fkey" FOREIGN KEY ("id_typeproc") REFERENCES "types_procedures_portail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

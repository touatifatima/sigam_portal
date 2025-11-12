/*
  Warnings:

  - You are about to drop the column `creeLe` on the `notifications_portail` table. All the data in the column will be lost.
  - You are about to drop the column `titre` on the `notifications_portail` table. All the data in the column will be lost.
  - You are about to drop the column `vu` on the `notifications_portail` table. All the data in the column will be lost.
  - Added the required column `title` to the `notifications_portail` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `notifications_portail` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropIndex
DROP INDEX "notifications_portail_idUtilisateur_idx";

-- DropIndex
DROP INDEX "notifications_portail_vu_idx";

-- AlterTable
ALTER TABLE "notifications_portail" DROP COLUMN "creeLe",
DROP COLUMN "titre",
DROP COLUMN "vu",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expertId" INTEGER,
ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'info',
ADD COLUMN     "relatedEntityId" INTEGER,
ADD COLUMN     "relatedEntityType" TEXT,
ADD COLUMN     "title" VARCHAR(255) NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL;

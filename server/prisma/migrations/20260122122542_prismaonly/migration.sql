-- CreateEnum
CREATE TYPE "PouvoirPersonnePhysique" AS ENUM ('MANDAT', 'PROCURATION');

-- AlterTable
ALTER TABLE "personnephysique" ADD COLUMN     "pouvoirs" "PouvoirPersonnePhysique";

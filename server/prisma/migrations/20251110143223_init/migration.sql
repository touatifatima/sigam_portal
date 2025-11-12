/*
  Warnings:

  - The values [REPRESENTANT,ACTIONNAIRE,REPRESENTANT_ACTIONNAIRE] on the enum `EnumTypeFonction` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EnumTypeFonction_new" AS ENUM ('Representant', 'Actionnaire', 'Representant_Actionnaire');
ALTER TABLE "fonction_personne_morale_portail" ALTER COLUMN "type_fonction" TYPE "EnumTypeFonction_new" USING ("type_fonction"::text::"EnumTypeFonction_new");
ALTER TYPE "EnumTypeFonction" RENAME TO "EnumTypeFonction_old";
ALTER TYPE "EnumTypeFonction_new" RENAME TO "EnumTypeFonction";
DROP TYPE "EnumTypeFonction_old";
COMMIT;

/*
  Warnings:

  - The primary key for the `demandes_portail` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `code` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `creeLe` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `idCommune` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `idDaira` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `idUtilisateur` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `idWilaya` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `lieuDitAr` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `lieuDitFr` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `modifieLe` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `occupantLegal` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `polygonGeo` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `statut` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `statutTerrain` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `superficieHa` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `titre` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `typePermisId` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `typeProcedureId` on the `demandes_portail` table. All the data in the column will be lost.
  - The primary key for the `inscription_provisoire_portail` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `inscription_provisoire_portail` table. All the data in the column will be lost.
  - You are about to drop the column `demandeOrigineId` on the `permis_portail` table. All the data in the column will be lost.
  - You are about to drop the column `idCommune` on the `permis_portail` table. All the data in the column will be lost.
  - You are about to drop the column `id_entreprise` on the `permis_portail` table. All the data in the column will be lost.
  - You are about to drop the column `statut_permis` on the `permis_portail` table. All the data in the column will be lost.
  - You are about to drop the column `typePermisId` on the `permis_portail` table. All the data in the column will be lost.
  - The primary key for the `procedures_portail` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `procedures_portail` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code_demande]` on the table `demandes_portail` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id_demande]` on the table `inscription_provisoire_portail` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `statut_demande` to the `demandes_portail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_demande` to the `inscription_provisoire_portail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `duree_validite` to the `permis_portail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_typePermis` to the `permis_portail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nombre_renouvellements` to the `permis_portail` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EnumTypeDetenteur" AS ENUM ('ANCIEN', 'NOUVEAU');

-- DropForeignKey
ALTER TABLE "_PermisProcedure" DROP CONSTRAINT "_PermisProcedure_B_fkey";

-- DropForeignKey
ALTER TABLE "cahiercharge" DROP CONSTRAINT "cahiercharge_demandeId_fkey";

-- DropForeignKey
ALTER TABLE "demFusion" DROP CONSTRAINT "demFusion_id_demande_fkey";

-- DropForeignKey
ALTER TABLE "demandes_portail" DROP CONSTRAINT "demandes_portail_idCommune_fkey";

-- DropForeignKey
ALTER TABLE "demandes_portail" DROP CONSTRAINT "demandes_portail_idDaira_fkey";

-- DropForeignKey
ALTER TABLE "demandes_portail" DROP CONSTRAINT "demandes_portail_idUtilisateur_fkey";

-- DropForeignKey
ALTER TABLE "demandes_portail" DROP CONSTRAINT "demandes_portail_idWilaya_fkey";

-- DropForeignKey
ALTER TABLE "demandes_portail" DROP CONSTRAINT "demandes_portail_typePermisId_fkey";

-- DropForeignKey
ALTER TABLE "demandes_portail" DROP CONSTRAINT "demandes_portail_typeProcedureId_fkey";

-- DropForeignKey
ALTER TABLE "documents_demande_portail" DROP CONSTRAINT "documents_demande_portail_idDemande_fkey";

-- DropForeignKey
ALTER TABLE "documents_procedure_portail" DROP CONSTRAINT "documents_procedure_portail_idProcedure_fkey";

-- DropForeignKey
ALTER TABLE "dossiers_fournis_portail" DROP CONSTRAINT "dossiers_fournis_portail_id_demande_fkey";

-- DropForeignKey
ALTER TABLE "historiques_portail" DROP CONSTRAINT "historiques_portail_idDemande_fkey";

-- DropForeignKey
ALTER TABLE "historiques_portail" DROP CONSTRAINT "historiques_portail_idProcedure_fkey";

-- DropForeignKey
ALTER TABLE "inscription_provisoire_portail" DROP CONSTRAINT "inscription_provisoire_portail_id_proc_fkey";

-- DropForeignKey
ALTER TABLE "interactions_wali_portail" DROP CONSTRAINT "interactions_wali_portail_id_procedure_fkey";

-- DropForeignKey
ALTER TABLE "paiements_portail" DROP CONSTRAINT "paiements_portail_idDemande_fkey";

-- DropForeignKey
ALTER TABLE "paiements_portail" DROP CONSTRAINT "paiements_portail_idProcedure_fkey";

-- DropForeignKey
ALTER TABLE "permis_portail" DROP CONSTRAINT "permis_portail_demandeOrigineId_fkey";

-- DropForeignKey
ALTER TABLE "permis_portail" DROP CONSTRAINT "permis_portail_idCommune_fkey";

-- DropForeignKey
ALTER TABLE "permis_portail" DROP CONSTRAINT "permis_portail_id_entreprise_fkey";

-- DropForeignKey
ALTER TABLE "permis_portail" DROP CONSTRAINT "permis_portail_typePermisId_fkey";

-- DropForeignKey
ALTER TABLE "procedure_coord_portail" DROP CONSTRAINT "procedure_coord_portail_id_proc_fkey";

-- DropForeignKey
ALTER TABLE "procedure_etape_portail" DROP CONSTRAINT "procedure_etape_portail_id_proc_fkey";

-- DropForeignKey
ALTER TABLE "procedure_phase_portail" DROP CONSTRAINT "procedure_phase_portail_id_proc_fkey";

-- DropForeignKey
ALTER TABLE "substance_associee_demande" DROP CONSTRAINT "substance_associee_demande_id_proc_fkey";

-- DropIndex
DROP INDEX "demandes_portail_code_idx";

-- DropIndex
DROP INDEX "demandes_portail_code_key";

-- DropIndex
DROP INDEX "demandes_portail_idCommune_idx";

-- DropIndex
DROP INDEX "demandes_portail_idDaira_idx";

-- DropIndex
DROP INDEX "demandes_portail_idEntreprise_idx";

-- DropIndex
DROP INDEX "demandes_portail_idUtilisateur_idx";

-- DropIndex
DROP INDEX "demandes_portail_idWilaya_idx";

-- DropIndex
DROP INDEX "demandes_portail_statut_idx";

-- DropIndex
DROP INDEX "demandes_portail_typePermisId_idx";

-- DropIndex
DROP INDEX "demandes_portail_typeProcedureId_idx";

-- DropIndex
DROP INDEX "permis_portail_code_permis_idx";

-- DropIndex
DROP INDEX "permis_portail_code_permis_key";

-- DropIndex
DROP INDEX "permis_portail_idCommune_idx";

-- DropIndex
DROP INDEX "permis_portail_typePermisId_idx";

-- DropIndex
DROP INDEX "utilisateurs_portail_deletedAt_idx";

-- DropIndex
DROP INDEX "utilisateurs_portail_email_idx";

-- DropIndex
DROP INDEX "utilisateurs_portail_roleId_idx";

-- AlterTable
ALTER TABLE "demandes_portail" DROP CONSTRAINT "demandes_portail_pkey",
DROP COLUMN "code",
DROP COLUMN "creeLe",
DROP COLUMN "id",
DROP COLUMN "idCommune",
DROP COLUMN "idDaira",
DROP COLUMN "idUtilisateur",
DROP COLUMN "idWilaya",
DROP COLUMN "lieuDitAr",
DROP COLUMN "lieuDitFr",
DROP COLUMN "modifieLe",
DROP COLUMN "occupantLegal",
DROP COLUMN "polygonGeo",
DROP COLUMN "statut",
DROP COLUMN "statutTerrain",
DROP COLUMN "superficieHa",
DROP COLUMN "titre",
DROP COLUMN "typePermisId",
DROP COLUMN "typeProcedureId",
ADD COLUMN     "AreaCat" DOUBLE PRECISION,
ADD COLUMN     "budget_prevu" DOUBLE PRECISION,
ADD COLUMN     "capital_social_disponible" DOUBLE PRECISION,
ADD COLUMN     "code_demande" TEXT,
ADD COLUMN     "con_res_exp" TEXT,
ADD COLUMN     "con_res_geo" TEXT,
ADD COLUMN     "date_demande" TIMESTAMP(3),
ADD COLUMN     "date_demarrage_prevue" TIMESTAMP(3),
ADD COLUMN     "date_fin_instruction" TIMESTAMP(3),
ADD COLUMN     "date_fin_ramassage" TIMESTAMP(3),
ADD COLUMN     "date_instruction" TIMESTAMP(3),
ADD COLUMN     "date_refus" TIMESTAMP(3),
ADD COLUMN     "description_travaux" TEXT,
ADD COLUMN     "destination" TEXT,
ADD COLUMN     "duree_travaux_estimee" TEXT,
ADD COLUMN     "id_commune" INTEGER,
ADD COLUMN     "id_daira" INTEGER,
ADD COLUMN     "id_demande" SERIAL NOT NULL,
ADD COLUMN     "id_expert" INTEGER,
ADD COLUMN     "id_proc" INTEGER,
ADD COLUMN     "id_typePermis" INTEGER,
ADD COLUMN     "id_typeProc" INTEGER,
ADD COLUMN     "id_wilaya" INTEGER,
ADD COLUMN     "intitule_projet" TEXT,
ADD COLUMN     "lieu_ditFR" TEXT,
ADD COLUMN     "lieu_dit_ar" TEXT,
ADD COLUMN     "locPointOrigine" TEXT,
ADD COLUMN     "montant_produit" TEXT,
ADD COLUMN     "num_enregist" TEXT,
ADD COLUMN     "occupant_terrain_legal" TEXT,
ADD COLUMN     "qualite_signataire" TEXT,
ADD COLUMN     "remarques" TEXT,
ADD COLUMN     "sources_financement" TEXT,
ADD COLUMN     "statut_demande" TEXT NOT NULL,
ADD COLUMN     "statut_juridique_terrain" TEXT,
ADD COLUMN     "superficie" DOUBLE PRECISION,
ADD COLUMN     "volume_prevu" TEXT,
ADD CONSTRAINT "demandes_portail_pkey" PRIMARY KEY ("id_demande");

-- AlterTable
ALTER TABLE "inscription_provisoire_portail" DROP CONSTRAINT "inscription_provisoire_portail_pkey",
DROP COLUMN "id",
ADD COLUMN     "id_demande" INTEGER NOT NULL,
ADD COLUMN     "id_i_p" SERIAL NOT NULL,
ALTER COLUMN "system" SET DATA TYPE TEXT,
ALTER COLUMN "hemisphere" SET DATA TYPE TEXT,
ADD CONSTRAINT "inscription_provisoire_portail_pkey" PRIMARY KEY ("id_i_p");

-- AlterTable
ALTER TABLE "permis_portail" DROP COLUMN "demandeOrigineId",
DROP COLUMN "idCommune",
DROP COLUMN "id_entreprise",
DROP COLUMN "statut_permis",
DROP COLUMN "typePermisId",
ADD COLUMN     "date_adjudication" TIMESTAMP(3),
ADD COLUMN     "date_annulation" TIMESTAMP(3),
ADD COLUMN     "date_conversion_permis" TIMESTAMP(3),
ADD COLUMN     "date_demarrage_travaux" TIMESTAMP(3),
ADD COLUMN     "date_renonciation" TIMESTAMP(3),
ADD COLUMN     "duree_prevue_travaux" TEXT,
ADD COLUMN     "duree_validite" INTEGER NOT NULL,
ADD COLUMN     "hypothec" TEXT,
ADD COLUMN     "id_commune" INTEGER,
ADD COLUMN     "id_detenteur" INTEGER,
ADD COLUMN     "id_typePermis" INTEGER NOT NULL,
ADD COLUMN     "invest_prevu" TEXT,
ADD COLUMN     "invest_real" TEXT,
ADD COLUMN     "mode_attribution" TEXT,
ADD COLUMN     "montant_offre" TEXT,
ADD COLUMN     "nom_projet" TEXT,
ADD COLUMN     "nombre_renouvellements" INTEGER NOT NULL,
ADD COLUMN     "statut_activites" TEXT,
ADD COLUMN     "statut_juridique_terrain" TEXT,
ADD COLUMN     "utilisation" TEXT,
ADD COLUMN     "volume_prevu" TEXT,
ALTER COLUMN "code_permis" SET DATA TYPE TEXT,
ALTER COLUMN "lieu_ditFR" SET DATA TYPE TEXT,
ALTER COLUMN "lieu_ditAR" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "procedures_portail" DROP CONSTRAINT "procedures_portail_pkey",
DROP COLUMN "id",
ADD COLUMN     "id_procedure" SERIAL NOT NULL,
ADD CONSTRAINT "procedures_portail_pkey" PRIMARY KEY ("id_procedure");

-- CreateTable
CREATE TABLE "ProcedureRenouvellement" (
    "id_renouvellement" SERIAL NOT NULL,
    "id_demande" INTEGER NOT NULL,
    "num_decision" TEXT,
    "date_decision" TIMESTAMP(3),
    "date_debut_validite" TIMESTAMP(3),
    "date_fin_validite" TIMESTAMP(3),
    "commentaire" TEXT,

    CONSTRAINT "ProcedureRenouvellement_pkey" PRIMARY KEY ("id_renouvellement")
);

-- CreateTable
CREATE TABLE "demFermeture" (
    "id_fermeture" SERIAL NOT NULL,
    "id_demande" INTEGER NOT NULL,
    "num_decision" TEXT,
    "date_constat" TIMESTAMP(3),
    "rapport" TEXT,

    CONSTRAINT "demFermeture_pkey" PRIMARY KEY ("id_fermeture")
);

-- CreateTable
CREATE TABLE "demAnnulation" (
    "id_annulation" SERIAL NOT NULL,
    "id_demande" INTEGER NOT NULL,
    "num_decision" TEXT,
    "date_constat" TIMESTAMP(3),
    "date_annulation" TIMESTAMP(3),
    "cause_annulation" TEXT,
    "statut_annulation" TEXT,

    CONSTRAINT "demAnnulation_pkey" PRIMARY KEY ("id_annulation")
);

-- CreateTable
CREATE TABLE "demSubstitution" (
    "id_substitution" SERIAL NOT NULL,
    "id_demande" INTEGER NOT NULL,
    "num_decision" TEXT,
    "date_decision" TIMESTAMP(3),
    "motif_substitution" TEXT,
    "commentaires" TEXT,

    CONSTRAINT "demSubstitution_pkey" PRIMARY KEY ("id_substitution")
);

-- CreateTable
CREATE TABLE "demModification" (
    "id_modification" SERIAL NOT NULL,
    "id_demande" INTEGER NOT NULL,
    "type_modif" TEXT,
    "statut_modification" TEXT,

    CONSTRAINT "demModification_pkey" PRIMARY KEY ("id_modification")
);

-- CreateTable
CREATE TABLE "demCession" (
    "id_cession" SERIAL NOT NULL,
    "id_demande" INTEGER NOT NULL,
    "id_ancienCessionnaire" INTEGER NOT NULL,
    "id_nouveauCessionnaire" INTEGER NOT NULL,
    "motif_cession" TEXT,
    "nature_cession" TEXT,
    "taux_cession" DOUBLE PRECISION,
    "date_validation" TIMESTAMP(3),

    CONSTRAINT "demCession_pkey" PRIMARY KEY ("id_cession")
);

-- CreateTable
CREATE TABLE "demRenonciation" (
    "id_renonciation" SERIAL NOT NULL,
    "id_demande" INTEGER NOT NULL,
    "motif_renonciation" TEXT,
    "rapport_technique" TEXT,

    CONSTRAINT "demRenonciation_pkey" PRIMARY KEY ("id_renonciation")
);

-- CreateTable
CREATE TABLE "demTransfert" (
    "id_transfert" SERIAL NOT NULL,
    "id_demande" INTEGER NOT NULL,
    "motif_transfert" TEXT,
    "observations" TEXT,
    "date_transfert" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demTransfert_pkey" PRIMARY KEY ("id_transfert")
);

-- CreateTable
CREATE TABLE "transfert_detenteur" (
    "id" SERIAL NOT NULL,
    "id_transfert" INTEGER NOT NULL,
    "id_detenteur" INTEGER,
    "type_detenteur" "EnumTypeDetenteur" NOT NULL,
    "role" TEXT,
    "date_enregistrement" TIMESTAMP(3),

    CONSTRAINT "transfert_detenteur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demandeVerificationGeo" (
    "id_demVerif" SERIAL NOT NULL,
    "id_demande" INTEGER NOT NULL,
    "sit_geo_ok" BOOLEAN,
    "empiet_ok" BOOLEAN,
    "superf_ok" BOOLEAN,
    "geom_ok" BOOLEAN,
    "verification_cadastrale_ok" BOOLEAN,
    "superficie_cadastrale" DOUBLE PRECISION,

    CONSTRAINT "demandeVerificationGeo_pkey" PRIMARY KEY ("id_demVerif")
);

-- CreateTable
CREATE TABLE "demandeObs" (
    "id_demandeObs" SERIAL NOT NULL,
    "id_demande" INTEGER NOT NULL,
    "obs_situation_geo" TEXT,
    "obs_empietement" TEXT,
    "obs_emplacement" TEXT,
    "obs_geom" TEXT,
    "obs_superficie" TEXT,

    CONSTRAINT "demandeObs_pkey" PRIMARY KEY ("id_demandeObs")
);

-- CreateTable
CREATE TABLE "demandeMin" (
    "id_demMin" SERIAL NOT NULL,
    "id_demande" INTEGER NOT NULL,
    "min_label" TEXT,
    "min_teneur" DOUBLE PRECISION,
    "ordre_mineral" TEXT,

    CONSTRAINT "demandeMin_pkey" PRIMARY KEY ("id_demMin")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcedureRenouvellement_id_demande_key" ON "ProcedureRenouvellement"("id_demande");

-- CreateIndex
CREATE UNIQUE INDEX "demFermeture_id_demande_key" ON "demFermeture"("id_demande");

-- CreateIndex
CREATE UNIQUE INDEX "demAnnulation_id_demande_key" ON "demAnnulation"("id_demande");

-- CreateIndex
CREATE UNIQUE INDEX "demSubstitution_id_demande_key" ON "demSubstitution"("id_demande");

-- CreateIndex
CREATE UNIQUE INDEX "demModification_id_demande_key" ON "demModification"("id_demande");

-- CreateIndex
CREATE UNIQUE INDEX "demCession_id_demande_key" ON "demCession"("id_demande");

-- CreateIndex
CREATE UNIQUE INDEX "demRenonciation_id_demande_key" ON "demRenonciation"("id_demande");

-- CreateIndex
CREATE UNIQUE INDEX "demTransfert_id_demande_key" ON "demTransfert"("id_demande");

-- CreateIndex
CREATE UNIQUE INDEX "demandeVerificationGeo_id_demande_key" ON "demandeVerificationGeo"("id_demande");

-- CreateIndex
CREATE UNIQUE INDEX "demandeObs_id_demande_key" ON "demandeObs"("id_demande");

-- CreateIndex
CREATE UNIQUE INDEX "demandeMin_id_demande_key" ON "demandeMin"("id_demande");

-- CreateIndex
CREATE UNIQUE INDEX "demandes_portail_code_demande_key" ON "demandes_portail"("code_demande");

-- CreateIndex
CREATE UNIQUE INDEX "inscription_provisoire_portail_id_demande_key" ON "inscription_provisoire_portail"("id_demande");

-- AddForeignKey
ALTER TABLE "demandes_portail" ADD CONSTRAINT "demandes_portail_id_commune_fkey" FOREIGN KEY ("id_commune") REFERENCES "communes_portail"("id_commune") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_portail" ADD CONSTRAINT "demandes_portail_id_daira_fkey" FOREIGN KEY ("id_daira") REFERENCES "dairas_portail"("id_daira") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_portail" ADD CONSTRAINT "demandes_portail_id_proc_fkey" FOREIGN KEY ("id_proc") REFERENCES "procedures_portail"("id_procedure") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_portail" ADD CONSTRAINT "demandes_portail_id_wilaya_fkey" FOREIGN KEY ("id_wilaya") REFERENCES "wilayas_portail"("id_wilaya") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_portail" ADD CONSTRAINT "demandes_portail_id_expert_fkey" FOREIGN KEY ("id_expert") REFERENCES "experts_miniers_portail"("id_expert") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_portail" ADD CONSTRAINT "demandes_portail_id_typePermis_fkey" FOREIGN KEY ("id_typePermis") REFERENCES "typepermis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_portail" ADD CONSTRAINT "demandes_portail_id_typeProc_fkey" FOREIGN KEY ("id_typeProc") REFERENCES "types_procedures_portail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureRenouvellement" ADD CONSTRAINT "ProcedureRenouvellement_id_demande_fkey" FOREIGN KEY ("id_demande") REFERENCES "demandes_portail"("id_demande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demFermeture" ADD CONSTRAINT "demFermeture_id_demande_fkey" FOREIGN KEY ("id_demande") REFERENCES "demandes_portail"("id_demande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demAnnulation" ADD CONSTRAINT "demAnnulation_id_demande_fkey" FOREIGN KEY ("id_demande") REFERENCES "demandes_portail"("id_demande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demSubstitution" ADD CONSTRAINT "demSubstitution_id_demande_fkey" FOREIGN KEY ("id_demande") REFERENCES "demandes_portail"("id_demande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demModification" ADD CONSTRAINT "demModification_id_demande_fkey" FOREIGN KEY ("id_demande") REFERENCES "demandes_portail"("id_demande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demCession" ADD CONSTRAINT "demCession_id_demande_fkey" FOREIGN KEY ("id_demande") REFERENCES "demandes_portail"("id_demande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demCession" ADD CONSTRAINT "demCession_id_ancienCessionnaire_fkey" FOREIGN KEY ("id_ancienCessionnaire") REFERENCES "personnes_physiques_portail"("id_personne") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demCession" ADD CONSTRAINT "demCession_id_nouveauCessionnaire_fkey" FOREIGN KEY ("id_nouveauCessionnaire") REFERENCES "personnes_physiques_portail"("id_personne") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demRenonciation" ADD CONSTRAINT "demRenonciation_id_demande_fkey" FOREIGN KEY ("id_demande") REFERENCES "demandes_portail"("id_demande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demFusion" ADD CONSTRAINT "demFusion_id_demande_fkey" FOREIGN KEY ("id_demande") REFERENCES "demandes_portail"("id_demande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demTransfert" ADD CONSTRAINT "demTransfert_id_demande_fkey" FOREIGN KEY ("id_demande") REFERENCES "demandes_portail"("id_demande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfert_detenteur" ADD CONSTRAINT "transfert_detenteur_id_transfert_fkey" FOREIGN KEY ("id_transfert") REFERENCES "demTransfert"("id_transfert") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfert_detenteur" ADD CONSTRAINT "transfert_detenteur_id_detenteur_fkey" FOREIGN KEY ("id_detenteur") REFERENCES "entreprises_portail"("id_entreprise") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandeVerificationGeo" ADD CONSTRAINT "demandeVerificationGeo_id_demande_fkey" FOREIGN KEY ("id_demande") REFERENCES "demandes_portail"("id_demande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandeObs" ADD CONSTRAINT "demandeObs_id_demande_fkey" FOREIGN KEY ("id_demande") REFERENCES "demandes_portail"("id_demande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandeMin" ADD CONSTRAINT "demandeMin_id_demande_fkey" FOREIGN KEY ("id_demande") REFERENCES "demandes_portail"("id_demande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permis_portail" ADD CONSTRAINT "permis_portail_id_typePermis_fkey" FOREIGN KEY ("id_typePermis") REFERENCES "typepermis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permis_portail" ADD CONSTRAINT "permis_portail_id_commune_fkey" FOREIGN KEY ("id_commune") REFERENCES "communes_portail"("id_commune") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permis_portail" ADD CONSTRAINT "permis_portail_id_detenteur_fkey" FOREIGN KEY ("id_detenteur") REFERENCES "entreprises_portail"("id_entreprise") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cahiercharge" ADD CONSTRAINT "cahiercharge_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "demandes_portail"("id_demande") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers_fournis_portail" ADD CONSTRAINT "dossiers_fournis_portail_id_demande_fkey" FOREIGN KEY ("id_demande") REFERENCES "demandes_portail"("id_demande") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_phase_portail" ADD CONSTRAINT "procedure_phase_portail_id_proc_fkey" FOREIGN KEY ("id_proc") REFERENCES "procedures_portail"("id_procedure") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_etape_portail" ADD CONSTRAINT "procedure_etape_portail_id_proc_fkey" FOREIGN KEY ("id_proc") REFERENCES "procedures_portail"("id_procedure") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substance_associee_demande" ADD CONSTRAINT "substance_associee_demande_id_proc_fkey" FOREIGN KEY ("id_proc") REFERENCES "procedures_portail"("id_procedure") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents_demande_portail" ADD CONSTRAINT "documents_demande_portail_idDemande_fkey" FOREIGN KEY ("idDemande") REFERENCES "demandes_portail"("id_demande") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents_procedure_portail" ADD CONSTRAINT "documents_procedure_portail_idProcedure_fkey" FOREIGN KEY ("idProcedure") REFERENCES "procedures_portail"("id_procedure") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_coord_portail" ADD CONSTRAINT "procedure_coord_portail_id_proc_fkey" FOREIGN KEY ("id_proc") REFERENCES "procedures_portail"("id_procedure") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscription_provisoire_portail" ADD CONSTRAINT "inscription_provisoire_portail_id_i_p_fkey" FOREIGN KEY ("id_i_p") REFERENCES "procedures_portail"("id_procedure") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscription_provisoire_portail" ADD CONSTRAINT "inscription_provisoire_portail_id_demande_fkey" FOREIGN KEY ("id_demande") REFERENCES "demandes_portail"("id_demande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions_wali_portail" ADD CONSTRAINT "interactions_wali_portail_id_procedure_fkey" FOREIGN KEY ("id_procedure") REFERENCES "procedures_portail"("id_procedure") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_portail" ADD CONSTRAINT "paiements_portail_idDemande_fkey" FOREIGN KEY ("idDemande") REFERENCES "demandes_portail"("id_demande") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_portail" ADD CONSTRAINT "paiements_portail_idProcedure_fkey" FOREIGN KEY ("idProcedure") REFERENCES "procedures_portail"("id_procedure") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historiques_portail" ADD CONSTRAINT "historiques_portail_idDemande_fkey" FOREIGN KEY ("idDemande") REFERENCES "demandes_portail"("id_demande") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historiques_portail" ADD CONSTRAINT "historiques_portail_idProcedure_fkey" FOREIGN KEY ("idProcedure") REFERENCES "procedures_portail"("id_procedure") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermisProcedure" ADD CONSTRAINT "_PermisProcedure_B_fkey" FOREIGN KEY ("B") REFERENCES "procedures_portail"("id_procedure") ON DELETE CASCADE ON UPDATE CASCADE;

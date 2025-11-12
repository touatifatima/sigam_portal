/*
  Warnings:

  - The values [scheduler] on the enum `StatutDemande` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `commune` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `daira` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `typePermis` on the `demandes_portail` table. All the data in the column will be lost.
  - You are about to drop the column `wilaya` on the `demandes_portail` table. All the data in the column will be lost.
  - The primary key for the `entreprises_portail` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id_detenteur` on the `entreprises_portail` table. All the data in the column will be lost.
  - The primary key for the `fonction_personne_morale_portail` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id_detenteur` on the `fonction_personne_morale_portail` table. All the data in the column will be lost.
  - You are about to drop the column `typePermis` on the `permis_portail` table. All the data in the column will be lost.
  - You are about to drop the column `id_detenteur` on the `registre_commerce_portail` table. All the data in the column will be lost.
  - You are about to drop the `entreprise_permis` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `substance_associee_demande_portail` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `substances_portail` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[idInterne]` on the table `demandes_portail` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `id_entreprise` to the `fonction_personne_morale_portail` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `procedures_portail` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "TypeProcedureEnum" AS ENUM ('DEMANDE', 'RENOUVELLEMENT', 'TRANSFERT', 'CESSION', 'AMODIATION', 'RENONCIATION', 'AUTRE');

-- CreateEnum
CREATE TYPE "MissingAction" AS ENUM ('BLOCK_NEXT', 'WARNING', 'IGNORE');

-- CreateEnum
CREATE TYPE "EnumTypeInteraction" AS ENUM ('ENVOI', 'REPONSE', 'RELANCE');

-- CreateEnum
CREATE TYPE "EnumAvisWali" AS ENUM ('EN_ATTENTE', 'FAVORABLE', 'DEFAVORABLE');

-- CreateEnum
CREATE TYPE "StatutProcedure" AS ENUM ('EN_COURS', 'TERMINEE', 'EN_ATTENTE');

-- CreateEnum
CREATE TYPE "EnumStatutPaiement" AS ENUM ('A_payer', 'Paye', 'En_retard', 'Annule', 'Partiellement_paye');

-- AlterEnum
BEGIN;
CREATE TYPE "StatutDemande_new" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'VALIDEE', 'REFUSEE', 'SUSPENDUE');
ALTER TABLE "demandes_portail" ALTER COLUMN "statut" DROP DEFAULT;
ALTER TABLE "procedures_portail" ALTER COLUMN "statut" DROP DEFAULT;
ALTER TABLE "demandes_portail" ALTER COLUMN "statut" TYPE "StatutDemande_new" USING ("statut"::text::"StatutDemande_new");
ALTER TABLE "procedures_portail" ALTER COLUMN "statut" TYPE "StatutDemande_new" USING ("statut"::text::"StatutDemande_new");
ALTER TYPE "StatutDemande" RENAME TO "StatutDemande_old";
ALTER TYPE "StatutDemande_new" RENAME TO "StatutDemande";
DROP TYPE "StatutDemande_old";
ALTER TABLE "demandes_portail" ALTER COLUMN "statut" SET DEFAULT 'EN_ATTENTE';
ALTER TABLE "procedures_portail" ALTER COLUMN "statut" SET DEFAULT 'EN_ATTENTE';
COMMIT;

-- DropForeignKey
ALTER TABLE "demandes_portail" DROP CONSTRAINT "demandes_portail_idEntreprise_fkey";

-- DropForeignKey
ALTER TABLE "entreprise_permis" DROP CONSTRAINT "entreprise_permis_entrepriseId_fkey";

-- DropForeignKey
ALTER TABLE "entreprise_permis" DROP CONSTRAINT "entreprise_permis_permisId_fkey";

-- DropForeignKey
ALTER TABLE "fonction_personne_morale_portail" DROP CONSTRAINT "fonction_personne_morale_portail_id_detenteur_fkey";

-- DropForeignKey
ALTER TABLE "registre_commerce_portail" DROP CONSTRAINT "registre_commerce_portail_id_detenteur_fkey";

-- DropForeignKey
ALTER TABLE "substance_associee_demande_portail" DROP CONSTRAINT "substance_associee_demande_portail_id_proc_fkey";

-- DropForeignKey
ALTER TABLE "substance_associee_demande_portail" DROP CONSTRAINT "substance_associee_demande_portail_id_substance_fkey";

-- AlterTable
ALTER TABLE "demandes_portail" DROP COLUMN "commune",
DROP COLUMN "daira",
DROP COLUMN "typePermis",
DROP COLUMN "wilaya",
ADD COLUMN     "idCommune" INTEGER,
ADD COLUMN     "idDaira" INTEGER,
ADD COLUMN     "idWilaya" INTEGER,
ADD COLUMN     "typePermisId" INTEGER,
ADD COLUMN     "typeProcedureId" INTEGER;

-- AlterTable
ALTER TABLE "entreprises_portail" DROP CONSTRAINT "entreprises_portail_pkey",
DROP COLUMN "id_detenteur",
ADD COLUMN     "id_entreprise" SERIAL NOT NULL,
ADD CONSTRAINT "entreprises_portail_pkey" PRIMARY KEY ("id_entreprise");

-- AlterTable
ALTER TABLE "fonction_personne_morale_portail" DROP CONSTRAINT "fonction_personne_morale_portail_pkey",
DROP COLUMN "id_detenteur",
ADD COLUMN     "id_entreprise" INTEGER NOT NULL,
ADD CONSTRAINT "fonction_personne_morale_portail_pkey" PRIMARY KEY ("id_entreprise", "id_personne");

-- AlterTable
ALTER TABLE "permis_portail" DROP COLUMN "typePermis",
ADD COLUMN     "idCommune" INTEGER,
ADD COLUMN     "id_entreprise" INTEGER,
ADD COLUMN     "id_statut" INTEGER,
ADD COLUMN     "typePermisId" INTEGER;

-- AlterTable
ALTER TABLE "procedures_portail" ADD COLUMN     "typeProcedureId" INTEGER,
DROP COLUMN "type",
ADD COLUMN     "type" "TypeProcedureEnum" NOT NULL;

-- AlterTable
ALTER TABLE "registre_commerce_portail" DROP COLUMN "id_detenteur",
ADD COLUMN     "id_entreprise" INTEGER;

-- DropTable
DROP TABLE "entreprise_permis";

-- DropTable
DROP TABLE "substance_associee_demande_portail";

-- DropTable
DROP TABLE "substances_portail";

-- DropEnum
DROP TYPE "TypeProcedure";

-- CreateTable
CREATE TABLE "antennes_portail" (
    "id_antenne" SERIAL NOT NULL,
    "nom" VARCHAR(255) NOT NULL,
    "localisation" TEXT,

    CONSTRAINT "antennes_portail_pkey" PRIMARY KEY ("id_antenne")
);

-- CreateTable
CREATE TABLE "wilayas_portail" (
    "id_wilaya" SERIAL NOT NULL,
    "id_antenne" INTEGER NOT NULL,
    "code_wilaya" VARCHAR(10) NOT NULL,
    "nom_wilayaFR" VARCHAR(100) NOT NULL,
    "nom_wilayaAR" VARCHAR(100) NOT NULL,
    "zone" VARCHAR(50),

    CONSTRAINT "wilayas_portail_pkey" PRIMARY KEY ("id_wilaya")
);

-- CreateTable
CREATE TABLE "dairas_portail" (
    "id_daira" SERIAL NOT NULL,
    "id_wilaya" INTEGER NOT NULL,
    "nom_dairaFR" VARCHAR(100) NOT NULL,
    "nom_dairaAR" VARCHAR(100) NOT NULL,

    CONSTRAINT "dairas_portail_pkey" PRIMARY KEY ("id_daira")
);

-- CreateTable
CREATE TABLE "communes_portail" (
    "id_commune" SERIAL NOT NULL,
    "id_daira" INTEGER,
    "nom_communeFR" VARCHAR(100) NOT NULL,
    "nom_communeAR" VARCHAR(100) NOT NULL,
    "nature" VARCHAR(50),

    CONSTRAINT "communes_portail_pkey" PRIMARY KEY ("id_commune")
);

-- CreateTable
CREATE TABLE "typepermis" (
    "id" SERIAL NOT NULL,
    "id_taxe" INTEGER NOT NULL,
    "lib_type" VARCHAR(255) NOT NULL,
    "code_type" VARCHAR(20) NOT NULL,
    "regime" VARCHAR(50) NOT NULL,
    "duree_initiale" DOUBLE PRECISION NOT NULL,
    "nbr_renouv_max" INTEGER NOT NULL,
    "duree_renouv" DOUBLE PRECISION NOT NULL,
    "delai_renouv" INTEGER NOT NULL,
    "superficie_max" DOUBLE PRECISION,

    CONSTRAINT "typepermis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "superficiaire_bareme" (
    "id" SERIAL NOT NULL,
    "libelle" VARCHAR(255) NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "unite" VARCHAR(20) NOT NULL DEFAULT 'DZD/ha',

    CONSTRAINT "superficiaire_bareme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barem_produit_droit" (
    "id" SERIAL NOT NULL,
    "montant_droit_etab" DOUBLE PRECISION NOT NULL,
    "produit_attribution" DOUBLE PRECISION NOT NULL,
    "typePermisId" INTEGER NOT NULL,
    "typeProcedureId" INTEGER NOT NULL,

    CONSTRAINT "barem_produit_droit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permis_templates" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "elements" JSONB NOT NULL,
    "typePermisId" INTEGER NOT NULL,
    "permisId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "permis_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demFusion" (
    "id_fusion" SERIAL NOT NULL,
    "id_demande" INTEGER NOT NULL,
    "id_permisResultant" INTEGER NOT NULL,
    "date_fusion" TIMESTAMP(3) NOT NULL,
    "motif_fusion" TEXT,
    "statut_fusion" TEXT,

    CONSTRAINT "demFusion_pkey" PRIMARY KEY ("id_fusion")
);

-- CreateTable
CREATE TABLE "fusionPermisSource" (
    "id_permis" INTEGER NOT NULL,
    "id_fusion" INTEGER NOT NULL,

    CONSTRAINT "fusionPermisSource_pkey" PRIMARY KEY ("id_permis","id_fusion")
);

-- CreateTable
CREATE TABLE "codeAssimilation" (
    "id_code" SERIAL NOT NULL,
    "id_ancienType" INTEGER NOT NULL,
    "id_permis" INTEGER NOT NULL,
    "ancien_code" TEXT NOT NULL,

    CONSTRAINT "codeAssimilation_pkey" PRIMARY KEY ("id_code")
);

-- CreateTable
CREATE TABLE "AncienTypePermis" (
    "id_ancienType" SERIAL NOT NULL,
    "lib_type" TEXT NOT NULL,
    "code_type" TEXT NOT NULL,

    CONSTRAINT "AncienTypePermis_pkey" PRIMARY KEY ("id_ancienType")
);

-- CreateTable
CREATE TABLE "cahiercharge" (
    "id" SERIAL NOT NULL,
    "permisId" INTEGER,
    "demandeId" INTEGER,
    "num_cdc" TEXT NOT NULL,
    "date_etablissement" TIMESTAMP(3) NOT NULL,
    "dateExercice" TIMESTAMP(3) NOT NULL,
    "lieu_signature" TEXT NOT NULL,
    "signataire_administration" TEXT NOT NULL,
    "fuseau" TEXT,
    "typeCoordonnees" TEXT,
    "version" TEXT,
    "natureJuridique" TEXT,
    "vocationTerrain" TEXT,
    "nomGerant" TEXT,
    "personneChargeTrxx" TEXT,
    "qualification" TEXT,
    "reservesGeologiques" DOUBLE PRECISION,
    "reservesExploitables" DOUBLE PRECISION,
    "volumeExtraction" DOUBLE PRECISION,
    "dureeExploitation" INTEGER,
    "methodeExploitation" TEXT,
    "dureeTravaux" INTEGER,
    "dateDebutTravaux" TIMESTAMP(3),
    "dateDebutProduction" TIMESTAMP(3),
    "investissementDA" DOUBLE PRECISION,
    "investissementUSD" DOUBLE PRECISION,
    "capaciteInstallee" DOUBLE PRECISION,
    "commentaires" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cahiercharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatutPermis" (
    "id" SERIAL NOT NULL,
    "lib_statut" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "StatutPermis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents_portail" (
    "id_doc" SERIAL NOT NULL,
    "nom_doc" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "format" VARCHAR(20) NOT NULL,
    "taille_max" INTEGER,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_portail_pkey" PRIMARY KEY ("id_doc")
);

-- CreateTable
CREATE TABLE "dossiers_administratifs_portail" (
    "id_dossier" SERIAL NOT NULL,
    "id_typePermis" INTEGER NOT NULL,
    "id_typeProcedure" INTEGER,
    "nombre_doc" INTEGER NOT NULL DEFAULT 0,
    "remarques" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dossiers_administratifs_portail_pkey" PRIMARY KEY ("id_dossier")
);

-- CreateTable
CREATE TABLE "dossier_documents_portail" (
    "id_dossier" INTEGER NOT NULL,
    "id_doc" INTEGER NOT NULL,
    "is_obligatoire" BOOLEAN NOT NULL DEFAULT true,
    "missing_action" "MissingAction" NOT NULL DEFAULT 'BLOCK_NEXT',
    "reject_message" VARCHAR(500),

    CONSTRAINT "dossier_documents_portail_pkey" PRIMARY KEY ("id_dossier","id_doc")
);

-- CreateTable
CREATE TABLE "dossiers_fournis_portail" (
    "id" SERIAL NOT NULL,
    "idInterne" INTEGER,
    "id_demande" INTEGER NOT NULL,
    "date_depot" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recevabilite" BOOLEAN,
    "statut" VARCHAR(50) NOT NULL DEFAULT 'EN_ATTENTE',
    "remarques" TEXT,
    "numero_accuse" VARCHAR(100),
    "date_accuse" TIMESTAMP(3),
    "numero_recepisse" VARCHAR(100),
    "date_recepisse" TIMESTAMP(3),
    "mise_en_demeure" BOOLEAN NOT NULL DEFAULT false,
    "date_mise_en_demeure" TIMESTAMP(3),
    "pieces_manquantes" JSONB,
    "verification_phase" VARCHAR(100),
    "date_preannotation" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dossiers_fournis_portail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossiers_fournis_documents_portail" (
    "id_dossierFournis" INTEGER NOT NULL,
    "id_doc" INTEGER NOT NULL,
    "statut" VARCHAR(20) NOT NULL DEFAULT 'MANQUANT',
    "url_fichier" VARCHAR(500),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dossiers_fournis_documents_portail_pkey" PRIMARY KEY ("id_dossierFournis","id_doc")
);

-- CreateTable
CREATE TABLE "types_procedures_portail" (
    "id" SERIAL NOT NULL,
    "libelle" VARCHAR(150),
    "description" TEXT,

    CONSTRAINT "types_procedures_portail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phases_portail" (
    "id_phase" SERIAL NOT NULL,
    "libelle" VARCHAR(255) NOT NULL,
    "ordre" INTEGER NOT NULL,
    "description" TEXT,
    "dureeEstimee" INTEGER,
    "typeProcedureId" INTEGER,

    CONSTRAINT "phases_portail_pkey" PRIMARY KEY ("id_phase")
);

-- CreateTable
CREATE TABLE "etapes_proc_portail" (
    "id_etape" SERIAL NOT NULL,
    "lib_etape" VARCHAR(255) NOT NULL,
    "duree_etape" INTEGER,
    "ordre_etape" INTEGER NOT NULL,
    "id_phase" INTEGER NOT NULL,

    CONSTRAINT "etapes_proc_portail_pkey" PRIMARY KEY ("id_etape")
);

-- CreateTable
CREATE TABLE "procedure_phase_portail" (
    "id_proc" INTEGER NOT NULL,
    "id_phase" INTEGER NOT NULL,
    "ordre" INTEGER NOT NULL,
    "statut" "StatutProcedure",

    CONSTRAINT "procedure_phase_portail_pkey" PRIMARY KEY ("id_proc","id_phase")
);

-- CreateTable
CREATE TABLE "procedure_etape_portail" (
    "id_proc" INTEGER NOT NULL,
    "id_etape" INTEGER NOT NULL,
    "statut" "StatutProcedure" NOT NULL,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3),
    "link" TEXT,

    CONSTRAINT "procedure_etape_portail_pkey" PRIMARY KEY ("id_proc","id_etape")
);

-- CreateTable
CREATE TABLE "substances" (
    "id_sub" SERIAL NOT NULL,
    "nom_subFR" VARCHAR(150) NOT NULL,
    "nom_subAR" VARCHAR(150),
    "categorie_sub" VARCHAR(100),
    "famille_sub" VARCHAR(100),
    "idRedevance" INTEGER,

    CONSTRAINT "substances_pkey" PRIMARY KEY ("id_sub")
);

-- CreateTable
CREATE TABLE "redevance_bareme" (
    "id_redevance" SERIAL NOT NULL,
    "taux_redevance" DOUBLE PRECISION NOT NULL,
    "valeur_marchande" DOUBLE PRECISION NOT NULL,
    "unite" VARCHAR(20) NOT NULL,
    "devise" VARCHAR(10) NOT NULL,
    "description" TEXT,

    CONSTRAINT "redevance_bareme_pkey" PRIMARY KEY ("id_redevance")
);

-- CreateTable
CREATE TABLE "substance_associee_demande" (
    "id_assoc" SERIAL NOT NULL,
    "id_proc" INTEGER NOT NULL,
    "id_substance" INTEGER NOT NULL,
    "priorite" "EnumPriorite" NOT NULL,
    "date_ajout" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "substance_associee_demande_pkey" PRIMARY KEY ("id_assoc")
);

-- CreateTable
CREATE TABLE "interactions_wali_portail" (
    "id" SERIAL NOT NULL,
    "idInterne" INTEGER,
    "id_procedure" INTEGER NOT NULL,
    "id_wilaya" INTEGER NOT NULL,
    "type_interaction" "EnumTypeInteraction",
    "avis_wali" "EnumAvisWali" DEFAULT 'EN_ATTENTE',
    "date_envoi" TIMESTAMP(3),
    "date_reponse" TIMESTAMP(3),
    "delai_depasse" BOOLEAN DEFAULT false,
    "nom_responsable_reception" VARCHAR(255),
    "commentaires" TEXT,
    "contenu" TEXT,
    "is_relance" BOOLEAN NOT NULL DEFAULT false,
    "relance_parent_id" INTEGER,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interactions_wali_portail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "typepaiement" (
    "id" SERIAL NOT NULL,
    "libelle" TEXT NOT NULL,
    "frequence" TEXT NOT NULL,
    "details_calcul" TEXT,

    CONSTRAINT "typepaiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligationfiscale" (
    "id" SERIAL NOT NULL,
    "id_typePaiement" INTEGER NOT NULL,
    "id_permis" INTEGER NOT NULL,
    "annee_fiscale" INTEGER NOT NULL,
    "montant_attendu" DOUBLE PRECISION NOT NULL,
    "date_echeance" TIMESTAMP(3) NOT NULL,
    "statut" "EnumStatutPaiement" NOT NULL,
    "details_calcul" TEXT,

    CONSTRAINT "obligationfiscale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiement" (
    "id" SERIAL NOT NULL,
    "id_obligation" INTEGER NOT NULL,
    "montant_paye" DOUBLE PRECISION NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'DZD',
    "date_paiement" TIMESTAMP(3) NOT NULL,
    "mode_paiement" TEXT NOT NULL,
    "num_quittance" TEXT,
    "etat_paiement" TEXT NOT NULL,
    "justificatif_url" TEXT,
    "num_perc" TEXT,
    "date_remisOp" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TsPaiement" (
    "id_tsPaiement" SERIAL NOT NULL,
    "id_obligation" INTEGER NOT NULL,
    "datePerDebut" TIMESTAMP(3) NOT NULL,
    "datePerFin" TIMESTAMP(3) NOT NULL,
    "surfaceMin" DOUBLE PRECISION NOT NULL,
    "surfaceMax" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TsPaiement_pkey" PRIMARY KEY ("id_tsPaiement")
);

-- CreateTable
CREATE TABLE "rapport_activite" (
    "id_rapport" SERIAL NOT NULL,
    "id_permis" INTEGER NOT NULL,
    "date_remise_reelle" TIMESTAMP(3) NOT NULL,
    "etat_activite" TEXT NOT NULL,
    "leve_topo_3112" TEXT,
    "leve_topo_3006" TEXT,
    "plan_exploitation" TEXT,
    "date_debut_travaux" TIMESTAMP(3),
    "vente_exportation" TEXT,
    "importation" TEXT,
    "valeur_equipement_acquis" DOUBLE PRECISION,
    "pros_expl_entamee" TEXT,
    "avancee_travaux" TEXT,
    "travaux_realises" TEXT,
    "nbr_ouvrages" INTEGER,
    "volume" DOUBLE PRECISION,
    "resume_activites" TEXT,
    "investissements_realises" DOUBLE PRECISION,
    "qte_explosifs" DOUBLE PRECISION,
    "qte_explosifs_DIM" DOUBLE PRECISION,
    "detonateurs" INTEGER,
    "dmr" INTEGER,
    "cordeau_detonant" INTEGER,
    "meche_lente" INTEGER,
    "relais" INTEGER,
    "DEI" INTEGER,
    "effectif_cadre" INTEGER,
    "effectif_maitrise" INTEGER,
    "effectif_execution" INTEGER,
    "production_toutvenant" DOUBLE PRECISION,
    "production_marchande" DOUBLE PRECISION,
    "production_vendue" DOUBLE PRECISION,
    "production_stocke" DOUBLE PRECISION,
    "stock_T_V" DOUBLE PRECISION,
    "stock_produit_marchand" DOUBLE PRECISION,
    "production_sable" DOUBLE PRECISION,
    "poussieres" DOUBLE PRECISION,
    "rejets_laverie" DOUBLE PRECISION,
    "fumee_gaz" DOUBLE PRECISION,
    "autres_effluents" DOUBLE PRECISION,
    "nbr_accidents" INTEGER,
    "accidents_mortels" INTEGER,
    "accidents_non_mortels" INTEGER,
    "nbrs_jours_perdues" INTEGER,
    "taux_frequence" DOUBLE PRECISION,
    "taux_gravite" DOUBLE PRECISION,
    "nbrs_incidents" INTEGER,
    "nbrs_malades_pro" INTEGER,
    "remise_etat_realisee" TEXT,
    "cout_remise_etat" DOUBLE PRECISION,
    "commentaires_generaux" TEXT,
    "rapport_url" TEXT,

    CONSTRAINT "rapport_activite_pkey" PRIMARY KEY ("id_rapport")
);

-- CreateTable
CREATE TABLE "_PermisProcedure" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_PermisProcedure_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "wilayas_portail_code_wilaya_key" ON "wilayas_portail"("code_wilaya");

-- CreateIndex
CREATE UNIQUE INDEX "typepermis_lib_type_key" ON "typepermis"("lib_type");

-- CreateIndex
CREATE UNIQUE INDEX "typepermis_code_type_key" ON "typepermis"("code_type");

-- CreateIndex
CREATE INDEX "permis_templates_typePermisId_idx" ON "permis_templates"("typePermisId");

-- CreateIndex
CREATE INDEX "permis_templates_permisId_idx" ON "permis_templates"("permisId");

-- CreateIndex
CREATE UNIQUE INDEX "demFusion_id_demande_key" ON "demFusion"("id_demande");

-- CreateIndex
CREATE UNIQUE INDEX "demFusion_id_permisResultant_key" ON "demFusion"("id_permisResultant");

-- CreateIndex
CREATE UNIQUE INDEX "StatutPermis_lib_statut_key" ON "StatutPermis"("lib_statut");

-- CreateIndex
CREATE INDEX "dossiers_administratifs_portail_id_typePermis_idx" ON "dossiers_administratifs_portail"("id_typePermis");

-- CreateIndex
CREATE INDEX "dossiers_administratifs_portail_id_typeProcedure_idx" ON "dossiers_administratifs_portail"("id_typeProcedure");

-- CreateIndex
CREATE UNIQUE INDEX "dossiers_administratifs_portail_id_typePermis_id_typeProced_key" ON "dossiers_administratifs_portail"("id_typePermis", "id_typeProcedure");

-- CreateIndex
CREATE UNIQUE INDEX "dossiers_fournis_portail_idInterne_key" ON "dossiers_fournis_portail"("idInterne");

-- CreateIndex
CREATE INDEX "dossiers_fournis_portail_id_demande_idx" ON "dossiers_fournis_portail"("id_demande");

-- CreateIndex
CREATE INDEX "dossiers_fournis_portail_statut_idx" ON "dossiers_fournis_portail"("statut");

-- CreateIndex
CREATE INDEX "dossiers_fournis_documents_portail_statut_idx" ON "dossiers_fournis_documents_portail"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "substance_associee_demande_id_proc_id_substance_key" ON "substance_associee_demande"("id_proc", "id_substance");

-- CreateIndex
CREATE UNIQUE INDEX "interactions_wali_portail_idInterne_key" ON "interactions_wali_portail"("idInterne");

-- CreateIndex
CREATE INDEX "interactions_wali_portail_id_procedure_idx" ON "interactions_wali_portail"("id_procedure");

-- CreateIndex
CREATE INDEX "interactions_wali_portail_id_wilaya_idx" ON "interactions_wali_portail"("id_wilaya");

-- CreateIndex
CREATE INDEX "interactions_wali_portail_avis_wali_idx" ON "interactions_wali_portail"("avis_wali");

-- CreateIndex
CREATE INDEX "interactions_wali_portail_date_envoi_idx" ON "interactions_wali_portail"("date_envoi");

-- CreateIndex
CREATE INDEX "interactions_wali_portail_is_relance_idx" ON "interactions_wali_portail"("is_relance");

-- CreateIndex
CREATE UNIQUE INDEX "typepaiement_libelle_key" ON "typepaiement"("libelle");

-- CreateIndex
CREATE INDEX "_PermisProcedure_B_index" ON "_PermisProcedure"("B");

-- CreateIndex
CREATE UNIQUE INDEX "demandes_portail_idInterne_key" ON "demandes_portail"("idInterne");

-- CreateIndex
CREATE INDEX "demandes_portail_typePermisId_idx" ON "demandes_portail"("typePermisId");

-- CreateIndex
CREATE INDEX "demandes_portail_typeProcedureId_idx" ON "demandes_portail"("typeProcedureId");

-- CreateIndex
CREATE INDEX "demandes_portail_idWilaya_idx" ON "demandes_portail"("idWilaya");

-- CreateIndex
CREATE INDEX "demandes_portail_idDaira_idx" ON "demandes_portail"("idDaira");

-- CreateIndex
CREATE INDEX "demandes_portail_idCommune_idx" ON "demandes_portail"("idCommune");

-- CreateIndex
CREATE INDEX "permis_portail_typePermisId_idx" ON "permis_portail"("typePermisId");

-- CreateIndex
CREATE INDEX "permis_portail_idCommune_idx" ON "permis_portail"("idCommune");

-- CreateIndex
CREATE INDEX "procedures_portail_typeProcedureId_idx" ON "procedures_portail"("typeProcedureId");

-- AddForeignKey
ALTER TABLE "wilayas_portail" ADD CONSTRAINT "wilayas_portail_id_antenne_fkey" FOREIGN KEY ("id_antenne") REFERENCES "antennes_portail"("id_antenne") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dairas_portail" ADD CONSTRAINT "dairas_portail_id_wilaya_fkey" FOREIGN KEY ("id_wilaya") REFERENCES "wilayas_portail"("id_wilaya") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communes_portail" ADD CONSTRAINT "communes_portail_id_daira_fkey" FOREIGN KEY ("id_daira") REFERENCES "dairas_portail"("id_daira") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fonction_personne_morale_portail" ADD CONSTRAINT "fonction_personne_morale_portail_id_entreprise_fkey" FOREIGN KEY ("id_entreprise") REFERENCES "entreprises_portail"("id_entreprise") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registre_commerce_portail" ADD CONSTRAINT "registre_commerce_portail_id_entreprise_fkey" FOREIGN KEY ("id_entreprise") REFERENCES "entreprises_portail"("id_entreprise") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "typepermis" ADD CONSTRAINT "typepermis_id_taxe_fkey" FOREIGN KEY ("id_taxe") REFERENCES "superficiaire_bareme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barem_produit_droit" ADD CONSTRAINT "barem_produit_droit_typePermisId_fkey" FOREIGN KEY ("typePermisId") REFERENCES "typepermis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barem_produit_droit" ADD CONSTRAINT "barem_produit_droit_typeProcedureId_fkey" FOREIGN KEY ("typeProcedureId") REFERENCES "types_procedures_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permis_templates" ADD CONSTRAINT "permis_templates_permisId_fkey" FOREIGN KEY ("permisId") REFERENCES "permis_portail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permis_templates" ADD CONSTRAINT "permis_templates_typePermisId_fkey" FOREIGN KEY ("typePermisId") REFERENCES "typepermis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_portail" ADD CONSTRAINT "demandes_portail_typePermisId_fkey" FOREIGN KEY ("typePermisId") REFERENCES "typepermis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_portail" ADD CONSTRAINT "demandes_portail_typeProcedureId_fkey" FOREIGN KEY ("typeProcedureId") REFERENCES "types_procedures_portail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_portail" ADD CONSTRAINT "demandes_portail_idWilaya_fkey" FOREIGN KEY ("idWilaya") REFERENCES "wilayas_portail"("id_wilaya") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_portail" ADD CONSTRAINT "demandes_portail_idDaira_fkey" FOREIGN KEY ("idDaira") REFERENCES "dairas_portail"("id_daira") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_portail" ADD CONSTRAINT "demandes_portail_idCommune_fkey" FOREIGN KEY ("idCommune") REFERENCES "communes_portail"("id_commune") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_portail" ADD CONSTRAINT "demandes_portail_idEntreprise_fkey" FOREIGN KEY ("idEntreprise") REFERENCES "entreprises_portail"("id_entreprise") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permis_portail" ADD CONSTRAINT "permis_portail_typePermisId_fkey" FOREIGN KEY ("typePermisId") REFERENCES "typepermis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permis_portail" ADD CONSTRAINT "permis_portail_idCommune_fkey" FOREIGN KEY ("idCommune") REFERENCES "communes_portail"("id_commune") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permis_portail" ADD CONSTRAINT "permis_portail_id_entreprise_fkey" FOREIGN KEY ("id_entreprise") REFERENCES "entreprises_portail"("id_entreprise") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permis_portail" ADD CONSTRAINT "permis_portail_id_statut_fkey" FOREIGN KEY ("id_statut") REFERENCES "StatutPermis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demFusion" ADD CONSTRAINT "demFusion_id_demande_fkey" FOREIGN KEY ("id_demande") REFERENCES "demandes_portail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demFusion" ADD CONSTRAINT "demFusion_id_permisResultant_fkey" FOREIGN KEY ("id_permisResultant") REFERENCES "permis_portail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fusionPermisSource" ADD CONSTRAINT "fusionPermisSource_id_permis_fkey" FOREIGN KEY ("id_permis") REFERENCES "permis_portail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fusionPermisSource" ADD CONSTRAINT "fusionPermisSource_id_fusion_fkey" FOREIGN KEY ("id_fusion") REFERENCES "demFusion"("id_fusion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codeAssimilation" ADD CONSTRAINT "codeAssimilation_id_ancienType_fkey" FOREIGN KEY ("id_ancienType") REFERENCES "AncienTypePermis"("id_ancienType") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codeAssimilation" ADD CONSTRAINT "codeAssimilation_id_permis_fkey" FOREIGN KEY ("id_permis") REFERENCES "permis_portail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cahiercharge" ADD CONSTRAINT "cahiercharge_permisId_fkey" FOREIGN KEY ("permisId") REFERENCES "permis_portail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cahiercharge" ADD CONSTRAINT "cahiercharge_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "demandes_portail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers_administratifs_portail" ADD CONSTRAINT "dossiers_administratifs_portail_id_typePermis_fkey" FOREIGN KEY ("id_typePermis") REFERENCES "typepermis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers_administratifs_portail" ADD CONSTRAINT "dossiers_administratifs_portail_id_typeProcedure_fkey" FOREIGN KEY ("id_typeProcedure") REFERENCES "types_procedures_portail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_documents_portail" ADD CONSTRAINT "dossier_documents_portail_id_doc_fkey" FOREIGN KEY ("id_doc") REFERENCES "documents_portail"("id_doc") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_documents_portail" ADD CONSTRAINT "dossier_documents_portail_id_dossier_fkey" FOREIGN KEY ("id_dossier") REFERENCES "dossiers_administratifs_portail"("id_dossier") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers_fournis_portail" ADD CONSTRAINT "dossiers_fournis_portail_id_demande_fkey" FOREIGN KEY ("id_demande") REFERENCES "demandes_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers_fournis_documents_portail" ADD CONSTRAINT "dossiers_fournis_documents_portail_id_dossierFournis_fkey" FOREIGN KEY ("id_dossierFournis") REFERENCES "dossiers_fournis_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers_fournis_documents_portail" ADD CONSTRAINT "dossiers_fournis_documents_portail_id_doc_fkey" FOREIGN KEY ("id_doc") REFERENCES "documents_portail"("id_doc") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phases_portail" ADD CONSTRAINT "phases_portail_typeProcedureId_fkey" FOREIGN KEY ("typeProcedureId") REFERENCES "types_procedures_portail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapes_proc_portail" ADD CONSTRAINT "etapes_proc_portail_id_phase_fkey" FOREIGN KEY ("id_phase") REFERENCES "phases_portail"("id_phase") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_phase_portail" ADD CONSTRAINT "procedure_phase_portail_id_proc_fkey" FOREIGN KEY ("id_proc") REFERENCES "procedures_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_phase_portail" ADD CONSTRAINT "procedure_phase_portail_id_phase_fkey" FOREIGN KEY ("id_phase") REFERENCES "phases_portail"("id_phase") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_etape_portail" ADD CONSTRAINT "procedure_etape_portail_id_proc_fkey" FOREIGN KEY ("id_proc") REFERENCES "procedures_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_etape_portail" ADD CONSTRAINT "procedure_etape_portail_id_etape_fkey" FOREIGN KEY ("id_etape") REFERENCES "etapes_proc_portail"("id_etape") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substances" ADD CONSTRAINT "substances_idRedevance_fkey" FOREIGN KEY ("idRedevance") REFERENCES "redevance_bareme"("id_redevance") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substance_associee_demande" ADD CONSTRAINT "substance_associee_demande_id_proc_fkey" FOREIGN KEY ("id_proc") REFERENCES "procedures_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substance_associee_demande" ADD CONSTRAINT "substance_associee_demande_id_substance_fkey" FOREIGN KEY ("id_substance") REFERENCES "substances"("id_sub") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedures_portail" ADD CONSTRAINT "procedures_portail_typeProcedureId_fkey" FOREIGN KEY ("typeProcedureId") REFERENCES "types_procedures_portail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions_wali_portail" ADD CONSTRAINT "interactions_wali_portail_id_procedure_fkey" FOREIGN KEY ("id_procedure") REFERENCES "procedures_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions_wali_portail" ADD CONSTRAINT "interactions_wali_portail_id_wilaya_fkey" FOREIGN KEY ("id_wilaya") REFERENCES "wilayas_portail"("id_wilaya") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions_wali_portail" ADD CONSTRAINT "interactions_wali_portail_relance_parent_id_fkey" FOREIGN KEY ("relance_parent_id") REFERENCES "interactions_wali_portail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligationfiscale" ADD CONSTRAINT "obligationfiscale_id_permis_fkey" FOREIGN KEY ("id_permis") REFERENCES "permis_portail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligationfiscale" ADD CONSTRAINT "obligationfiscale_id_typePaiement_fkey" FOREIGN KEY ("id_typePaiement") REFERENCES "typepaiement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiement" ADD CONSTRAINT "paiement_id_obligation_fkey" FOREIGN KEY ("id_obligation") REFERENCES "obligationfiscale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TsPaiement" ADD CONSTRAINT "TsPaiement_id_obligation_fkey" FOREIGN KEY ("id_obligation") REFERENCES "obligationfiscale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapport_activite" ADD CONSTRAINT "rapport_activite_id_permis_fkey" FOREIGN KEY ("id_permis") REFERENCES "permis_portail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermisProcedure" ADD CONSTRAINT "_PermisProcedure_A_fkey" FOREIGN KEY ("A") REFERENCES "permis_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermisProcedure" ADD CONSTRAINT "_PermisProcedure_B_fkey" FOREIGN KEY ("B") REFERENCES "procedures_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

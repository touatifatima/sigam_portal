CREATE TYPE "ObjetDemandeCadastre" AS ENUM (
  'CONSTITUTION_DOSSIER_ADMINISTRATIF',
  'TRANSACTION_CESSION_DROITS_MINIERS',
  'CONTENTIEUX_PROCEDURE_JUDICIAIRE',
  'FINANCEMENT_GARANTIE_BANCAIRE',
  'CONTROLE_SUIVI_REGLEMENTAIRE',
  'AUTRE'
);

ALTER TABLE "demandes_documents_cadastraux"
  ADD COLUMN IF NOT EXISTS "objetDemandeAutre" TEXT;

ALTER TABLE "demandes_documents_cadastraux"
  ALTER COLUMN "objetDemande" TYPE "ObjetDemandeCadastre"
  USING (
    CASE
      WHEN lower(trim("objetDemande")) LIKE 'constitution de dossier administratif%' THEN 'CONSTITUTION_DOSSIER_ADMINISTRATIF'::"ObjetDemandeCadastre"
      WHEN lower(trim("objetDemande")) LIKE 'transaction ou cession de droits miniers%' THEN 'TRANSACTION_CESSION_DROITS_MINIERS'::"ObjetDemandeCadastre"
      WHEN lower(trim("objetDemande")) LIKE 'contentieux ou procedure judiciaire%' THEN 'CONTENTIEUX_PROCEDURE_JUDICIAIRE'::"ObjetDemandeCadastre"
      WHEN lower(trim("objetDemande")) LIKE 'financement / garantie bancaire%' THEN 'FINANCEMENT_GARANTIE_BANCAIRE'::"ObjetDemandeCadastre"
      WHEN lower(trim("objetDemande")) LIKE 'controle et suivi reglementaire%' THEN 'CONTROLE_SUIVI_REGLEMENTAIRE'::"ObjetDemandeCadastre"
      ELSE 'AUTRE'::"ObjetDemandeCadastre"
    END
  );

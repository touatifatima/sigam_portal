-- Cadastre document workflow tables
-- Permet the portal to create, track, generate and audit cadastral document requests.

DO $$
BEGIN
  CREATE TYPE "TypeDocumentCadastral" AS ENUM (
    'EXTRAIT_CERTIFIE_CONFORME',
    'PLAN_CADASTRAL_OFFICIEL'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "StatutDemandeDocument" AS ENUM (
    'ENREGISTREE',
    'VERIFIEE',
    'GENEREE',
    'DELIVREE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ActionDocumentCadastral" AS ENUM (
    'DEMANDE_ENREGISTREE',
    'DEMANDE_VERIFIEE',
    'DOCUMENT_GENERE',
    'DOCUMENT_DELIVRE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "demandes_documents_cadastraux" (
  "id" SERIAL NOT NULL,
  "referenceDemande" VARCHAR(100) NOT NULL,
  "utilisateurId" INTEGER NOT NULL,
  "permisId" INTEGER NOT NULL,
  "typeDocument" "TypeDocumentCadastral" NOT NULL,
  "statut" "StatutDemandeDocument" NOT NULL DEFAULT 'ENREGISTREE',
  "objetDemande" TEXT NOT NULL,
  "qualiteDemandeur" VARCHAR(255) NOT NULL,
  "baseCommunication" TEXT NOT NULL,
  "preuvePaiementUrl" TEXT,
  "dateDemande" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "demandes_documents_cadastraux_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "demandes_documents_cadastraux_referenceDemande_key"
  ON "demandes_documents_cadastraux"("referenceDemande");

CREATE INDEX IF NOT EXISTS "demandes_documents_cadastraux_utilisateurId_idx"
  ON "demandes_documents_cadastraux"("utilisateurId");

CREATE INDEX IF NOT EXISTS "demandes_documents_cadastraux_permisId_idx"
  ON "demandes_documents_cadastraux"("permisId");

CREATE INDEX IF NOT EXISTS "demandes_documents_cadastraux_statut_idx"
  ON "demandes_documents_cadastraux"("statut");

CREATE INDEX IF NOT EXISTS "demandes_documents_cadastraux_dateDemande_idx"
  ON "demandes_documents_cadastraux"("dateDemande" DESC);

CREATE TABLE IF NOT EXISTS "documents_cadastraux_generes" (
  "id" SERIAL NOT NULL,
  "demandeId" INTEGER NOT NULL,
  "referenceDocument" VARCHAR(150) NOT NULL,
  "referencesActesInclus" JSONB,
  "typeDocument" "TypeDocumentCadastral" NOT NULL,
  "fichierUrl" TEXT NOT NULL,
  "dateGeneration" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dateDelivrance" TIMESTAMP(3),
  "agentEmetteur" VARCHAR(255),
  "donneesProtegeesMasquees" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "documents_cadastraux_generes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "documents_cadastraux_generes_referenceDocument_key"
  ON "documents_cadastraux_generes"("referenceDocument");

CREATE INDEX IF NOT EXISTS "documents_cadastraux_generes_demandeId_idx"
  ON "documents_cadastraux_generes"("demandeId");

CREATE INDEX IF NOT EXISTS "documents_cadastraux_generes_dateGeneration_idx"
  ON "documents_cadastraux_generes"("dateGeneration" DESC);

CREATE INDEX IF NOT EXISTS "documents_cadastraux_generes_dateDelivrance_idx"
  ON "documents_cadastraux_generes"("dateDelivrance" DESC);

CREATE TABLE IF NOT EXISTS "historique_demandes_documents" (
  "id" SERIAL NOT NULL,
  "demandeId" INTEGER NOT NULL,
  "action" "ActionDocumentCadastral" NOT NULL,
  "dateAction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "agentEmetteur" VARCHAR(255),
  "detailsCommunication" TEXT,
  "preuveCommunicationUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "historique_demandes_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "historique_demandes_documents_demandeId_idx"
  ON "historique_demandes_documents"("demandeId");

CREATE INDEX IF NOT EXISTS "historique_demandes_documents_dateAction_idx"
  ON "historique_demandes_documents"("dateAction" DESC);

CREATE INDEX IF NOT EXISTS "historique_demandes_documents_action_idx"
  ON "historique_demandes_documents"("action");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'demandes_documents_cadastraux_utilisateurId_fkey'
  ) THEN
    ALTER TABLE "demandes_documents_cadastraux"
      ADD CONSTRAINT "demandes_documents_cadastraux_utilisateurId_fkey"
      FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs_portail"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'demandes_documents_cadastraux_permisId_fkey'
  ) THEN
    ALTER TABLE "demandes_documents_cadastraux"
      ADD CONSTRAINT "demandes_documents_cadastraux_permisId_fkey"
      FOREIGN KEY ("permisId") REFERENCES "PermisPortail"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_cadastraux_generes_demandeId_fkey'
  ) THEN
    ALTER TABLE "documents_cadastraux_generes"
      ADD CONSTRAINT "documents_cadastraux_generes_demandeId_fkey"
      FOREIGN KEY ("demandeId") REFERENCES "demandes_documents_cadastraux"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'historique_demandes_documents_demandeId_fkey'
  ) THEN
    ALTER TABLE "historique_demandes_documents"
      ADD CONSTRAINT "historique_demandes_documents_demandeId_fkey"
      FOREIGN KEY ("demandeId") REFERENCES "demandes_documents_cadastraux"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

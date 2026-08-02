-- Extend cadastral document requests with step 1 identity, OTP and attachment tracking.

DO $$
BEGIN
  CREATE TYPE "CanalVerificationCadastre" AS ENUM (
    'EMAIL',
    'TELEPHONE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TypePieceCadastre" AS ENUM (
    'SCAN_TITRE',
    'SCAN_CARTE_IDENTITE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "demandes_documents_cadastraux"
  ADD COLUMN IF NOT EXISTS "numeroRc" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "titulaire" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "qrCodeTitre" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "codePermis" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "typePermis" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "nin" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "nom" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "prenom" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "emailContact" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "telephoneContact" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "canalVerification" "CanalVerificationCadastre",
  ADD COLUMN IF NOT EXISTS "otpHash" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "otpRequestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "otpExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "otpVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dateSoumission" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "demandes_documents_cadastraux_emailContact_idx"
  ON "demandes_documents_cadastraux"("emailContact");

CREATE INDEX IF NOT EXISTS "demandes_documents_cadastraux_telephoneContact_idx"
  ON "demandes_documents_cadastraux"("telephoneContact");

CREATE INDEX IF NOT EXISTS "demandes_documents_cadastraux_nin_idx"
  ON "demandes_documents_cadastraux"("nin");

CREATE INDEX IF NOT EXISTS "demandes_documents_cadastraux_dateSoumission_idx"
  ON "demandes_documents_cadastraux"("dateSoumission" DESC);

CREATE TABLE IF NOT EXISTS "pieces_jointes_demandes_documents_cadastraux" (
  "id" SERIAL NOT NULL,
  "demandeId" INTEGER NOT NULL,
  "typePiece" "TypePieceCadastre" NOT NULL,
  "fichierUrl" TEXT NOT NULL,
  "nomFichierOriginal" VARCHAR(255),
  "mimeType" VARCHAR(100),
  "tailleOctets" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pieces_jointes_demandes_documents_cadastraux_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pieces_jointes_demandes_documents_cadastraux_demandeId_idx"
  ON "pieces_jointes_demandes_documents_cadastraux"("demandeId");

CREATE INDEX IF NOT EXISTS "pieces_jointes_demandes_documents_cadastraux_typePiece_idx"
  ON "pieces_jointes_demandes_documents_cadastraux"("typePiece");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pieces_jointes_demandes_documents_cadastraux_demandeId_fkey'
  ) THEN
    ALTER TABLE "pieces_jointes_demandes_documents_cadastraux"
      ADD CONSTRAINT "pieces_jointes_demandes_documents_cadastraux_demandeId_fkey"
      FOREIGN KEY ("demandeId") REFERENCES "demandes_documents_cadastraux"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

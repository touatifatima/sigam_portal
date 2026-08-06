-- Add reference tables for dynamic cadastral document selection and OTP channel selection.

CREATE TABLE IF NOT EXISTS "cadastre_document_references" (
  "id" SERIAL NOT NULL,
  "code" VARCHAR(100) NOT NULL,
  "label" VARCHAR(255) NOT NULL,
  "subtitle" VARCHAR(255),
  "description" TEXT,
  "iconKey" VARCHAR(50),
  "accentKey" VARCHAR(50),
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cadastre_document_references_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cadastre_document_references_code_key"
  ON "cadastre_document_references"("code");

CREATE INDEX IF NOT EXISTS "cadastre_document_references_isActive_sortOrder_idx"
  ON "cadastre_document_references"("isActive", "sortOrder");

CREATE TABLE IF NOT EXISTS "cadastre_verification_references" (
  "id" SERIAL NOT NULL,
  "code" VARCHAR(100) NOT NULL,
  "label" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "iconKey" VARCHAR(50),
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cadastre_verification_references_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cadastre_verification_references_code_key"
  ON "cadastre_verification_references"("code");

CREATE INDEX IF NOT EXISTS "cadastre_verification_references_isActive_sortOrder_idx"
  ON "cadastre_verification_references"("isActive", "sortOrder");

INSERT INTO "cadastre_document_references" ("code", "label", "subtitle", "description", "iconKey", "accentKey", "isActive", "isDefault", "sortOrder")
VALUES
  (
    'EXTRAIT_CERTIFIE_CONFORME',
    'Extrait cadastral officiel',
    'Document d''identification juridique du titre',
    'Fiche officielle avec les informations du titre, du titulaire et les elements necessaires au suivi cadastral.',
    'file-text',
    'green',
    TRUE,
    FALSE,
    1
  ),
  (
    'PLAN_CADASTRAL_OFFICIEL',
    'Plan cadastral officiel',
    'Representation cartographique du perimetre',
    'Plan de reference avec les limites, sommets, points de controle et la lecture cartographique du titre.',
    'map-pinned',
    'teal',
    TRUE,
    TRUE,
    2
  )
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "cadastre_verification_references" ("code", "label", "description", "iconKey", "isActive", "isDefault", "sortOrder")
VALUES
  (
    'EMAIL',
    'Adresse email',
    'Code OTP envoye sur la boite email du representant.',
    'mail',
    TRUE,
    FALSE,
    1
  ),
  (
    'TELEPHONE',
    'Numero de telephone',
    'Code OTP envoye au numero du representant.',
    'phone',
    TRUE,
    TRUE,
    2
  )
ON CONFLICT ("code") DO NOTHING;

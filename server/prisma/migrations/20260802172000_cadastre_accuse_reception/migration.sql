-- Add receipt metadata for cadastre document requests
ALTER TABLE "demandes_documents_cadastraux"
ADD COLUMN IF NOT EXISTS "accuseReceptionPdfUrl" TEXT,
ADD COLUMN IF NOT EXISTS "accuseReceptionPdfFilename" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "accuseReceptionGeneratedAt" TIMESTAMP(3);

ALTER TABLE "demande_complement"
  ADD COLUMN IF NOT EXISTS "recepisse_pdf_url" TEXT;

ALTER TABLE "demande_complement"
  ADD COLUMN IF NOT EXISTS "recepisse_pdf_filename" TEXT;

ALTER TABLE "demande_complement"
  ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMP(3);

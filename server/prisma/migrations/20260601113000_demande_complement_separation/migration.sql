CREATE TABLE IF NOT EXISTS "demande_complement" (
  "id_complement" SERIAL NOT NULL,
  "id_demande" INTEGER NOT NULL,
  "motif" TEXT,
  "admin_message" TEXT,
  "delai_jours" INTEGER,
  "effet_absence" TEXT,
  "mode_notification" TEXT,
  "pdf_url" TEXT,
  "pdf_filename" TEXT,
  "statut_complement" TEXT NOT NULL DEFAULT 'OUVERTE',
  "created_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "demande_complement_pkey" PRIMARY KEY ("id_complement")
);

CREATE TABLE IF NOT EXISTS "demande_complement_item" (
  "id_item" SERIAL NOT NULL,
  "id_complement" INTEGER NOT NULL,
  "id_doc" INTEGER,
  "nom_doc_snapshot" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "problems" JSONB,
  "commentaire" TEXT,
  "statut_actuel_snapshot" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "demande_complement_item_pkey" PRIMARY KEY ("id_item")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'demande_complement_demande_fkey'
  ) THEN
    ALTER TABLE "demande_complement"
    ADD CONSTRAINT "demande_complement_demande_fkey"
    FOREIGN KEY ("id_demande") REFERENCES "demande"("id_demande")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'demande_complement_item_complement_fkey'
  ) THEN
    ALTER TABLE "demande_complement_item"
    ADD CONSTRAINT "demande_complement_item_complement_fkey"
    FOREIGN KEY ("id_complement") REFERENCES "demande_complement"("id_complement")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'demande_complement_item_document_fkey'
  ) THEN
    ALTER TABLE "demande_complement_item"
    ADD CONSTRAINT "demande_complement_item_document_fkey"
    FOREIGN KEY ("id_doc") REFERENCES "documentPortail"("id_doc")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "demande_complement_demande_idx"
ON "demande_complement"("id_demande");

CREATE INDEX IF NOT EXISTS "demande_complement_statut_created_idx"
ON "demande_complement"("statut_complement", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "demande_complement_demande_created_idx"
ON "demande_complement"("id_demande", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "demande_complement_item_complement_idx"
ON "demande_complement_item"("id_complement");

CREATE INDEX IF NOT EXISTS "demande_complement_item_doc_idx"
ON "demande_complement_item"("id_doc");

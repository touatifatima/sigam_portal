ALTER TABLE "demande_complement_item"
ADD COLUMN "statut_traitement" TEXT NOT NULL DEFAULT 'A_TRAITER',
ADD COLUMN "traite_at" TIMESTAMP(3),
ADD COLUMN "traite_by" INTEGER,
ADD COLUMN "note_traitement" TEXT;

CREATE INDEX "demande_complement_item_complement_traitement_idx"
ON "demande_complement_item"("id_complement", "statut_traitement");

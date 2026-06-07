ALTER TABLE "demande_complement_item"
ADD COLUMN "statut_reponse" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
ADD COLUMN "repondu_at" TIMESTAMP(3),
ADD COLUMN "reponse_file_url" TEXT;

CREATE INDEX "demande_complement_item_complement_reponse_idx"
ON "demande_complement_item"("id_complement", "statut_reponse");

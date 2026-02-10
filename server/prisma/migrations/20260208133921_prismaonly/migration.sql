-- AlterTable
ALTER TABLE "permis" ADD COLUMN     "date_option_permis" TIMESTAMP(3),
ADD COLUMN     "date_signature" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "idx_permis_date_octroi" ON "permis"("date_octroi" DESC);

-- CreateIndex
CREATE INDEX "idx_permis_id_statut_date_octroi" ON "permis"("id_statut", "date_octroi" DESC);

-- CreateIndex
CREATE INDEX "idx_permis_id_statut_date_expiration" ON "permis"("id_statut", "date_expiration" DESC);

-- CreateIndex
CREATE INDEX "idx_permis_code_permis" ON "permis"("code_permis");

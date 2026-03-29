-- Add dedicated operator relation for QR access flow.
ALTER TABLE "PermisPortail"
ADD COLUMN "operatorId" INTEGER;

CREATE UNIQUE INDEX "PermisPortail_operatorId_key" ON "PermisPortail"("operatorId");
CREATE UNIQUE INDEX "PermisPortail_qr_code_key" ON "PermisPortail"("qr_code");
CREATE INDEX "idx_permis_operator_id" ON "PermisPortail"("operatorId");

ALTER TABLE "PermisPortail"
ADD CONSTRAINT "PermisPortail_operatorId_fkey"
FOREIGN KEY ("operatorId") REFERENCES "utilisateurs_portail"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

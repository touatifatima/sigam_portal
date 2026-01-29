-- AlterTable
ALTER TABLE "demande" ADD COLUMN     "perimetre" JSONB;

-- CreateTable
CREATE TABLE "DemandeCommune" (
    "id_demande" INTEGER NOT NULL,
    "id_commune" INTEGER NOT NULL,
    "principale" BOOLEAN DEFAULT false,

    CONSTRAINT "DemandeCommune_pkey" PRIMARY KEY ("id_demande","id_commune")
);

-- AddForeignKey
ALTER TABLE "DemandeCommune" ADD CONSTRAINT "DemandeCommune_id_demande_fkey" FOREIGN KEY ("id_demande") REFERENCES "demande"("id_demande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeCommune" ADD CONSTRAINT "DemandeCommune_id_commune_fkey" FOREIGN KEY ("id_commune") REFERENCES "Commune"("id_commune") ON DELETE RESTRICT ON UPDATE CASCADE;

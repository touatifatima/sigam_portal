-- CreateEnum
CREATE TYPE "EnumStatutSeance" AS ENUM ('programmee', 'terminee');

-- AlterTable
ALTER TABLE "procedures_portail" ADD COLUMN     "id_seance" INTEGER;

-- CreateTable
CREATE TABLE "SeanceCDPrevue" (
    "id_seance" SERIAL NOT NULL,
    "num_seance" TEXT NOT NULL,
    "date_seance" TIMESTAMP(3) NOT NULL,
    "exercice" INTEGER NOT NULL,
    "remarques" TEXT,
    "statut" "EnumStatutSeance" NOT NULL,

    CONSTRAINT "SeanceCDPrevue_pkey" PRIMARY KEY ("id_seance")
);

-- CreateTable
CREATE TABLE "ComiteDirection" (
    "id_comite" SERIAL NOT NULL,
    "id_seance" INTEGER NOT NULL,
    "date_comite" TIMESTAMP(3) NOT NULL,
    "resume_reunion" TEXT NOT NULL,
    "fiche_technique" TEXT,
    "carte_projettee" TEXT,
    "rapport_police" TEXT,

    CONSTRAINT "ComiteDirection_pkey" PRIMARY KEY ("id_comite")
);

-- CreateTable
CREATE TABLE "DecisionCD" (
    "id_decision" SERIAL NOT NULL,
    "id_comite" INTEGER NOT NULL,
    "numero_decision" TEXT NOT NULL,
    "duree_decision" INTEGER,
    "commentaires" TEXT,
    "decision_cd" "EnumDecisionComite" NOT NULL,

    CONSTRAINT "DecisionCD_pkey" PRIMARY KEY ("id_decision")
);

-- CreateTable
CREATE TABLE "MembresComite" (
    "id_membre" SERIAL NOT NULL,
    "nom_membre" TEXT NOT NULL,
    "prenom_membre" TEXT NOT NULL,
    "fonction_membre" TEXT NOT NULL,
    "email_membre" TEXT NOT NULL,

    CONSTRAINT "MembresComite_pkey" PRIMARY KEY ("id_membre")
);

-- CreateTable
CREATE TABLE "MembreSeance" (
    "id_seance" INTEGER NOT NULL,
    "id_membre" INTEGER NOT NULL,

    CONSTRAINT "MembreSeance_pkey" PRIMARY KEY ("id_seance","id_membre")
);

-- CreateTable
CREATE TABLE "_SeanceMembres" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_SeanceMembres_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_SeanceMembres_B_index" ON "_SeanceMembres"("B");

-- AddForeignKey
ALTER TABLE "procedures_portail" ADD CONSTRAINT "procedures_portail_id_seance_fkey" FOREIGN KEY ("id_seance") REFERENCES "SeanceCDPrevue"("id_seance") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComiteDirection" ADD CONSTRAINT "ComiteDirection_id_seance_fkey" FOREIGN KEY ("id_seance") REFERENCES "SeanceCDPrevue"("id_seance") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionCD" ADD CONSTRAINT "DecisionCD_id_comite_fkey" FOREIGN KEY ("id_comite") REFERENCES "ComiteDirection"("id_comite") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembreSeance" ADD CONSTRAINT "MembreSeance_id_seance_fkey" FOREIGN KEY ("id_seance") REFERENCES "SeanceCDPrevue"("id_seance") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembreSeance" ADD CONSTRAINT "MembreSeance_id_membre_fkey" FOREIGN KEY ("id_membre") REFERENCES "MembresComite"("id_membre") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SeanceMembres" ADD CONSTRAINT "_SeanceMembres_A_fkey" FOREIGN KEY ("A") REFERENCES "MembresComite"("id_membre") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SeanceMembres" ADD CONSTRAINT "_SeanceMembres_B_fkey" FOREIGN KEY ("B") REFERENCES "SeanceCDPrevue"("id_seance") ON DELETE CASCADE ON UPDATE CASCADE;

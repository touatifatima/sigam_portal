-- CreateEnum
CREATE TYPE "RoleUtilisateur" AS ENUM ('INVESTISSEUR', 'OPERATEUR', 'ADMIN');

-- CreateEnum
CREATE TYPE "TypeProcedure" AS ENUM ('RENOUVELLEMENT', 'TRANSFERT', 'CESSION', 'AMODIATION', 'RENONCIATION', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutDemande" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'VALIDEE', 'scheduler', 'REFUSEE', 'SUSPENDUE');

-- CreateEnum
CREATE TYPE "StatutPaiement" AS ENUM ('EN_ATTENTE', 'PAYE', 'ECHEC');

-- CreateEnum
CREATE TYPE "TypeNotification" AS ENUM ('INFO', 'AVIS', 'TAXE', 'ALERTE', 'REPONSE');

-- CreateEnum
CREATE TYPE "EnumPriorite" AS ENUM ('PRINCIPALE', 'SECONDAIRE');

-- CreateEnum
CREATE TYPE "EnumTypeFonction" AS ENUM ('REPRESENTANT', 'ACTIONNAIRE', 'REPRESENTANT_ACTIONNAIRE');

-- CreateEnum
CREATE TYPE "StatutCoordPortail" AS ENUM ('DEMANDE_INITIALE', 'NOUVEAU', 'ANCIENNE');

-- CreateTable
CREATE TABLE "utilisateurs_portail" (
    "id" SERIAL NOT NULL,
    "idInterne" INTEGER,
    "roleId" INTEGER NOT NULL,
    "nomComplet" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "motDePasse" VARCHAR(255) NOT NULL,
    "telephone" VARCHAR(20),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "utilisateurs_portail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions_portail" (
    "id" SERIAL NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_portail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs_portail" (
    "id" SERIAL NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" INTEGER,
    "userId" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changes" JSONB,
    "previousState" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "contextId" VARCHAR(100),
    "sessionId" VARCHAR(100),

    CONSTRAINT "audit_logs_portail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_groups" (
    "userId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_groups_pkey" PRIMARY KEY ("userId","groupId")
);

-- CreateTable
CREATE TABLE "group_permissions" (
    "groupId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,

    CONSTRAINT "group_permissions_pkey" PRIMARY KEY ("groupId","permissionId")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" SERIAL NOT NULL,
    "user1Id" INTEGER NOT NULL,
    "user2Id" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages_portail" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "senderId" INTEGER NOT NULL,
    "receiverId" INTEGER NOT NULL,
    "conversationId" INTEGER,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_portail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications_portail" (
    "id" SERIAL NOT NULL,
    "idUtilisateur" INTEGER NOT NULL,
    "type" "TypeNotification" NOT NULL,
    "titre" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "vu" BOOLEAN NOT NULL DEFAULT false,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_portail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pays" (
    "id_pays" SERIAL NOT NULL,
    "code_pays" VARCHAR(10) NOT NULL,
    "nom_pays" VARCHAR(100) NOT NULL,

    CONSTRAINT "pays_pkey" PRIMARY KEY ("id_pays")
);

-- CreateTable
CREATE TABLE "nationalite" (
    "id_nationalite" SERIAL NOT NULL,
    "libelle" VARCHAR(100) NOT NULL,

    CONSTRAINT "nationalite_pkey" PRIMARY KEY ("id_nationalite")
);

-- CreateTable
CREATE TABLE "statut_juridique_portail" (
    "id_statutJuridique" SERIAL NOT NULL,
    "code_statut" VARCHAR(20) NOT NULL,
    "statut_fr" VARCHAR(100) NOT NULL,
    "statut_ar" VARCHAR(100),

    CONSTRAINT "statut_juridique_portail_pkey" PRIMARY KEY ("id_statutJuridique")
);

-- CreateTable
CREATE TABLE "experts_miniers_portail" (
    "id_expert" SERIAL NOT NULL,
    "nom_expert" VARCHAR(255) NOT NULL,
    "num_agrement" VARCHAR(50),
    "date_agrement" TIMESTAMP(3),
    "etat_agrement" VARCHAR(50),
    "adresse" TEXT,
    "email" VARCHAR(255),
    "tel_expert" VARCHAR(20),
    "fax_expert" VARCHAR(20),
    "specialisation" TEXT,

    CONSTRAINT "experts_miniers_portail_pkey" PRIMARY KEY ("id_expert")
);

-- CreateTable
CREATE TABLE "personnes_physiques_portail" (
    "id_personne" SERIAL NOT NULL,
    "id_pays" INTEGER,
    "id_nationalite" INTEGER,
    "nomFR" VARCHAR(100) NOT NULL,
    "nomAR" VARCHAR(100) NOT NULL,
    "prenomFR" VARCHAR(100) NOT NULL,
    "prenomAR" VARCHAR(100) NOT NULL,
    "date_naissance" TIMESTAMP(3),
    "lieu_naissance" VARCHAR(150),
    "adresse_domicile" TEXT,
    "telephone" VARCHAR(20),
    "fax" VARCHAR(20),
    "email" VARCHAR(255),
    "qualification" TEXT,
    "num_carte_identite" VARCHAR(50),
    "ref_professionnelles" TEXT,

    CONSTRAINT "personnes_physiques_portail_pkey" PRIMARY KEY ("id_personne")
);

-- CreateTable
CREATE TABLE "entreprises_portail" (
    "id_detenteur" SERIAL NOT NULL,
    "idInterne" INTEGER,
    "id_statutJuridique" INTEGER,
    "id_pays" INTEGER,
    "id_nationalite" INTEGER,
    "nom_societeFR" VARCHAR(255) NOT NULL,
    "nom_societeAR" VARCHAR(255),
    "adresse_siege" TEXT,
    "telephone" VARCHAR(20),
    "fax" VARCHAR(20),
    "email" VARCHAR(255),
    "site_web" VARCHAR(255),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entreprises_portail_pkey" PRIMARY KEY ("id_detenteur")
);

-- CreateTable
CREATE TABLE "fonction_personne_morale_portail" (
    "id_detenteur" INTEGER NOT NULL,
    "id_personne" INTEGER NOT NULL,
    "type_fonction" "EnumTypeFonction" NOT NULL,
    "statut_personne" VARCHAR(100),
    "taux_participation" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "fonction_personne_morale_portail_pkey" PRIMARY KEY ("id_detenteur","id_personne")
);

-- CreateTable
CREATE TABLE "registre_commerce_portail" (
    "id" SERIAL NOT NULL,
    "id_detenteur" INTEGER,
    "numero_rc" VARCHAR(50),
    "date_enregistrement" TIMESTAMP(3),
    "capital_social" DOUBLE PRECISION,
    "nis" VARCHAR(50),
    "nif" VARCHAR(50),
    "adresse_legale" TEXT,

    CONSTRAINT "registre_commerce_portail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demandes_portail" (
    "id" SERIAL NOT NULL,
    "idInterne" INTEGER,
    "code" VARCHAR(50),
    "titre" VARCHAR(255),
    "typePermis" VARCHAR(100) NOT NULL,
    "statut" "StatutDemande" NOT NULL DEFAULT 'EN_ATTENTE',
    "wilaya" VARCHAR(100),
    "daira" VARCHAR(100),
    "commune" VARCHAR(100),
    "lieuDitFr" VARCHAR(255),
    "lieuDitAr" VARCHAR(255),
    "statutTerrain" VARCHAR(100),
    "occupantLegal" VARCHAR(255),
    "superficieHa" DOUBLE PRECISION,
    "polygonGeo" JSONB,
    "idUtilisateur" INTEGER NOT NULL,
    "idEntreprise" INTEGER,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demandes_portail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permis_portail" (
    "id" SERIAL NOT NULL,
    "idInterne" INTEGER,
    "code_permis" VARCHAR(50),
    "date_octroi" TIMESTAMP(3),
    "date_expiration" TIMESTAMP(3),
    "typePermis" VARCHAR(100),
    "superficie" DOUBLE PRECISION,
    "lieu_ditFR" VARCHAR(255),
    "lieu_ditAR" VARCHAR(255),
    "statut_permis" VARCHAR(50),
    "commentaires" TEXT,
    "demandeOrigineId" INTEGER,

    CONSTRAINT "permis_portail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entreprise_permis" (
    "entrepriseId" INTEGER NOT NULL,
    "permisId" INTEGER NOT NULL,

    CONSTRAINT "entreprise_permis_pkey" PRIMARY KEY ("entrepriseId","permisId")
);

-- CreateTable
CREATE TABLE "documents_demande_portail" (
    "id" SERIAL NOT NULL,
    "idDemande" INTEGER NOT NULL,
    "nomFichier" VARCHAR(255) NOT NULL,
    "urlFichier" TEXT NOT NULL,
    "statut" VARCHAR(50) NOT NULL DEFAULT 'DEPOT',
    "deposeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_demande_portail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents_procedure_portail" (
    "id" SERIAL NOT NULL,
    "idProcedure" INTEGER NOT NULL,
    "nomFichier" VARCHAR(255) NOT NULL,
    "urlFichier" TEXT NOT NULL,
    "statut" VARCHAR(50) NOT NULL DEFAULT 'DEPOT',
    "deposeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_procedure_portail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedures_portail" (
    "id" SERIAL NOT NULL,
    "idInterne" INTEGER,
    "type" "TypeProcedure" NOT NULL,
    "description" TEXT,
    "statut" "StatutDemande" NOT NULL DEFAULT 'EN_ATTENTE',
    "codePermis" VARCHAR(50) NOT NULL,
    "idUtilisateur" INTEGER NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procedures_portail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "substances_portail" (
    "id_sub" SERIAL NOT NULL,
    "nom_subFR" VARCHAR(150) NOT NULL,
    "nom_subAR" VARCHAR(150),
    "categorie_sub" VARCHAR(100),
    "famille_sub" VARCHAR(100),
    "id_redevance" INTEGER,

    CONSTRAINT "substances_portail_pkey" PRIMARY KEY ("id_sub")
);

-- CreateTable
CREATE TABLE "substance_associee_demande_portail" (
    "id_assoc" SERIAL NOT NULL,
    "id_proc" INTEGER NOT NULL,
    "id_substance" INTEGER NOT NULL,
    "priorite" "EnumPriorite" NOT NULL,
    "date_ajout" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "substance_associee_demande_portail_pkey" PRIMARY KEY ("id_assoc")
);

-- CreateTable
CREATE TABLE "coordonnee_portail" (
    "id_coordonnees" SERIAL NOT NULL,
    "point" VARCHAR(100),
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "z" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "system" VARCHAR(20) DEFAULT 'WGS84',
    "zone" INTEGER,
    "hemisphere" VARCHAR(1),

    CONSTRAINT "coordonnee_portail_pkey" PRIMARY KEY ("id_coordonnees")
);

-- CreateTable
CREATE TABLE "procedure_coord_portail" (
    "id_procedureCoord" SERIAL NOT NULL,
    "id_proc" INTEGER NOT NULL,
    "id_coordonnees" INTEGER NOT NULL,
    "statut_coord" "StatutCoordPortail" NOT NULL,

    CONSTRAINT "procedure_coord_portail_pkey" PRIMARY KEY ("id_procedureCoord")
);

-- CreateTable
CREATE TABLE "inscription_provisoire_portail" (
    "id" SERIAL NOT NULL,
    "id_proc" INTEGER NOT NULL,
    "points" JSONB NOT NULL,
    "system" VARCHAR(20),
    "zone" INTEGER,
    "hemisphere" VARCHAR(1),
    "superficie_declaree" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inscription_provisoire_portail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiements_portail" (
    "id" SERIAL NOT NULL,
    "idInterne" INTEGER,
    "idUtilisateur" INTEGER NOT NULL,
    "idDemande" INTEGER,
    "idProcedure" INTEGER,
    "montant" DOUBLE PRECISION NOT NULL,
    "devise" VARCHAR(3) NOT NULL DEFAULT 'DZD',
    "fournisseur" VARCHAR(100),
    "idTransaction" VARCHAR(100),
    "statut" "StatutPaiement" NOT NULL DEFAULT 'EN_ATTENTE',
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paiements_portail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historiques_portail" (
    "id" SERIAL NOT NULL,
    "idUtilisateur" INTEGER NOT NULL,
    "typeEntite" VARCHAR(100) NOT NULL,
    "idDemande" INTEGER,
    "idProcedure" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "dateAction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historiques_portail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correspondance_synchro" (
    "id" SERIAL NOT NULL,
    "entitePortail" VARCHAR(100) NOT NULL,
    "idPortail" INTEGER NOT NULL,
    "entiteInterne" VARCHAR(100) NOT NULL,
    "idInterne" INTEGER NOT NULL,
    "statut" VARCHAR(20) NOT NULL DEFAULT 'SYNCED',
    "error" JSONB,
    "synchroLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correspondance_synchro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_portail_idInterne_key" ON "utilisateurs_portail"("idInterne");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_portail_email_key" ON "utilisateurs_portail"("email");

-- CreateIndex
CREATE INDEX "utilisateurs_portail_email_idx" ON "utilisateurs_portail"("email");

-- CreateIndex
CREATE INDEX "utilisateurs_portail_roleId_idx" ON "utilisateurs_portail"("roleId");

-- CreateIndex
CREATE INDEX "utilisateurs_portail_deletedAt_idx" ON "utilisateurs_portail"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_portail_token_key" ON "sessions_portail"("token");

-- CreateIndex
CREATE INDEX "sessions_portail_token_idx" ON "sessions_portail"("token");

-- CreateIndex
CREATE INDEX "sessions_portail_userId_idx" ON "sessions_portail"("userId");

-- CreateIndex
CREATE INDEX "sessions_portail_expiresAt_idx" ON "sessions_portail"("expiresAt");

-- CreateIndex
CREATE INDEX "audit_logs_portail_entityType_idx" ON "audit_logs_portail"("entityType");

-- CreateIndex
CREATE INDEX "audit_logs_portail_entityId_idx" ON "audit_logs_portail"("entityId");

-- CreateIndex
CREATE INDEX "audit_logs_portail_userId_idx" ON "audit_logs_portail"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_portail_timestamp_idx" ON "audit_logs_portail"("timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_portail_contextId_idx" ON "audit_logs_portail"("contextId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "groups_name_key" ON "groups"("name");

-- CreateIndex
CREATE INDEX "conversations_user1Id_idx" ON "conversations"("user1Id");

-- CreateIndex
CREATE INDEX "conversations_user2Id_idx" ON "conversations"("user2Id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_user1Id_user2Id_key" ON "conversations"("user1Id", "user2Id");

-- CreateIndex
CREATE INDEX "messages_portail_senderId_idx" ON "messages_portail"("senderId");

-- CreateIndex
CREATE INDEX "messages_portail_receiverId_idx" ON "messages_portail"("receiverId");

-- CreateIndex
CREATE INDEX "messages_portail_conversationId_idx" ON "messages_portail"("conversationId");

-- CreateIndex
CREATE INDEX "messages_portail_createdAt_idx" ON "messages_portail"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_portail_idUtilisateur_idx" ON "notifications_portail"("idUtilisateur");

-- CreateIndex
CREATE INDEX "notifications_portail_vu_idx" ON "notifications_portail"("vu");

-- CreateIndex
CREATE UNIQUE INDEX "pays_code_pays_key" ON "pays"("code_pays");

-- CreateIndex
CREATE UNIQUE INDEX "nationalite_libelle_key" ON "nationalite"("libelle");

-- CreateIndex
CREATE UNIQUE INDEX "statut_juridique_portail_code_statut_key" ON "statut_juridique_portail"("code_statut");

-- CreateIndex
CREATE UNIQUE INDEX "personnes_physiques_portail_num_carte_identite_key" ON "personnes_physiques_portail"("num_carte_identite");

-- CreateIndex
CREATE INDEX "personnes_physiques_portail_num_carte_identite_idx" ON "personnes_physiques_portail"("num_carte_identite");

-- CreateIndex
CREATE UNIQUE INDEX "entreprises_portail_idInterne_key" ON "entreprises_portail"("idInterne");

-- CreateIndex
CREATE INDEX "entreprises_portail_nom_societeFR_idx" ON "entreprises_portail"("nom_societeFR");

-- CreateIndex
CREATE UNIQUE INDEX "demandes_portail_code_key" ON "demandes_portail"("code");

-- CreateIndex
CREATE INDEX "demandes_portail_statut_idx" ON "demandes_portail"("statut");

-- CreateIndex
CREATE INDEX "demandes_portail_code_idx" ON "demandes_portail"("code");

-- CreateIndex
CREATE INDEX "demandes_portail_idUtilisateur_idx" ON "demandes_portail"("idUtilisateur");

-- CreateIndex
CREATE INDEX "demandes_portail_idEntreprise_idx" ON "demandes_portail"("idEntreprise");

-- CreateIndex
CREATE UNIQUE INDEX "permis_portail_idInterne_key" ON "permis_portail"("idInterne");

-- CreateIndex
CREATE UNIQUE INDEX "permis_portail_code_permis_key" ON "permis_portail"("code_permis");

-- CreateIndex
CREATE INDEX "permis_portail_code_permis_idx" ON "permis_portail"("code_permis");

-- CreateIndex
CREATE INDEX "procedures_portail_statut_idx" ON "procedures_portail"("statut");

-- CreateIndex
CREATE INDEX "procedures_portail_codePermis_idx" ON "procedures_portail"("codePermis");

-- CreateIndex
CREATE UNIQUE INDEX "substance_associee_demande_portail_id_proc_id_substance_key" ON "substance_associee_demande_portail"("id_proc", "id_substance");

-- CreateIndex
CREATE UNIQUE INDEX "procedure_coord_portail_id_proc_id_coordonnees_key" ON "procedure_coord_portail"("id_proc", "id_coordonnees");

-- CreateIndex
CREATE UNIQUE INDEX "inscription_provisoire_portail_id_proc_key" ON "inscription_provisoire_portail"("id_proc");

-- CreateIndex
CREATE INDEX "paiements_portail_statut_idx" ON "paiements_portail"("statut");

-- CreateIndex
CREATE INDEX "historiques_portail_idUtilisateur_idx" ON "historiques_portail"("idUtilisateur");

-- CreateIndex
CREATE INDEX "historiques_portail_typeEntite_idx" ON "historiques_portail"("typeEntite");

-- CreateIndex
CREATE INDEX "historiques_portail_idDemande_idx" ON "historiques_portail"("idDemande");

-- CreateIndex
CREATE INDEX "historiques_portail_idProcedure_idx" ON "historiques_portail"("idProcedure");

-- CreateIndex
CREATE UNIQUE INDEX "correspondance_synchro_entitePortail_idPortail_key" ON "correspondance_synchro"("entitePortail", "idPortail");

-- CreateIndex
CREATE UNIQUE INDEX "correspondance_synchro_entiteInterne_idInterne_key" ON "correspondance_synchro"("entiteInterne", "idInterne");

-- AddForeignKey
ALTER TABLE "utilisateurs_portail" ADD CONSTRAINT "utilisateurs_portail_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions_portail" ADD CONSTRAINT "sessions_portail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "utilisateurs_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs_portail" ADD CONSTRAINT "audit_logs_portail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "utilisateurs_portail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "utilisateurs_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_permissions" ADD CONSTRAINT "group_permissions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_permissions" ADD CONSTRAINT "group_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "utilisateurs_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "utilisateurs_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages_portail" ADD CONSTRAINT "messages_portail_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "utilisateurs_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages_portail" ADD CONSTRAINT "messages_portail_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "utilisateurs_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages_portail" ADD CONSTRAINT "messages_portail_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications_portail" ADD CONSTRAINT "notifications_portail_idUtilisateur_fkey" FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnes_physiques_portail" ADD CONSTRAINT "personnes_physiques_portail_id_pays_fkey" FOREIGN KEY ("id_pays") REFERENCES "pays"("id_pays") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnes_physiques_portail" ADD CONSTRAINT "personnes_physiques_portail_id_nationalite_fkey" FOREIGN KEY ("id_nationalite") REFERENCES "nationalite"("id_nationalite") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entreprises_portail" ADD CONSTRAINT "entreprises_portail_id_statutJuridique_fkey" FOREIGN KEY ("id_statutJuridique") REFERENCES "statut_juridique_portail"("id_statutJuridique") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entreprises_portail" ADD CONSTRAINT "entreprises_portail_id_pays_fkey" FOREIGN KEY ("id_pays") REFERENCES "pays"("id_pays") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entreprises_portail" ADD CONSTRAINT "entreprises_portail_id_nationalite_fkey" FOREIGN KEY ("id_nationalite") REFERENCES "nationalite"("id_nationalite") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fonction_personne_morale_portail" ADD CONSTRAINT "fonction_personne_morale_portail_id_detenteur_fkey" FOREIGN KEY ("id_detenteur") REFERENCES "entreprises_portail"("id_detenteur") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fonction_personne_morale_portail" ADD CONSTRAINT "fonction_personne_morale_portail_id_personne_fkey" FOREIGN KEY ("id_personne") REFERENCES "personnes_physiques_portail"("id_personne") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registre_commerce_portail" ADD CONSTRAINT "registre_commerce_portail_id_detenteur_fkey" FOREIGN KEY ("id_detenteur") REFERENCES "entreprises_portail"("id_detenteur") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_portail" ADD CONSTRAINT "demandes_portail_idUtilisateur_fkey" FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_portail" ADD CONSTRAINT "demandes_portail_idEntreprise_fkey" FOREIGN KEY ("idEntreprise") REFERENCES "entreprises_portail"("id_detenteur") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permis_portail" ADD CONSTRAINT "permis_portail_demandeOrigineId_fkey" FOREIGN KEY ("demandeOrigineId") REFERENCES "demandes_portail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entreprise_permis" ADD CONSTRAINT "entreprise_permis_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "entreprises_portail"("id_detenteur") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entreprise_permis" ADD CONSTRAINT "entreprise_permis_permisId_fkey" FOREIGN KEY ("permisId") REFERENCES "permis_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents_demande_portail" ADD CONSTRAINT "documents_demande_portail_idDemande_fkey" FOREIGN KEY ("idDemande") REFERENCES "demandes_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents_procedure_portail" ADD CONSTRAINT "documents_procedure_portail_idProcedure_fkey" FOREIGN KEY ("idProcedure") REFERENCES "procedures_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedures_portail" ADD CONSTRAINT "procedures_portail_idUtilisateur_fkey" FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substance_associee_demande_portail" ADD CONSTRAINT "substance_associee_demande_portail_id_proc_fkey" FOREIGN KEY ("id_proc") REFERENCES "procedures_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substance_associee_demande_portail" ADD CONSTRAINT "substance_associee_demande_portail_id_substance_fkey" FOREIGN KEY ("id_substance") REFERENCES "substances_portail"("id_sub") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_coord_portail" ADD CONSTRAINT "procedure_coord_portail_id_proc_fkey" FOREIGN KEY ("id_proc") REFERENCES "procedures_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_coord_portail" ADD CONSTRAINT "procedure_coord_portail_id_coordonnees_fkey" FOREIGN KEY ("id_coordonnees") REFERENCES "coordonnee_portail"("id_coordonnees") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscription_provisoire_portail" ADD CONSTRAINT "inscription_provisoire_portail_id_proc_fkey" FOREIGN KEY ("id_proc") REFERENCES "procedures_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_portail" ADD CONSTRAINT "paiements_portail_idUtilisateur_fkey" FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_portail" ADD CONSTRAINT "paiements_portail_idDemande_fkey" FOREIGN KEY ("idDemande") REFERENCES "demandes_portail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_portail" ADD CONSTRAINT "paiements_portail_idProcedure_fkey" FOREIGN KEY ("idProcedure") REFERENCES "procedures_portail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historiques_portail" ADD CONSTRAINT "historiques_portail_idUtilisateur_fkey" FOREIGN KEY ("idUtilisateur") REFERENCES "utilisateurs_portail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historiques_portail" ADD CONSTRAINT "historiques_portail_idDemande_fkey" FOREIGN KEY ("idDemande") REFERENCES "demandes_portail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historiques_portail" ADD CONSTRAINT "historiques_portail_idProcedure_fkey" FOREIGN KEY ("idProcedure") REFERENCES "procedures_portail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

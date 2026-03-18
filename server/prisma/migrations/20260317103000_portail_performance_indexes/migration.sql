-- Performance indexes for main portail tables
-- Scope: demande, inscription_provisoire, notifications_portail, messages_portail, PermisPortail, utilisateurs_portail
-- Note: "code_provisoire" is not present in current Prisma model/table mapping for inscription_provisoire, so no index is created for it here.

CREATE INDEX IF NOT EXISTS "utilisateurs_portail_detenteurId_idx"
  ON "utilisateurs_portail"("detenteurId");

CREATE INDEX IF NOT EXISTS "messages_portail_conversationId_createdAt_idx"
  ON "messages_portail"("conversationId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "messages_portail_receiverId_isRead_createdAt_idx"
  ON "messages_portail"("receiverId", "isRead", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "notifications_portail_userId_createdAt_idx"
  ON "notifications_portail"("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "notifications_portail_isRead_createdAt_idx"
  ON "notifications_portail"("isRead", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "notifications_portail_createdAt_idx"
  ON "notifications_portail"("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "notif_rel_entity_createdAt_idx"
  ON "notifications_portail"("relatedEntityId", "relatedEntityType", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "demande_code_demande_idx"
  ON "demande"("code_demande");

CREATE INDEX IF NOT EXISTS "demande_utilisateur_id_idx"
  ON "demande"("utilisateurId");

CREATE INDEX IF NOT EXISTS "demande_statut_demande_idx"
  ON "demande"("statut_demande");

CREATE INDEX IF NOT EXISTS "demande_date_demande_desc_idx"
  ON "demande"("date_demande" DESC);

CREATE INDEX IF NOT EXISTS "demande_id_proc_idx"
  ON "demande"("id_proc");

CREATE INDEX IF NOT EXISTS "demande_id_typepermis_idx"
  ON "demande"("id_typePermis");

CREATE INDEX IF NOT EXISTS "demande_statut_date_demande_idx"
  ON "demande"("statut_demande", "date_demande" DESC);

CREATE INDEX IF NOT EXISTS "demande_utilisateur_statut_date_idx"
  ON "demande"("utilisateurId", "statut_demande", "date_demande" DESC);

CREATE INDEX IF NOT EXISTS "demande_typepermis_statut_date_idx"
  ON "demande"("id_typePermis", "statut_demande", "date_demande" DESC);

CREATE INDEX IF NOT EXISTS "demande_id_proc_date_demande_idx"
  ON "demande"("id_proc", "date_demande" DESC);

CREATE INDEX IF NOT EXISTS "idx_permis_id_detenteur"
  ON "PermisPortail"("id_detenteur");

CREATE INDEX IF NOT EXISTS "idx_permis_date_expiration"
  ON "PermisPortail"("date_expiration" DESC);

CREATE INDEX IF NOT EXISTS "idx_permis_id_detenteur_date_expiration"
  ON "PermisPortail"("id_detenteur", "date_expiration" DESC);

CREATE INDEX IF NOT EXISTS "inscription_provisoire_createdAt_idx"
  ON "inscription_provisoire"("createdAt" DESC);


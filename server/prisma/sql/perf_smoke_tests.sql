-- Perf smoke tests (replace literal IDs with real values from your DB)
-- Goal: compare execution plans before/after indexes.

-- 1) Demandes list for a user (dashboard)
EXPLAIN (ANALYZE, BUFFERS)
SELECT d.*
FROM "demande" d
WHERE d."utilisateurId" = 1
ORDER BY d."date_demande" DESC
LIMIT 20;

-- 2) Demandes by status + date range
EXPLAIN (ANALYZE, BUFFERS)
SELECT d."id_demande", d."code_demande", d."statut_demande", d."date_demande"
FROM "demande" d
WHERE d."statut_demande" = 'EN_ATTENTE'
  AND d."date_demande" >= now() - interval '90 days'
ORDER BY d."date_demande" DESC
LIMIT 50;

-- 3) Count deposited demandes by permit type
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*)
FROM "demande" d
WHERE d."id_typePermis" = 1
  AND d."date_demande" IS NOT NULL;

-- 4) User notifications list
EXPLAIN (ANALYZE, BUFFERS)
SELECT n.*
FROM "notifications_portail" n
WHERE n."userId" = 1
ORDER BY n."createdAt" DESC
LIMIT 20;

-- 5) Unread notifications count
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*)
FROM "notifications_portail" n
WHERE n."userId" = 1
  AND n."isRead" = false;

-- 6) Latest identification event (login flow)
EXPLAIN (ANALYZE, BUFFERS)
SELECT n."relatedEntityType"
FROM "notifications_portail" n
WHERE n."relatedEntityId" = 1
  AND n."relatedEntityType" IN (
    'entreprise_identification_request',
    'entreprise_identification_request_resubmitted',
    'entreprise_identification_confirmed',
    'entreprise_identification_rejected'
  )
ORDER BY n."createdAt" DESC
LIMIT 1;

-- 7) Conversation messages
EXPLAIN (ANALYZE, BUFFERS)
SELECT m.*
FROM "messages_portail" m
WHERE m."conversationId" = 1
ORDER BY m."createdAt" ASC;

-- 8) Unread messages for receiver
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*)
FROM "messages_portail" m
WHERE m."receiverId" = 1
  AND m."isRead" = false;

-- 9) Permis list by holder
EXPLAIN (ANALYZE, BUFFERS)
SELECT p.*
FROM "PermisPortail" p
WHERE p."id_detenteur" = 1
ORDER BY p."date_expiration" DESC
LIMIT 50;

-- 10) Login lookup
EXPLAIN (ANALYZE, BUFFERS)
SELECT u."id", u."email", u."username"
FROM "utilisateurs_portail" u
WHERE u."email" = 'user@example.com'
LIMIT 1;


-- Extend the cadastral document workflow for administrative processing.
ALTER TYPE "StatutDemandeDocument" ADD VALUE IF NOT EXISTS 'EN_COURS_EXAMEN';
ALTER TYPE "StatutDemandeDocument" ADD VALUE IF NOT EXISTS 'ACCEPTEE';
ALTER TYPE "StatutDemandeDocument" ADD VALUE IF NOT EXISTS 'EN_COMPLEMENT';
ALTER TYPE "StatutDemandeDocument" ADD VALUE IF NOT EXISTS 'REJETEE';

ALTER TYPE "ActionDocumentCadastral" ADD VALUE IF NOT EXISTS 'DEMANDE_ACCEPTEE';
ALTER TYPE "ActionDocumentCadastral" ADD VALUE IF NOT EXISTS 'DEMANDE_REJETEE';
ALTER TYPE "ActionDocumentCadastral" ADD VALUE IF NOT EXISTS 'COMPLEMENT_DEMANDE';
ALTER TYPE "ActionDocumentCadastral" ADD VALUE IF NOT EXISTS 'NOTE_AJOUTEE';
ALTER TYPE "ActionDocumentCadastral" ADD VALUE IF NOT EXISTS 'DEMANDE_ASSIGNEE';

INSERT INTO "permissions" ("name")
VALUES ('manage_cadastre_documents')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."name" = 'manage_cadastre_documents'
WHERE r."name" IN ('admin', 'administrateur')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

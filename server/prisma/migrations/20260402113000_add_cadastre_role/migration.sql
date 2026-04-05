INSERT INTO "roles" ("name")
VALUES ('cadastre')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "roles" r
JOIN "permissions" p
  ON p.name IN ('view_dashboard', 'dashboard')
WHERE r.name = 'cadastre'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

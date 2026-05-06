INSERT INTO "StaticPage" ("id", "slug", "title", "content", "locale", "updatedBy") VALUES
  ('staticpage_documentation_fr', 'documentation', 'Documentation', '<p>Ce contenu est modifiable depuis l''administration.</p><p>Ajoutez ici la documentation publique officielle.</p>', 'fr', NULL),
  ('staticpage_documentation_ar', 'documentation', 'Documentation (AR)', '<p>Contenu arabe a definir depuis l''administration.</p>', 'ar', NULL),
  ('staticpage_contact_fr', 'contact', 'Contact', '<p>Ce contenu est modifiable depuis l''administration.</p><p>Ajoutez ici les informations de contact officielles.</p>', 'fr', NULL),
  ('staticpage_contact_ar', 'contact', 'Contact (AR)', '<p>Contenu arabe a definir depuis l''administration.</p>', 'ar', NULL)
ON CONFLICT ("slug", "locale") DO NOTHING;

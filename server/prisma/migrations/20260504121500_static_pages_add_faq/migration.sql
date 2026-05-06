INSERT INTO "StaticPage" ("id", "slug", "title", "content", "locale", "updatedBy") VALUES
  ('staticpage_faq_fr', 'faq', 'FAQ - Foire aux questions', '<p>Ce contenu est modifiable depuis l''administration.</p><p>Ajoutez ici la FAQ officielle.</p>', 'fr', NULL),
  ('staticpage_faq_ar', 'faq', 'FAQ', '<p>Ce contenu est modifiable depuis l''administration.</p><p>Ajoutez ici la FAQ officielle.</p>', 'ar', NULL)
ON CONFLICT ("slug", "locale") DO NOTHING;

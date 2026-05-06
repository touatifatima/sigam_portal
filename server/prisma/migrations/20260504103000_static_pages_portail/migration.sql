CREATE TABLE IF NOT EXISTS "StaticPage" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'fr',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedBy" TEXT,
  CONSTRAINT "StaticPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StaticPage_slug_locale_key" ON "StaticPage"("slug", "locale");

INSERT INTO "StaticPage" ("id", "slug", "title", "content", "locale", "updatedBy") VALUES
  ('staticpage_conditions_fr', 'conditions-utilisation', 'Conditions d''utilisation', '<p>Ce contenu est modifiable depuis l''administration.</p><p>Ajoutez ici les conditions d''utilisation officielles.</p>', 'fr', NULL),
  ('staticpage_privacy_fr', 'politique-confidentialite', 'Politique de confidentialite', '<p>Ce contenu est modifiable depuis l''administration.</p><p>Ajoutez ici la politique de confidentialite officielle.</p>', 'fr', NULL),
  ('staticpage_legal_fr', 'mentions-legales', 'Mentions legales', '<p>Ce contenu est modifiable depuis l''administration.</p><p>Ajoutez ici les mentions legales officielles.</p>', 'fr', NULL),
  ('staticpage_conditions_ar', 'conditions-utilisation', 'Conditions d''utilisation (AR)', '<p>Contenu arabe a definir depuis l''administration.</p>', 'ar', NULL),
  ('staticpage_privacy_ar', 'politique-confidentialite', 'Politique de confidentialite (AR)', '<p>Contenu arabe a definir depuis l''administration.</p>', 'ar', NULL),
  ('staticpage_legal_ar', 'mentions-legales', 'Mentions legales (AR)', '<p>Contenu arabe a definir depuis l''administration.</p>', 'ar', NULL)
ON CONFLICT ("slug", "locale") DO NOTHING;

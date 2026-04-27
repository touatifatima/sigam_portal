CREATE TABLE IF NOT EXISTS "actualites_portail" (
  "id" SERIAL NOT NULL,
  "slug" VARCHAR(180) NOT NULL,
  "title" VARCHAR(220) NOT NULL,
  "excerpt" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "category" VARCHAR(60) NOT NULL DEFAULT 'Actualite',
  "author" VARCHAR(120) NOT NULL DEFAULT 'Equipe POM',
  "imageUrl" TEXT,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "actualites_portail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "actualites_portail_slug_key" ON "actualites_portail"("slug");
CREATE INDEX IF NOT EXISTS "actualites_portail_published_idx" ON "actualites_portail"("isPublished", "publishedAt" DESC);
CREATE INDEX IF NOT EXISTS "actualites_portail_featured_idx" ON "actualites_portail"("isFeatured");
CREATE INDEX IF NOT EXISTS "actualites_portail_category_idx" ON "actualites_portail"("category");
CREATE INDEX IF NOT EXISTS "actualites_portail_updated_idx" ON "actualites_portail"("updatedAt" DESC);
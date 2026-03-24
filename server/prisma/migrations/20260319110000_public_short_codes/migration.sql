CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "demande"
ADD COLUMN IF NOT EXISTS "short_code" UUID;

UPDATE "demande"
SET "short_code" = gen_random_uuid()
WHERE "short_code" IS NULL;

ALTER TABLE "demande"
ALTER COLUMN "short_code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "demande_short_code_key"
ON "demande"("short_code");

ALTER TABLE "PermisPortail"
ADD COLUMN IF NOT EXISTS "short_code" UUID;

UPDATE "PermisPortail"
SET "short_code" = gen_random_uuid()
WHERE "short_code" IS NULL;

ALTER TABLE "PermisPortail"
ALTER COLUMN "short_code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "PermisPortail_short_code_key"
ON "PermisPortail"("short_code");

ALTER TABLE "inscription_provisoire"
ADD COLUMN IF NOT EXISTS "short_code" UUID;

UPDATE "inscription_provisoire"
SET "short_code" = gen_random_uuid()
WHERE "short_code" IS NULL;

ALTER TABLE "inscription_provisoire"
ALTER COLUMN "short_code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "inscription_provisoire_short_code_key"
ON "inscription_provisoire"("short_code");

ALTER TABLE "detenteurmorale"
ADD COLUMN IF NOT EXISTS "short_code" UUID;

UPDATE "detenteurmorale"
SET "short_code" = gen_random_uuid()
WHERE "short_code" IS NULL;

ALTER TABLE "detenteurmorale"
ALTER COLUMN "short_code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "detenteurmorale_short_code_key"
ON "detenteurmorale"("short_code");

-- Add userId to notifications_portail before the performance index migration.
-- This keeps prisma migrate dev working with the shadow database while remaining
-- safe on existing databases that may already have the column or some legacy rows.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'notifications_portail'
      AND column_name = 'userId'
  ) THEN
    ALTER TABLE "notifications_portail"
      ADD COLUMN "userId" INTEGER;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_portail_userId_fkey'
  ) THEN
    ALTER TABLE "notifications_portail"
      ADD CONSTRAINT "notifications_portail_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "utilisateurs_portail"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'notifications_portail'
      AND column_name = 'userId'
      AND is_nullable = 'NO'
  ) AND NOT EXISTS (
    SELECT 1
    FROM "notifications_portail"
    WHERE "userId" IS NULL
  ) THEN
    ALTER TABLE "notifications_portail"
      ALTER COLUMN "userId" SET NOT NULL;
  END IF;
END $$;

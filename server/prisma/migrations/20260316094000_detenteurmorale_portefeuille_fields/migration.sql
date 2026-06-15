-- Add the portefeuille fields to detenteurmorale before later migrations.
-- Safe for databases that already received the columns manually.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'detenteurmorale'
      AND column_name = 'portefeuille'
  ) THEN
    ALTER TABLE "detenteurmorale"
      ADD COLUMN "portefeuille" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'detenteurmorale'
      AND column_name = 'portefeuille_public_mode'
  ) THEN
    ALTER TABLE "detenteurmorale"
      ADD COLUMN "portefeuille_public_mode" BOOLEAN DEFAULT false;
  END IF;
END $$;

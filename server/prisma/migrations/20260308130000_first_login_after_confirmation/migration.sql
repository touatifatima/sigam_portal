ALTER TABLE "utilisateurs_portail"
ADD COLUMN IF NOT EXISTS "first_login_after_confirmation" BOOLEAN NOT NULL DEFAULT false;

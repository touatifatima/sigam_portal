ALTER TABLE "utilisateurs_portail"
ADD COLUMN IF NOT EXISTS "passwordResetTokenHash" VARCHAR(128),
ADD COLUMN IF NOT EXISTS "passwordResetTokenExpires" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "passwordResetTokenUsedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "utilisateurs_portail_passwordResetTokenHash_idx"
ON "utilisateurs_portail"("passwordResetTokenHash");

CREATE INDEX IF NOT EXISTS "utilisateurs_portail_passwordResetTokenExpires_idx"
ON "utilisateurs_portail"("passwordResetTokenExpires");

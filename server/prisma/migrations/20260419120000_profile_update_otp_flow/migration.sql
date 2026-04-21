ALTER TABLE "utilisateurs_portail"
ADD COLUMN IF NOT EXISTS "lastProfileUpdateAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "profileUpdatePendingData" JSONB,
ADD COLUMN IF NOT EXISTS "profileUpdateOtpHash" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "profileUpdateOtpExpiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "profileUpdateOtpRequestedAt" TIMESTAMP(3);

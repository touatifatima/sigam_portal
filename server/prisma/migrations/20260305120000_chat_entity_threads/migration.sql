-- Separate chat threads per entity (demande/permis/general)
ALTER TABLE "conversations"
ADD COLUMN IF NOT EXISTS "entityType" TEXT NOT NULL DEFAULT 'GENERAL',
ADD COLUMN IF NOT EXISTS "entityCode" TEXT NOT NULL DEFAULT 'GENERAL';

DROP INDEX IF EXISTS "conversations_user1Id_user2Id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "conversations_user1Id_user2Id_entityType_entityCode_key"
ON "conversations"("user1Id", "user2Id", "entityType", "entityCode");

CREATE INDEX IF NOT EXISTS "conversations_entityType_entityCode_idx"
ON "conversations"("entityType", "entityCode");

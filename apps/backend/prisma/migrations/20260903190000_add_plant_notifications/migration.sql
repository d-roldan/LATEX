ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TANK_ACTION_REQUIRED';

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "tankId" TEXT,
  ADD COLUMN IF NOT EXISTS "targetSector" TEXT;

CREATE INDEX IF NOT EXISTS "Notification_companyId_targetSector_createdAt_idx"
  ON "Notification"("companyId", "targetSector", "createdAt");

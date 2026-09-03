ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'JEFATURA';

ALTER TABLE "Tank"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "ProductionLot"
  ADD COLUMN "plannedQuantityKg" DECIMAL(12,3),
  ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "shift" TEXT,
  ADD COLUMN "scheduledAt" TIMESTAMPTZ(3),
  ALTER COLUMN "startedAt" TYPE TIMESTAMPTZ(3) USING "startedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "finishedAt" TYPE TIMESTAMPTZ(3) USING "finishedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "TankStateHistory"
  ADD COLUMN "weightKg" DECIMAL(12,3),
  ADD COLUMN "targetSeconds" INTEGER,
  ADD COLUMN "durationSeconds" INTEGER,
  ALTER COLUMN "startedAt" TYPE TIMESTAMPTZ(3) USING "startedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "endedAt" TYPE TIMESTAMPTZ(3) USING "endedAt" AT TIME ZONE 'UTC';

UPDATE "TankStateHistory"
SET "durationSeconds" = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ("endedAt" - "startedAt"))))::INTEGER
WHERE "endedAt" IS NOT NULL;

ALTER TABLE "QualityDecision"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "PackagingOrder"
  ADD COLUMN "producedKg" DECIMAL(12,3),
  ADD COLUMN "wasteKg" DECIMAL(12,3),
  ADD COLUMN "producedUnits" INTEGER,
  ALTER COLUMN "startedAt" TYPE TIMESTAMPTZ(3) USING "startedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "finishedAt" TYPE TIMESTAMPTZ(3) USING "finishedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "PlantAuditLog"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

CREATE TABLE "DailyPlantClosure" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "snapshot" JSONB NOT NULL,
  "notes" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "DailyPlantClosure_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DailyPlantClosure_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DailyPlantClosure_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DailyPlantClosure_companyId_date_key" ON "DailyPlantClosure"("companyId", "date");
CREATE INDEX "DailyPlantClosure_companyId_date_idx" ON "DailyPlantClosure"("companyId", "date");

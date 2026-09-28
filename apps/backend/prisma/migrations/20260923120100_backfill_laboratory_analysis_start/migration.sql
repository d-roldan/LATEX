ALTER TABLE "LaboratorySample"
  ADD COLUMN "analysisStartedAt" TIMESTAMPTZ(3),
  ADD COLUMN "analysisStartedByUserId" TEXT;

ALTER TABLE "LaboratorySample"
  ADD CONSTRAINT "LaboratorySample_analysisStartedByUserId_fkey"
  FOREIGN KEY ("analysisStartedByUserId") REFERENCES "User"("id") ON DELETE SET NULL;

-- Hasta esta versión RECEIVED significaba que el análisis ya había comenzado.
UPDATE "LaboratorySample"
SET
  "status" = 'ANALYZING',
  "analysisStartedAt" = "receivedAt",
  "analysisStartedByUserId" = "receivedByUserId"
WHERE "status" = 'RECEIVED';

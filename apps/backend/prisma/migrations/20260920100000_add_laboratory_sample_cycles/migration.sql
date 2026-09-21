-- Hitos de cada ciclo de Laboratorio sin agregar estados físicos al tanque.
CREATE TYPE "LaboratorySampleStatus" AS ENUM ('AWAITING_RECEIPT', 'RECEIVED', 'RESOLVED');

CREATE TABLE "LaboratorySample" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "plantId" TEXT NOT NULL,
  "tankId" TEXT NOT NULL,
  "lotId" TEXT NOT NULL,
  "iteration" INTEGER NOT NULL,
  "status" "LaboratorySampleStatus" NOT NULL DEFAULT 'AWAITING_RECEIPT',
  "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requestedByUserId" TEXT,
  "receivedAt" TIMESTAMPTZ(3),
  "receivedByUserId" TEXT,
  "resolvedAt" TIMESTAMPTZ(3),
  "qualityDecisionId" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LaboratorySample_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LaboratorySample_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT,
  CONSTRAINT "LaboratorySample_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT,
  CONSTRAINT "LaboratorySample_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "Tank"("id") ON DELETE RESTRICT,
  CONSTRAINT "LaboratorySample_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "ProductionLot"("id") ON DELETE CASCADE,
  CONSTRAINT "LaboratorySample_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL,
  CONSTRAINT "LaboratorySample_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL,
  CONSTRAINT "LaboratorySample_qualityDecisionId_fkey" FOREIGN KEY ("qualityDecisionId") REFERENCES "QualityDecision"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "LaboratorySample_qualityDecisionId_key" ON "LaboratorySample"("qualityDecisionId");
CREATE UNIQUE INDEX "LaboratorySample_lotId_iteration_key" ON "LaboratorySample"("lotId", "iteration");
CREATE INDEX "LaboratorySample_plantId_status_requestedAt_idx" ON "LaboratorySample"("plantId", "status", "requestedAt");
CREATE INDEX "LaboratorySample_tankId_requestedAt_idx" ON "LaboratorySample"("tankId", "requestedAt");
CREATE INDEX "LaboratorySample_lotId_requestedAt_idx" ON "LaboratorySample"("lotId", "requestedAt");

-- Compatibilidad: todo tanque que ya esté esperando en Laboratorio recibe un ciclo abierto.
INSERT INTO "LaboratorySample" (
  "id", "companyId", "plantId", "tankId", "lotId", "iteration", "status", "requestedAt"
)
SELECT
  'labsample_' || md5(t."id" || t."activeLotId"),
  t."companyId",
  t."plantId",
  t."id",
  t."activeLotId",
  1,
  'AWAITING_RECEIPT',
  COALESCE(h."startedAt", CURRENT_TIMESTAMP)
FROM "Tank" t
LEFT JOIN LATERAL (
  SELECT "startedAt"
  FROM "TankStateHistory"
  WHERE "tankId" = t."id" AND "state" = 'LABORATORIO' AND "endedAt" IS NULL
  ORDER BY "startedAt" DESC
  LIMIT 1
) h ON true
WHERE t."state" = 'LABORATORIO' AND t."activeLotId" IS NOT NULL
ON CONFLICT ("lotId", "iteration") DO NOTHING;

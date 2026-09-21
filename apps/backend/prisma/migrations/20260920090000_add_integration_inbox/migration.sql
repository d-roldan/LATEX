-- Bandeja durable e idempotente para eventos provenientes de PLC/SCADA/Node-RED.
-- Esta migración sólo recibe eventos: no modifica automáticamente estados productivos.
CREATE TYPE "IntegrationInboxStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');

CREATE TABLE "IntegrationInbox" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "plantId" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL,
  "sequence" TEXT,
  "payload" JSONB NOT NULL,
  "status" "IntegrationInboxStatus" NOT NULL DEFAULT 'RECEIVED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMPTZ(3),
  CONSTRAINT "IntegrationInbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IntegrationInbox_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT,
  CONSTRAINT "IntegrationInbox_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT,
  CONSTRAINT "IntegrationInbox_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "PlantIntegration"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "IntegrationInbox_plantId_source_eventId_key"
  ON "IntegrationInbox"("plantId", "source", "eventId");
CREATE INDEX "IntegrationInbox_plantId_status_receivedAt_idx"
  ON "IntegrationInbox"("plantId", "status", "receivedAt");
CREATE INDEX "IntegrationInbox_plantId_occurredAt_idx"
  ON "IntegrationInbox"("plantId", "occurredAt");
CREATE INDEX "IntegrationInbox_integrationId_receivedAt_idx"
  ON "IntegrationInbox"("integrationId", "receivedAt");

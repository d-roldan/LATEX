-- Evolución aditiva y preservadora del módulo de planta.
ALTER TYPE "TankState" ADD VALUE IF NOT EXISTS 'TRASVASANDO';
CREATE TYPE "PlantFinalOperation" AS ENUM ('PACKAGING', 'TRANSFER');
CREATE TYPE "EquipmentType" AS ENUM ('TANK', 'DISPERSER');
CREATE TYPE "TelemetryMode" AS ENUM ('AUTOMATIC', 'NOT_INSTALLED', 'PENDING');

CREATE TABLE "Plant" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "finalOperation" "PlantFinalOperation" NOT NULL, "settings" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Plant_pkey" PRIMARY KEY ("id"), CONSTRAINT "Plant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "Plant_companyId_code_key" ON "Plant"("companyId", "code");
CREATE INDEX "Plant_companyId_isActive_displayOrder_idx" ON "Plant"("companyId", "isActive", "displayOrder");

-- Un único registro LATEX por empresa permite backfill sin alterar IDs históricos.
INSERT INTO "Plant" ("id", "companyId", "code", "name", "displayOrder", "finalOperation", "settings")
SELECT 'plant_latex_' || md5("id"), "id", 'LATEX', 'Látex', 10, 'PACKAGING',
  jsonb_build_object('packagingLines', COALESCE("settings"->'packagingLines','[]'::jsonb), 'packagingFormats', COALESCE("settings"->'packagingFormats','[]'::jsonb), 'adjustmentReasons', COALESCE("settings"->'adjustmentReasons','[]'::jsonb), 'stageTargetsMinutes', COALESCE("settings"->'plantStageTargetsMinutes','{}'::jsonb))
FROM "Company" ON CONFLICT ("companyId", "code") DO NOTHING;

ALTER TABLE "Tank" ADD COLUMN "plantId" TEXT, ADD COLUMN "equipmentCode" TEXT, ADD COLUMN "equipmentType" "EquipmentType" NOT NULL DEFAULT 'TANK', ADD COLUMN "telemetryMode" "TelemetryMode" NOT NULL DEFAULT 'AUTOMATIC', ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tank" ALTER COLUMN "scaleKey" DROP NOT NULL;
ALTER TABLE "ProductionLot" ADD COLUMN "plantId" TEXT;
ALTER TABLE "TankStateHistory" ADD COLUMN "plantId" TEXT;
ALTER TABLE "QualityDecision" ADD COLUMN "plantId" TEXT;
ALTER TABLE "PackagingOrder" ADD COLUMN "plantId" TEXT;
ALTER TABLE "PlantAuditLog" ADD COLUMN "plantId" TEXT;
ALTER TABLE "DailyPlantClosure" ADD COLUMN "plantId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "plantId" TEXT;

UPDATE "Tank" t SET "plantId"=p."id", "equipmentCode"=t."name" FROM "Plant" p WHERE p."companyId"=t."companyId" AND p."code"='LATEX' AND t."plantId" IS NULL;
UPDATE "ProductionLot" x SET "plantId"=t."plantId" FROM "Tank" t WHERE x."tankId"=t."id" AND x."plantId" IS NULL;
UPDATE "TankStateHistory" x SET "plantId"=t."plantId" FROM "Tank" t WHERE x."tankId"=t."id" AND x."plantId" IS NULL;
UPDATE "QualityDecision" x SET "plantId"=l."plantId" FROM "ProductionLot" l WHERE x."lotId"=l."id" AND x."plantId" IS NULL;
UPDATE "PackagingOrder" x SET "plantId"=t."plantId" FROM "Tank" t WHERE x."tankId"=t."id" AND x."plantId" IS NULL;
UPDATE "PlantAuditLog" x SET "plantId"=COALESCE((SELECT t."plantId" FROM "Tank" t WHERE t."id"=x."tankId"),(SELECT p."id" FROM "Plant" p WHERE p."companyId"=x."companyId" AND p."code"='LATEX')) WHERE x."plantId" IS NULL;
UPDATE "DailyPlantClosure" x SET "plantId"=p."id" FROM "Plant" p WHERE p."companyId"=x."companyId" AND p."code"='LATEX' AND x."plantId" IS NULL;
UPDATE "Notification" x SET "plantId"=(SELECT t."plantId" FROM "Tank" t WHERE t."id"=x."tankId") WHERE x."tankId" IS NOT NULL AND x."plantId" IS NULL;

ALTER TABLE "Tank" ALTER COLUMN "plantId" SET NOT NULL, ALTER COLUMN "equipmentCode" SET NOT NULL;
ALTER TABLE "ProductionLot" ALTER COLUMN "plantId" SET NOT NULL;
ALTER TABLE "TankStateHistory" ALTER COLUMN "plantId" SET NOT NULL;
ALTER TABLE "QualityDecision" ALTER COLUMN "plantId" SET NOT NULL;
ALTER TABLE "PackagingOrder" ALTER COLUMN "plantId" SET NOT NULL;
ALTER TABLE "PlantAuditLog" ALTER COLUMN "plantId" SET NOT NULL;
ALTER TABLE "DailyPlantClosure" ALTER COLUMN "plantId" SET NOT NULL;

DROP INDEX IF EXISTS "Tank_companyId_number_key"; DROP INDEX IF EXISTS "Tank_companyId_scaleKey_key"; DROP INDEX IF EXISTS "DailyPlantClosure_companyId_date_key";
CREATE UNIQUE INDEX "Tank_plantId_number_key" ON "Tank"("plantId","number");
CREATE UNIQUE INDEX "Tank_plantId_equipmentCode_key" ON "Tank"("plantId","equipmentCode");
CREATE UNIQUE INDEX "Tank_plantId_scaleKey_key" ON "Tank"("plantId","scaleKey");
CREATE UNIQUE INDEX "DailyPlantClosure_plantId_date_key" ON "DailyPlantClosure"("plantId","date");

CREATE TABLE "UserPlantAccess" ("userId" TEXT NOT NULL, "plantId" TEXT NOT NULL, "canTransfer" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "UserPlantAccess_pkey" PRIMARY KEY ("userId","plantId"), CONSTRAINT "UserPlantAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE, CONSTRAINT "UserPlantAccess_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE);
INSERT INTO "UserPlantAccess" ("userId","plantId") SELECT u."id",p."id" FROM "User" u JOIN "Plant" p ON p."companyId"=u."companyId" AND p."code"='LATEX' ON CONFLICT DO NOTHING;

CREATE TABLE "PlantIntegration" ("id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "plantId" TEXT NOT NULL, "source" TEXT NOT NULL, "keyHash" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PlantIntegration_pkey" PRIMARY KEY("id"), CONSTRAINT "PlantIntegration_companyId_fkey" FOREIGN KEY("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT, CONSTRAINT "PlantIntegration_plantId_fkey" FOREIGN KEY("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE);
CREATE UNIQUE INDEX "PlantIntegration_plantId_source_key" ON "PlantIntegration"("plantId","source");
CREATE TABLE "PackagingLine" ("id" TEXT NOT NULL, "plantId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PackagingLine_pkey" PRIMARY KEY("id"), CONSTRAINT "PackagingLine_plantId_fkey" FOREIGN KEY("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT);
CREATE UNIQUE INDEX "PackagingLine_plantId_code_key" ON "PackagingLine"("plantId","code");
CREATE TABLE "TransferOperation" ("id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "plantId" TEXT NOT NULL, "tankId" TEXT NOT NULL, "lotId" TEXT NOT NULL, "startedByUserId" TEXT NOT NULL, "finishedByUserId" TEXT, "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "finishedAt" TIMESTAMPTZ(3), "durationSeconds" INTEGER, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TransferOperation_pkey" PRIMARY KEY("id"), CONSTRAINT "TransferOperation_companyId_fkey" FOREIGN KEY("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT, CONSTRAINT "TransferOperation_plantId_fkey" FOREIGN KEY("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT, CONSTRAINT "TransferOperation_tankId_fkey" FOREIGN KEY("tankId") REFERENCES "Tank"("id") ON DELETE RESTRICT, CONSTRAINT "TransferOperation_lotId_fkey" FOREIGN KEY("lotId") REFERENCES "ProductionLot"("id") ON DELETE RESTRICT, CONSTRAINT "TransferOperation_startedByUserId_fkey" FOREIGN KEY("startedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT, CONSTRAINT "TransferOperation_finishedByUserId_fkey" FOREIGN KEY("finishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL);

ALTER TABLE "Tank" ADD CONSTRAINT "Tank_plantId_fkey" FOREIGN KEY("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT;
ALTER TABLE "ProductionLot" ADD CONSTRAINT "ProductionLot_plantId_fkey" FOREIGN KEY("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT;
ALTER TABLE "TankStateHistory" ADD CONSTRAINT "TankStateHistory_plantId_fkey" FOREIGN KEY("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT;
ALTER TABLE "QualityDecision" ADD CONSTRAINT "QualityDecision_plantId_fkey" FOREIGN KEY("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT;
ALTER TABLE "PackagingOrder" ADD CONSTRAINT "PackagingOrder_plantId_fkey" FOREIGN KEY("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT;
ALTER TABLE "PlantAuditLog" ADD CONSTRAINT "PlantAuditLog_plantId_fkey" FOREIGN KEY("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT;
ALTER TABLE "DailyPlantClosure" ADD CONSTRAINT "DailyPlantClosure_plantId_fkey" FOREIGN KEY("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_plantId_fkey" FOREIGN KEY("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT;

-- Fixtures de nuevas plantas: nombres provisorios y telemetría deshabilitada/pending.
INSERT INTO "Plant" ("id","companyId","code","name","displayOrder","finalOperation") SELECT 'plant_terplast_'||md5("id"),"id",'TERPLAST','Terplast',20,'PACKAGING' FROM "Company" ON CONFLICT DO NOTHING;
INSERT INTO "Plant" ("id","companyId","code","name","displayOrder","finalOperation") SELECT 'plant_slurry_'||md5("id"),"id",'SLURRY','Slurry',30,'TRANSFER' FROM "Company" ON CONFLICT DO NOTHING;
INSERT INTO "Plant" ("id","companyId","code","name","displayOrder","finalOperation") SELECT 'plant_enduido_'||md5("id"),"id",'ENDUIDO','Enduido',40,'PACKAGING' FROM "Company" ON CONFLICT DO NOTHING;
INSERT INTO "Tank" ("id","companyId","plantId","number","name","equipmentCode","equipmentType","telemetryMode","scaleKey","updatedAt") SELECT 'eq_'||lower(p."code")||'_'||n||'_'||md5(p."companyId"),p."companyId",p."id",n,CASE WHEN p."code"='SLURRY' THEN 'Dispersora '||n ELSE 'Equipo '||n END,CASE WHEN p."code"='SLURRY' THEN 'DISP'||n ELSE 'EQ'||n END,CASE WHEN p."code"='SLURRY' THEN 'DISPERSER'::"EquipmentType" ELSE 'TANK'::"EquipmentType" END,CASE WHEN p."code"='ENDUIDO' THEN 'NOT_INSTALLED'::"TelemetryMode" ELSE 'PENDING'::"TelemetryMode" END,NULL,CURRENT_TIMESTAMP FROM "Plant" p CROSS JOIN generate_series(1,4) n WHERE p."code"='TERPLAST' OR (p."code" IN ('SLURRY','ENDUIDO') AND n<=2) ON CONFLICT DO NOTHING;
INSERT INTO "TankStateHistory" ("id","companyId","plantId","tankId","state","description") SELECT 'hist_'||t."id",t."companyId",t."plantId",t."id",'VACIO','Estado inicial' FROM "Tank" t LEFT JOIN "TankStateHistory" h ON h."tankId"=t."id" AND h."endedAt" IS NULL WHERE h."id" IS NULL;

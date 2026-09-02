BEGIN;

CREATE TEMP TABLE "_planning_order_stages" ON COMMIT DROP AS
SELECT "id", "orderId"
FROM "OrderStage"
WHERE "code" = 'PLAN';

-- Preserve administrative ownership and history before removing the operational stage.
UPDATE "OrderAssignment"
SET "orderStageId" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "orderStageId" IN (SELECT "id" FROM "_planning_order_stages");

UPDATE "OperationLog"
SET "orderStageId" = NULL
WHERE "orderStageId" IN (SELECT "id" FROM "_planning_order_stages");

UPDATE "OrderAttachment"
SET "orderStageId" = NULL
WHERE "orderStageId" IN (SELECT "id" FROM "_planning_order_stages");

UPDATE "MaterialConsumption"
SET "orderStageId" = NULL
WHERE "orderStageId" IN (SELECT "id" FROM "_planning_order_stages");

-- Planning work sessions are not productive time and must not affect operator metrics.
DELETE FROM "StageWorkSession"
WHERE "orderStageId" IN (SELECT "id" FROM "_planning_order_stages");

DELETE FROM "OrderStage"
WHERE "id" IN (SELECT "id" FROM "_planning_order_stages");

DELETE FROM "CabinStageTemplate"
WHERE "code" = 'PLAN';

-- Keep positions contiguous: the productive flow now runs from 0 to 11.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "revisionId"
      ORDER BY "position", "id"
    ) - 1 AS "nextPosition"
  FROM "CabinStageTemplate"
)
UPDATE "CabinStageTemplate" AS stage
SET "position" = ranked."nextPosition"
FROM ranked
WHERE stage."id" = ranked."id"
  AND stage."position" <> ranked."nextPosition";

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "orderId"
      ORDER BY "position", "id"
    ) - 1 AS "nextPosition"
  FROM "OrderStage"
)
UPDATE "OrderStage" AS stage
SET "position" = ranked."nextPosition",
    "updatedAt" = CURRENT_TIMESTAMP
FROM ranked
WHERE stage."id" = ranked."id"
  AND stage."position" <> ranked."nextPosition";

-- Chassis, walls, floor, roof and openings are now parallel root stages.
UPDATE "OrderStage" AS stage
SET "status" = 'DISPONIBLE',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE stage."status" = 'BLOQUEADA'
  AND NOT EXISTS (
    SELECT 1
    FROM "OrderStageDependency" AS dependency
    JOIN "OrderStage" AS prerequisite
      ON prerequisite."id" = dependency."dependsOnStageId"
    WHERE dependency."stageId" = stage."id"
      AND prerequisite."status" <> 'COMPLETADA'
  );

WITH stage_summary AS (
  SELECT
    stage."orderId",
    ROUND(
      SUM(stage."weight" * stage."progressPct") /
      NULLIF(SUM(stage."weight"), 0)
    )::INTEGER AS "progressPct",
    BOOL_AND(
      NOT stage."isMandatory" OR stage."status" = 'COMPLETADA'
    ) AS "allComplete",
    BOOL_OR(stage."status" IN ('EN_PROCESO', 'RETRABAJO')) AS "anyActive",
    BOOL_OR(stage."status" = 'PAUSADA') AS "anyPaused"
  FROM "OrderStage" AS stage
  GROUP BY stage."orderId"
)
UPDATE "Order" AS production_order
SET
  "progressPct" = stage_summary."progressPct",
  "productionStatus" = CASE
    WHEN production_order."productionStatus" IN ('ENTREGADA', 'CANCELADA')
      THEN production_order."productionStatus"
    WHEN stage_summary."allComplete"
      THEN 'FINALIZADA'::"ProductionStatus"
    WHEN stage_summary."anyActive"
      THEN 'EN_PROCESO'::"ProductionStatus"
    WHEN stage_summary."anyPaused"
      THEN 'PAUSADA'::"ProductionStatus"
    ELSE 'PLANIFICADA'::"ProductionStatus"
  END,
  "finishedAt" = CASE
    WHEN stage_summary."allComplete"
      THEN COALESCE(production_order."finishedAt", CURRENT_TIMESTAMP)
    ELSE NULL
  END,
  "updatedAt" = CURRENT_TIMESTAMP
FROM stage_summary
WHERE production_order."id" = stage_summary."orderId";

COMMIT;

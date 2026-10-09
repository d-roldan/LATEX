ALTER TABLE "PackagingPlanningCard"
ADD COLUMN "hooked" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PackagingPlanningCard"
    GROUP BY "plantId"
    HAVING COUNT(*) > 4
  ) THEN
    RAISE EXCEPTION 'No se puede unificar la secuencia de envasado: una planta tiene más de cuatro tarjetas';
  END IF;
END $$;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "plantId"
      ORDER BY "position", "createdAt", "id"
    ) - 1 AS new_position
  FROM "PackagingPlanningCard"
)
UPDATE "PackagingPlanningCard" AS card
SET "position" = ranked.new_position
FROM ranked
WHERE card."id" = ranked."id";

DROP INDEX "PackagingPlanningCard_plantId_dispenser_position_idx";

ALTER TABLE "PackagingPlanningCard"
ADD CONSTRAINT "PackagingPlanningCard_plantId_position_key"
UNIQUE ("plantId", "position") DEFERRABLE INITIALLY DEFERRED;

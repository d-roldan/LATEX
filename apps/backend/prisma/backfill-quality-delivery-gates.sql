-- Las etapas de Control de Calidad y Entrega se marcaron como "gate" (isQualityGate / isDeliveryGate)
-- despues de que ya existian ordenes en produccion. Este backfill corrige las filas creadas antes
-- de ese cambio, identificandolas por codigo de etapa (CALIDAD / ENTREGA), tanto en las plantillas
-- de modelo de casilla como en las etapas ya generadas para ordenes existentes.

BEGIN;

UPDATE "CabinStageTemplate"
SET "isQualityGate" = true
WHERE "code" = 'CALIDAD' AND "isQualityGate" = false;

UPDATE "CabinStageTemplate"
SET "isDeliveryGate" = true
WHERE "code" = 'ENTREGA' AND "isDeliveryGate" = false;

UPDATE "OrderStage"
SET "isQualityGate" = true
WHERE "code" = 'CALIDAD' AND "isQualityGate" = false;

UPDATE "OrderStage"
SET "isDeliveryGate" = true
WHERE "code" = 'ENTREGA' AND "isDeliveryGate" = false;

COMMIT;

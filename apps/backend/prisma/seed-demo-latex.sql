-- Escenario demostrativo DISAL. Reemplaza solamente los datos operativos de planta.
-- Las lecturas continuas de balanza siguen siendo volátiles y llegan desde Node-RED.
BEGIN;

DELETE FROM "DailyPlantClosure";
DELETE FROM "PlantAuditLog";
DELETE FROM "PackagingOrder";
DELETE FROM "QualityDecision";
DELETE FROM "TankStateHistory";
UPDATE "Tank" SET "activeLotId" = NULL;
DELETE FROM "ProductionLot";

UPDATE "Tank"
SET "capacityKg" = CASE
  WHEN "number" IN (101, 102) THEN 60000
  WHEN "number" IN (103, 104) THEN 45000
  WHEN "number" IN (105, 106, 107) THEN 30000
  WHEN "number" IN (108, 109) THEN 10500
  ELSE "capacityKg"
END
WHERE "number" BETWEEN 101 AND 109;

INSERT INTO "ProductionLot" (
  "id", "companyId", "tankId", "manufacturingOrder", "materialCode", "description",
  "specificWeight", "plannedQuantityKg", "priority", "shift", "scheduledAt", "startedAt",
  "createdByUserId", "createdAt", "updatedAt"
)
SELECT
  'demo_lot_' || lower(t."name"), t."companyId", t."id",
  '26090' || right(t."name", 3),
  CASE t."number"
    WHEN 101 THEN '600101' WHEN 102 THEN '600102' WHEN 103 THEN '600103'
    WHEN 104 THEN '600104' WHEN 105 THEN '600105' WHEN 106 THEN '600106'
    WHEN 107 THEN '600107' WHEN 108 THEN '600108' ELSE '600109' END,
  CASE t."number"
    WHEN 101 THEN 'Látex interior blanco mate' WHEN 102 THEN 'Látex exterior premium blanco'
    WHEN 103 THEN 'Látex interior satinado' WHEN 104 THEN 'Pintura látex para cielorraso'
    WHEN 105 THEN 'Látex interior económico' WHEN 106 THEN 'Látex exterior antihongo'
    WHEN 107 THEN 'Látex color gris perla' WHEN 108 THEN 'Látex para fachadas'
    ELSE 'Fondo imprimación al agua' END,
  CASE WHEN t."number" IN (102,106,108) THEN 1.18 ELSE 1.12 END,
  CASE WHEN t."number" <= 106 THEN 18000 ELSE 9000 END,
  CASE WHEN t."number" IN (104,109) THEN 'ALTA' WHEN t."number" = 106 THEN 'URGENTE' ELSE 'NORMAL' END,
  CASE WHEN t."number" % 2 = 0 THEN 'Tarde' ELSE 'Mañana' END,
  now() - interval '33 hours', now() - interval '32 hours',
  (SELECT u."id" FROM "User" u WHERE u."companyId" = t."companyId" ORDER BY u."isSystemOwner" DESC, u."createdAt" LIMIT 1),
  now() - interval '32 hours', now()
FROM "Tank" t
WHERE t."number" BETWEEN 101 AND 109;

-- Dos lotes finalizados durante la jornada anterior para poblar los indicadores diarios.
INSERT INTO "ProductionLot" (
  "id", "companyId", "tankId", "manufacturingOrder", "materialCode", "description",
  "specificWeight", "plannedQuantityKg", "priority", "shift", "scheduledAt", "startedAt", "finishedAt",
  "createdByUserId", "createdAt", "updatedAt"
)
SELECT
  'demo_finished_' || lower(t."name"), t."companyId", t."id", '26091' || right(t."name", 3),
  CASE WHEN t."number" = 104 THEN '601104' ELSE '601109' END,
  CASE WHEN t."number" = 104 THEN 'Látex interior blanco obra' ELSE 'Fijador sellador al agua' END,
  1.10, CASE WHEN t."number" = 104 THEN 7200 ELSE 8400 END, 'NORMAL', 'Noche',
  now() - interval '43 hours', now() - interval '42 hours', now() - interval '33 hours',
  (SELECT u."id" FROM "User" u WHERE u."companyId" = t."companyId" ORDER BY u."isSystemOwner" DESC, u."createdAt" LIMIT 1),
  now() - interval '42 hours', now() - interval '33 hours'
FROM "Tank" t WHERE t."number" IN (104,109);

-- Primera etapa: fabricación de cada lote.
INSERT INTO "TankStateHistory" (
  "id", "companyId", "tankId", "lotId", "state", "description", "weightKg", "targetSeconds",
  "durationSeconds", "userId", "startedAt", "endedAt"
)
SELECT
  'demo_hist_fab_' || lower(t."name"), t."companyId", t."id", 'demo_lot_' || lower(t."name"),
  'FABRICANDO'::"TankState", 'Carga y dispersión de materias primas',
  1200 + (t."number" - 100) * 730, 28800, 46800,
  (SELECT u."id" FROM "User" u WHERE u."companyId" = t."companyId" ORDER BY u."isSystemOwner" DESC, u."createdAt" LIMIT 1),
  now() - interval '32 hours', now() - interval '19 hours'
FROM "Tank" t WHERE t."number" BETWEEN 101 AND 109;

-- Estado que tenía cada tanque al cierre de la jornada anterior.
INSERT INTO "TankStateHistory" (
  "id", "companyId", "tankId", "lotId", "state", "description", "weightKg", "targetSeconds",
  "durationSeconds", "userId", "startedAt", "endedAt"
)
SELECT
  'demo_hist_prev_' || lower(t."name"), t."companyId", t."id", 'demo_lot_' || lower(t."name"),
  (CASE t."number"
    WHEN 101 THEN 'FABRICANDO' WHEN 102 THEN 'AJUSTE' WHEN 103 THEN 'LABORATORIO'
    WHEN 104 THEN 'APROBADO' WHEN 105 THEN 'LABORATORIO' WHEN 106 THEN 'LABORATORIO'
    WHEN 107 THEN 'AJUSTE' WHEN 108 THEN 'FABRICANDO' ELSE 'APROBADO' END)::"TankState",
  CASE t."number"
    WHEN 101 THEN 'Terminación y control de viscosidad' WHEN 102 THEN 'Ajuste de color solicitado por laboratorio'
    WHEN 103 THEN 'Muestra entregada para liberación' WHEN 104 THEN 'Lote liberado, pendiente de línea 1'
    WHEN 105 THEN 'Ensayo de poder cubritivo' WHEN 106 THEN 'Control microbiológico y viscosidad'
    WHEN 107 THEN 'Corrección de tonalidad gris perla' WHEN 108 THEN 'Dispersión de pigmentos en proceso'
    ELSE 'Liberado para orden de envasado' END,
  1800 + (t."number" - 100) * 760,
  CASE WHEN t."number" IN (102,106) THEN 7200 ELSE 43200 END,
  46800,
  (SELECT u."id" FROM "User" u WHERE u."companyId" = t."companyId" ORDER BY u."isSystemOwner" DESC, u."createdAt" LIMIT 1),
  now() - interval '19 hours', now() - interval '6 hours'
FROM "Tank" t WHERE t."number" BETWEEN 101 AND 109;

-- Estado actual, con un lote visible en los nueve tanques.
INSERT INTO "TankStateHistory" (
  "id", "companyId", "tankId", "lotId", "state", "description", "weightKg", "targetSeconds",
  "userId", "startedAt"
)
SELECT
  'demo_hist_current_' || lower(t."name"), t."companyId", t."id", 'demo_lot_' || lower(t."name"),
  (CASE t."number"
    WHEN 101 THEN 'FABRICANDO' WHEN 102 THEN 'LABORATORIO' WHEN 103 THEN 'APROBADO'
    WHEN 104 THEN 'ENVASANDO' WHEN 105 THEN 'AJUSTE' WHEN 106 THEN 'RECHAZADO'
    WHEN 107 THEN 'FABRICANDO' WHEN 108 THEN 'LABORATORIO' ELSE 'ENVASANDO' END)::"TankState",
  CASE t."number"
    WHEN 101 THEN 'Agitación final antes de muestreo' WHEN 102 THEN 'Muestra en control de calidad'
    WHEN 103 THEN 'Aprobado, esperando programación de envasado' WHEN 104 THEN 'Envasado en formato 4 L - Línea 1'
    WHEN 105 THEN 'Ajuste de viscosidad en curso' WHEN 106 THEN 'Retenido por desvío de cubritivo'
    WHEN 107 THEN 'Incorporación de colorante' WHEN 108 THEN 'Verificación de tono y secado'
    ELSE 'Envasado en formato 20 L - Línea 3' END,
  2100 + (t."number" - 100) * 790,
  CASE WHEN t."number" IN (101,107) THEN 28800 WHEN t."number" IN (102,108) THEN 1800
       WHEN t."number" IN (104,109) THEN 21600 ELSE 3600 END,
  (SELECT u."id" FROM "User" u WHERE u."companyId" = t."companyId" ORDER BY u."isSystemOwner" DESC, u."createdAt" LIMIT 1),
  now() - interval '6 hours'
FROM "Tank" t WHERE t."number" BETWEEN 101 AND 109;

UPDATE "Tank" t
SET "activeLotId" = 'demo_lot_' || lower(t."name"),
    "state" = (CASE t."number"
      WHEN 101 THEN 'FABRICANDO' WHEN 102 THEN 'LABORATORIO' WHEN 103 THEN 'APROBADO'
      WHEN 104 THEN 'ENVASANDO' WHEN 105 THEN 'AJUSTE' WHEN 106 THEN 'RECHAZADO'
      WHEN 107 THEN 'FABRICANDO' WHEN 108 THEN 'LABORATORIO' ELSE 'ENVASANDO' END)::"TankState",
    "serviceReason" = NULL, "serviceNotes" = NULL, "version" = t."version" + 1, "updatedAt" = now()
WHERE t."number" BETWEEN 101 AND 109;

INSERT INTO "QualityDecision" (
  "id", "companyId", "lotId", "result", "employeeNumber", "specificWeight", "reason", "recoveryAction", "userId", "createdAt"
)
SELECT
  'demo_quality_' || lower(t."name"), t."companyId", 'demo_lot_' || lower(t."name"),
  (CASE WHEN t."number" = 105 THEN 'AJUSTE' WHEN t."number" = 106 THEN 'RECHAZADO_RECUPERAR' ELSE 'APROBADO' END)::"QualityResult",
  'LAB-' || t."number", CASE WHEN t."number" IN (102,106,108) THEN 1.18 ELSE 1.12 END,
  CASE WHEN t."number" = 105 THEN 'Viscosidad fuera del objetivo' WHEN t."number" = 106 THEN 'Cubritivo por debajo de especificación' ELSE NULL END,
  CASE WHEN t."number" = 105 THEN 'Agregar espesante y homogeneizar' WHEN t."number" = 106 THEN 'Reformular y repetir ensayo' ELSE NULL END,
  (SELECT u."id" FROM "User" u WHERE u."companyId" = t."companyId" ORDER BY u."isSystemOwner" DESC, u."createdAt" LIMIT 1),
  now() - interval '4 hours'
FROM "Tank" t WHERE t."number" IN (103,104,105,106,109);

INSERT INTO "QualityDecision" (
  "id", "companyId", "lotId", "result", "employeeNumber", "specificWeight", "reason", "recoveryAction", "userId", "createdAt"
)
SELECT
  'demo_quality_prev_' || lower(t."name"), t."companyId", 'demo_lot_' || lower(t."name"),
  (CASE WHEN t."number" = 102 THEN 'AJUSTE' WHEN t."number" = 106 THEN 'RECHAZADO_RECUPERAR' ELSE 'APROBADO' END)::"QualityResult",
  'LAB-' || t."number", 1.15,
  CASE WHEN t."number" = 102 THEN 'Diferencia de tono' WHEN t."number" = 106 THEN 'Bajo poder cubritivo' ELSE NULL END,
  CASE WHEN t."number" = 102 THEN 'Corregir color' WHEN t."number" = 106 THEN 'Reprocesar lote' ELSE NULL END,
  (SELECT u."id" FROM "User" u WHERE u."companyId" = t."companyId" ORDER BY u."isSystemOwner" DESC, u."createdAt" LIMIT 1),
  now() - interval '14 hours'
FROM "Tank" t WHERE t."number" IN (102,104,106);

INSERT INTO "PackagingOrder" (
  "id", "companyId", "tankId", "lotId", "packagingOrder", "line", "format", "startedByUserId", "startedAt", "createdAt", "updatedAt"
)
SELECT
  'demo_pack_' || lower(t."name"), t."companyId", t."id", 'demo_lot_' || lower(t."name"),
  '86090' || right(t."name", 3), CASE WHEN t."number" = 104 THEN 'Línea 1' ELSE 'Línea 3' END,
  CASE WHEN t."number" = 104 THEN '4 L' ELSE '10 L' END,
  (SELECT u."id" FROM "User" u WHERE u."companyId" = t."companyId" ORDER BY u."isSystemOwner" DESC, u."createdAt" LIMIT 1),
  now() - interval '5 hours', now() - interval '5 hours', now()
FROM "Tank" t WHERE t."number" IN (104,109);

INSERT INTO "PackagingOrder" (
  "id", "companyId", "tankId", "lotId", "packagingOrder", "line", "format", "startedByUserId", "finishedByUserId",
  "startedAt", "finishedAt", "durationSeconds", "producedKg", "wasteKg", "producedUnits", "createdAt", "updatedAt"
)
SELECT
  'demo_pack_finished_' || lower(t."name"), t."companyId", t."id", 'demo_finished_' || lower(t."name"),
  '86091' || right(t."name", 3), CASE WHEN t."number" = 104 THEN 'Línea 1' ELSE 'Línea 3' END,
  CASE WHEN t."number" = 104 THEN '4 L' ELSE '10 L' END,
  u."id", u."id", now() - interval '35 hours', now() - interval '33 hours', 7200,
  CASE WHEN t."number" = 104 THEN 7150 ELSE 8320 END,
  CASE WHEN t."number" = 104 THEN 50 ELSE 80 END,
  CASE WHEN t."number" = 104 THEN 1787 ELSE 832 END,
  now() - interval '35 hours', now() - interval '33 hours'
FROM "Tank" t
CROSS JOIN LATERAL (
  SELECT u."id" FROM "User" u WHERE u."companyId" = t."companyId" ORDER BY u."isSystemOwner" DESC, u."createdAt" LIMIT 1
) u
WHERE t."number" IN (104,109);

COMMIT;

-- Exportación NDJSON de LATEX para una importación histórica local controlada.
-- Ejecutar con psql -X -q -A -t -v ON_ERROR_STOP=1. No modifica datos.
-- Alcance: actividad desde el 01/10/2026 (hora argentina) y todos los
-- registros vinculados a los lotes alcanzados, aunque sean anteriores.
-- El resultado contiene datos industriales y personales: conservar fuera de Git.
BEGIN TRANSACTION READ ONLY;
SET LOCAL TIME ZONE 'UTC';

WITH
cutoff AS (
  SELECT TIMESTAMP '2026-10-01 00:00:00' AT TIME ZONE 'America/Argentina/Buenos_Aires' AS at
),
plants AS (
  SELECT p.* FROM "Plant" p WHERE p.code = 'LATEX'
),
lot_ids AS (
  SELECT l.id FROM "ProductionLot" l JOIN plants p ON p.id = l."plantId"
  CROSS JOIN cutoff c WHERE l."startedAt" >= c.at
  UNION
  SELECT h."lotId" FROM "TankStateHistory" h JOIN plants p ON p.id = h."plantId"
  CROSS JOIN cutoff c WHERE h."lotId" IS NOT NULL AND (h."startedAt" >= c.at OR h."endedAt" >= c.at)
  UNION
  SELECT d."lotId" FROM "QualityDecision" d JOIN plants p ON p.id = d."plantId"
  CROSS JOIN cutoff c WHERE d."createdAt" >= c.at
  UNION
  SELECT s."lotId" FROM "LaboratorySample" s JOIN plants p ON p.id = s."plantId"
  CROSS JOIN cutoff c WHERE s."requestedAt" >= c.at
  UNION
  SELECT o."lotId" FROM "PackagingOrder" o JOIN plants p ON p.id = o."plantId"
  CROSS JOIN cutoff c WHERE o."startedAt" >= c.at
),
rows AS (
  SELECT 0 AS n, 'manifest' AS entity, jsonb_build_object(
    'format', 'LATEX_REPORTING_NDJSON_V1', 'plantCode', 'LATEX',
    'sinceLocal', '2026-10-01T00:00:00-03:00', 'exportedAt', now()
  ) AS data
  UNION ALL
  SELECT 1, 'Company', jsonb_build_object('id', c.id, 'name', c.name)
    FROM "Company" c WHERE c.id IN (SELECT "companyId" FROM plants)
  UNION ALL
  SELECT 2, 'Plant', jsonb_build_object('id', p.id, 'companyId', p."companyId", 'code', p.code, 'name', p.name)
    FROM plants p
  UNION ALL
  SELECT 3, 'Tank', jsonb_build_object('id', t.id, 'companyId', t."companyId", 'plantId', t."plantId", 'number', t.number, 'name', t.name, 'equipmentCode', t."equipmentCode")
    FROM "Tank" t JOIN plants p ON p.id = t."plantId"
  UNION ALL
  SELECT 4, 'User', jsonb_build_object('id', u.id, 'companyId', u."companyId", 'username', u.username, 'fullName', u."fullName", 'role', u.role)
    FROM "User" u WHERE u."companyId" IN (SELECT "companyId" FROM plants)
  UNION ALL
  SELECT 5, 'ProductionLot', to_jsonb(l)
    FROM "ProductionLot" l WHERE l.id IN (SELECT id FROM lot_ids)
  UNION ALL
  SELECT 6, 'TankStateHistory', to_jsonb(h)
    FROM "TankStateHistory" h JOIN plants p ON p.id = h."plantId"
    CROSS JOIN cutoff c WHERE h."lotId" IN (SELECT id FROM lot_ids)
      OR (h."plantId" = p.id AND (h."startedAt" >= c.at OR h."endedAt" >= c.at))
  UNION ALL
  SELECT 7, 'QualityDecision', to_jsonb(d)
    FROM "QualityDecision" d WHERE d."lotId" IN (SELECT id FROM lot_ids)
  UNION ALL
  SELECT 8, 'LaboratorySample', to_jsonb(s)
    FROM "LaboratorySample" s WHERE s."lotId" IN (SELECT id FROM lot_ids)
  UNION ALL
  SELECT 9, 'QualityAdjustmentItem', to_jsonb(i)
    FROM "QualityAdjustmentItem" i
    JOIN "QualityDecision" d ON d.id = i."qualityDecisionId"
    WHERE d."lotId" IN (SELECT id FROM lot_ids)
  UNION ALL
  SELECT 10, 'PackagingOrder', to_jsonb(o)
    FROM "PackagingOrder" o WHERE o."lotId" IN (SELECT id FROM lot_ids)
  UNION ALL
  SELECT 11, 'PlantAuditLog', to_jsonb(a)
    FROM "PlantAuditLog" a JOIN plants p ON p.id = a."plantId"
    CROSS JOIN cutoff c WHERE a."lotId" IN (SELECT id FROM lot_ids)
      OR (a."plantId" = p.id AND a."createdAt" >= c.at)
)
SELECT jsonb_build_object('entity', entity, 'data', data)::text
FROM rows ORDER BY n;

COMMIT;
